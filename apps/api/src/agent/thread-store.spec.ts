import { describe, expect, it } from 'vitest';
import { withinChars } from './thread-store.js';

const line = (text: string, from: 'person' | 'oraqul' = 'person') => ({ from, text });

describe('withinChars', () => {
  it('keeps everything that fits, oldest first', () => {
    const lines = [line('aaaa'), line('bbbb'), line('cc')];
    expect(withinChars(lines, 100)).toEqual(lines);
  });

  it('drops the oldest lines first when the chat outgrows the limit', () => {
    const lines = [line('aaaa'), line('bbbb'), line('cc')];
    expect(withinChars(lines, 5).map((l) => l.text)).toEqual(['cc']);
    expect(withinChars(lines, 8).map((l) => l.text)).toEqual(['bbbb', 'cc']);
  });

  it('keeps the newest line even when it alone is over the limit', () => {
    expect(withinChars([line('aaaa'), line('a very long message')], 5).map((l) => l.text)).toEqual([
      'a very long message',
    ]);
  });
});
