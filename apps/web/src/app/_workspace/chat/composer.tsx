'use client';

import { Button, Icon } from '@oraqul/ui';
import {
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { readUpload, UploadRefused } from '@/lib/api/uploads';
import { withQuote } from './quote';

export interface Attachment {
  name: string;
  size: number;
  /** The file's text, when it is a small text file. Other files carry only their name. */
  text?: string;
}

const MAX_FILES = 5;
const MAX_BYTES = 20 * 1024 * 1024;
const READ_BYTES = 200 * 1024;
const ACCEPT = '.pdf,.docx,.txt,.md,.csv,.json';
const TEXT_FILE = /\.(txt|md|csv|json)$/i;
const READ_BY_API = /\.(pdf|docx)$/i;

function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Plain text is read in the browser. PDF and Word go to `POST /uploads`, which returns their
// text and keeps nothing (spec §7). A file that cannot be read is not attached.
async function toAttachment(file: File): Promise<Attachment> {
  if (READ_BY_API.test(file.name)) {
    const { text } = await readUpload(file);
    return { name: file.name, size: file.size, text };
  }
  const readable = TEXT_FILE.test(file.name) && file.size <= READ_BYTES;
  return { name: file.name, size: file.size, text: readable ? await file.text() : undefined };
}

/**
 * The message box: a growing text area, files by button or by drop, Enter to send and Shift Enter
 * for a new line. Sends when there is text or at least one file.
 */
export function Composer({
  placeholder,
  disabled,
  autoFocus,
  allowFiles,
  initialText,
  compact,
  quote,
  onClearQuote,
  onSend,
  onStop,
}: {
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
  allowFiles?: boolean;
  /** Words already in the box, such as a brief built in the guide. */
  initialText?: string;
  /** One line to start, growing as the person types. For a chat that is already going. */
  compact?: boolean;
  /** A passage from the chat the message replies to, shown above the box and sent with it. */
  quote?: string | null;
  onClearQuote?: () => void;
  onSend: (text: string, files: Attachment[]) => void;
  /** Set while the agent is working: Send becomes Stop, which ends the run. */
  onStop?: () => void | Promise<void>;
}) {
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(initialText ?? '');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [problem, setProblem] = useState('');
  const [stopping, setStopping] = useState(false);
  const stoppable = Boolean(onStop);
  // The box frees up when the run ends; the next run starts with a Stop button that works.
  useEffect(() => {
    if (!stoppable) setStopping(false);
  }, [stoppable]);
  const [dragging, setDragging] = useState(false);
  const ready = !disabled && (draft.trim() !== '' || files.length > 0);

  // Picking a passage to reply to hands the person straight to the box.
  useEffect(() => {
    if (quote) field.current?.focus();
  }, [quote]);

  async function add(list: FileList | null) {
    if (!list?.length) return;
    const chosen = Array.from(list);
    const tooBig = chosen.filter((f) => f.size > MAX_BYTES);
    const room = MAX_FILES - files.length;
    const kept = chosen.filter((f) => f.size <= MAX_BYTES).slice(0, Math.max(0, room));
    setProblem(
      tooBig.length
        ? `${tooBig[0]?.name} is over 20 MB. Attach a smaller file.`
        : chosen.length > kept.length
          ? `Attach up to ${MAX_FILES} files.`
          : '',
    );
    const results = await Promise.allSettled(kept.map(toAttachment));
    const read = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failed = results.findIndex((r) => r.status === 'rejected');
    const why = failed < 0 ? null : results[failed];
    if (why?.status === 'rejected') {
      setProblem(
        why.reason instanceof UploadRefused
          ? why.reason.message
          : `${kept[failed]?.name} could not be read. Try again.`,
      );
    }
    setFiles((current) => [
      ...current,
      ...read.filter((f) => !current.some((c) => c.name === f.name)),
    ]);
  }

  function send(event?: FormEvent) {
    event?.preventDefault();
    if (!ready) return;
    onSend(withQuote(quote ?? null, draft.trim()), files);
    onClearQuote?.();
    setDraft('');
    setFiles([]);
    setProblem('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  function onDrop(event: DragEvent) {
    if (!allowFiles) return;
    event.preventDefault();
    setDragging(false);
    void add(event.dataTransfer.files);
  }

  return (
    <form
      onSubmit={send}
      onDragOver={(event) => {
        if (!allowFiles || disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col gap-2 rounded-xl border bg-surface p-2 shadow-sm transition-colors focus-within:border-accent motion-reduce:transition-none ${dragging ? 'border-accent bg-accent-soft' : 'border-line'}`}
    >
      {quote ? (
        <div className="flex items-start gap-2 rounded-lg bg-inset py-1.5 pr-1 pl-3 text-[13px]">
          <p className="line-clamp-2 min-w-0 flex-1 py-0.5 text-muted">
            <span className="font-semibold text-ink">Replying to </span>
            {quote}
          </p>
          <button
            type="button"
            aria-label="Remove quoted text"
            onClick={onClearQuote}
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted hover:bg-surface2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Icon name="close" className="size-3.5" />
          </button>
        </div>
      ) : null}
      {files.length ? (
        <ul aria-label="Attached files" className="flex flex-wrap gap-1.5 px-1 pt-1">
          {files.map((file) => (
            <li
              key={file.name}
              className="flex max-w-full items-center gap-2 rounded-md bg-surface2 py-1 pr-1 pl-2.5 text-[12.5px]"
            >
              <span className="truncate font-medium">{file.name}</span>
              <span className="shrink-0 text-muted">{sizeLabel(file.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFiles((list) => list.filter((f) => f.name !== file.name))}
                className="grid size-6 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Icon name="close" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label htmlFor={id} className="sr-only">
        Message
      </label>
      <textarea
        ref={field}
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={dragging ? 'Drop to attach' : placeholder}
        disabled={disabled}
        // biome-ignore lint/a11y/noAutofocus: the page exists to write this one message
        autoFocus={autoFocus}
        rows={compact ? 1 : 3}
        className={`max-h-60 ${compact ? 'min-h-[36px]' : 'min-h-[72px]'} w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-[1.5] placeholder:text-muted focus:outline-none disabled:opacity-60 [field-sizing:content]`}
      />
      {problem ? (
        <p role="alert" className="px-2 text-[13px] text-breaks">
          {problem}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        {allowFiles ? (
          <>
            <input
              ref={picker}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                void add(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="small"
              variant="ghost"
              icon="attach"
              disabled={disabled || files.length >= MAX_FILES}
              onClick={() => picker.current?.click()}
            >
              Attach files
            </Button>
          </>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-2">
          <span className="hidden text-xs text-muted min-[700px]:inline">
            Shift Enter for a new line
          </span>
          {onStop ? (
            <Button
              type="button"
              variant="primary"
              size="small"
              icon="close"
              disabled={stopping}
              onClick={async () => {
                setStopping(true);
                try {
                  await onStop();
                } catch {
                  setStopping(false);
                }
              }}
            >
              {stopping ? 'Stopping' : 'Stop'}
            </Button>
          ) : (
            <Button type="submit" variant="primary" size="small" icon="arrowUp" disabled={!ready}>
              Send
            </Button>
          )}
        </span>
      </div>
    </form>
  );
}
