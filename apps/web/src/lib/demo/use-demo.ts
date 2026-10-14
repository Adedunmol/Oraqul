'use client';

import { useSyncExternalStore } from 'react';
import { initialState } from './state';
import { type DemoState, getState, subscribe } from './store';

/** The demo backend's state. Derive views from it with lib/demo/queries.ts inside `useMemo`. */
export function useDemo(): DemoState {
  return useSyncExternalStore(subscribe, getState, () => initialState);
}
