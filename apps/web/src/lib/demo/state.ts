import { seed } from './seed';
import { type DemoState, getState } from './store';

seed();

/** The seeded state. The server renders from it, and the browser starts from the same one. */
export const initialState: DemoState = getState();
