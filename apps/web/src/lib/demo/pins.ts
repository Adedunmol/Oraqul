'use client';

import { pinnedProjectsSchema } from '@oraqul/schema';
import { useSyncExternalStore } from 'react';

// Stand-in for `GET /me/pins` and `PUT` / `DELETE /me/pins/:projectId` (spec §7). Pins are one
// person's, so the demo keeps them in this browser and they survive a reload, unlike the rest of
// the demo state. A pin to a project the session no longer has is skipped where it is shown.

const STORAGE_KEY = 'oraqul-pins';
const EMPTY: string[] = [];
const MAX_PINS = 12;

const listeners = new Set<() => void>();
let pins: string[] | undefined;

function load(): string[] {
  if (pins) return pins;
  try {
    const parsed = pinnedProjectsSchema.safeParse(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'),
    );
    pins = parsed.success ? parsed.data : [];
  } catch {
    // Private windows can refuse storage, and an old value may not parse. Start empty.
    pins = [];
  }
  return pins;
}

function save(next: string[]): void {
  pins = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The pin still holds for this page; it is only not remembered.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Pinned project ids, newest first. Empty on the server and during hydration, so the first render matches. */
export function usePinnedProjects(): string[] {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

/** Pins or unpins a project. Returns whether it is pinned now. The oldest pin drops past the limit. */
export function togglePin(projectId: string): boolean {
  const current = load();
  if (current.includes(projectId)) {
    save(current.filter((id) => id !== projectId));
    return false;
  }
  save([projectId, ...current].slice(0, MAX_PINS));
  return true;
}
