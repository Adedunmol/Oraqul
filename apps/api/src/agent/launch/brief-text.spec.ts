import { describe, expect, it } from 'vitest';
import type { Handoff } from '../category-agents.js';
import { briefText } from './pipeline.js';

const said = (text: string) => ({ text, files: [] });

function handoff(first: string, now: string, recent: Handoff['recent']): Handoff {
  return {
    category: 'film',
    mode: 'build',
    title: 'Night Ferry',
    inputs: said(first),
    message: said(now),
    recent,
    planId: null,
  };
}

describe('briefText', () => {
  const recent = [
    { from: 'person', text: 'Lagos and London' },
    { from: 'agent', text: 'Which films are close to yours?' },
    { from: 'person', text: 'Lagos and London' },
  ] as Handoff['recent'];

  it('keeps earlier typed answers of a build, once each, between the first message and this one', () => {
    expect(briefText(handoff('A thriller', 'Salt Road', recent), undefined, true)).toBe(
      'A thriller\n\nLagos and London\n\nSalt Road',
    );
  });

  it('reads the first message and this one only, unless asked for the chat', () => {
    expect(briefText(handoff('A thriller', 'Salt Road', recent))).toBe('A thriller\n\nSalt Road');
  });
});
