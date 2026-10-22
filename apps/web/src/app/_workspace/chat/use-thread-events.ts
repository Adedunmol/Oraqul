'use client';

import { type ThreadEvent, threadEventSchema } from '@oraqul/schema';
import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api/http';

export type StreamStatus = 'live' | 'reconnecting' | 'lost';

// Event types kept in the thread's transcript, whose SSE id is their seq.
const STORED = new Set<ThreadEvent['type']>([
  'trace.step',
  'question',
  'message',
  'error',
  'output.created',
  'finding',
  'memory.used',
]);

/**
 * Follows a thread's event stream (spec §8). Stored events carry their seq as the SSE id, so an
 * event already seen is not handled twice when the browser reconnects.
 */
export function useThreadEvents(
  threadId: string,
  afterSeq: number,
  onEvent: (event: ThreadEvent) => void,
): { status: StreamStatus; retry: () => void } {
  const [status, setStatus] = useState<StreamStatus>('live');
  const [attempt, setAttempt] = useState(0);
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const lastSeq = useRef(afterSeq);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `attempt` is how Try again reopens the stream
  useEffect(() => {
    const url = apiUrl(`/threads/${threadId}/events?after=${lastSeq.current}`);
    const source = new EventSource(url, { withCredentials: true });
    source.onopen = () => setStatus('live');
    source.onmessage = (message) => {
      let data: unknown;
      try {
        data = JSON.parse(message.data);
      } catch {
        console.error('Thread event is not JSON', message.data);
        return;
      }
      const parsed = threadEventSchema.safeParse(data);
      if (!parsed.success) {
        console.error('Malformed thread event', parsed.error);
        return;
      }
      // Only stored events carry their seq. The server numbers the others itself, so their id
      // means nothing here.
      if (STORED.has(parsed.data.type)) {
        const seq = Number(message.lastEventId);
        if (Number.isInteger(seq)) {
          if (seq <= lastSeq.current) return;
          lastSeq.current = seq;
        }
      }
      handler.current(parsed.data);
    };
    // The browser retries on its own while the source is connecting; once closed it gives up.
    source.onerror = () =>
      setStatus(source.readyState === EventSource.CLOSED ? 'lost' : 'reconnecting');
    return () => source.close();
  }, [threadId, attempt]);

  return { status, retry: () => setAttempt((n) => n + 1) };
}
