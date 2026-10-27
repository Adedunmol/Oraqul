import { AsyncLocalStorage } from 'node:async_hooks';
import type { runVias } from '../db/schema.js';

export type RunVia = (typeof runVias)[number];

/** Who a run counts against and where it came from. */
export interface RunOrigin {
  userId: string | null;
  via: RunVia;
}

export const WEB_ORIGIN_NONE: RunOrigin = { userId: null, via: 'web' };

// Carried alongside the run instead of through every pipeline signature: the Qloo meter and the
// run record both need it, and neither is called from code that knows the user.
export const runOrigin = new AsyncLocalStorage<RunOrigin>();

export const currentOrigin = (): RunOrigin => runOrigin.getStore() ?? WEB_ORIGIN_NONE;
