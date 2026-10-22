import { describe, expect, it } from 'vitest';
import { checkOps, MAX_NOTES, MAX_TEXT, type MemoryOps, type Note } from './memory-writer.js';

const notes: Note[] = [
  { id: 'n1', kind: 'decision', text: 'Opening in London first' },
  { id: 'n2', kind: 'point', text: 'Budget is 40k' },
];
const ops = (list: Partial<MemoryOps['ops'][number]>[]): MemoryOps => ({
  ops: list.map((o) => ({ op: 'add', kind: null, id: null, text: null, ...o })),
});

describe('checkOps', () => {
  it('keeps a new note and drops one that repeats an existing note', () => {
    const out = checkOps(
      ops([
        { kind: 'decision', text: 'Dropped Lagos' },
        { kind: 'decision', text: 'opening in london first' },
      ]),
      notes,
    );
    expect(out).toEqual([{ op: 'add', kind: 'decision', text: 'Dropped Lagos' }]);
  });

  it('updates or removes only a note that exists', () => {
    const out = checkOps(
      ops([
        { op: 'update', id: 'n2', text: 'Budget is 60k' },
        { op: 'update', id: 'ghost', text: 'x' },
        { op: 'remove', id: 'n1' },
        { op: 'remove', id: 'ghost' },
      ]),
      notes,
    );
    expect(out).toEqual([
      { op: 'update', id: 'n2', text: 'Budget is 60k' },
      { op: 'remove', id: 'n1' },
    ]);
  });

  it('cuts long text, ignores empty text and stops at the cap', () => {
    const long = checkOps(ops([{ kind: 'point', text: 'x'.repeat(MAX_TEXT + 50) }]), []);
    expect(long[0]?.op === 'add' && long[0].text.length).toBe(MAX_TEXT);
    expect(checkOps(ops([{ kind: 'point', text: '  ' }]), [])).toEqual([]);
    const full: Note[] = Array.from({ length: MAX_NOTES }, (_, i) => ({
      id: `f${i}`,
      kind: 'point',
      text: `note ${i}`,
    }));
    expect(checkOps(ops([{ kind: 'point', text: 'one more' }]), full)).toEqual([]);
  });

  it('does nothing with no ops', () => {
    expect(checkOps(null, notes)).toEqual([]);
  });
});
