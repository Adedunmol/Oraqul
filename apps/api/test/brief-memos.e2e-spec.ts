import { DbBriefMemos } from '../src/agent/brief-memos.js';
import { briefMemos } from '../src/db/schema.js';
import { createTestDatabase } from './test-database.js';

describe('DbBriefMemos', () => {
  it('keeps what the model chose, replaces it for the same key, and forgets old entries', async () => {
    const { db, close } = await createTestDatabase();
    try {
      const memos = new DbBriefMemos(db as never);
      expect(await memos.get('k1')).toBeNull();
      await memos.set('k1', 'analysis', { comps: ['A'] });
      expect(await memos.get('k1')).toEqual({ comps: ['A'] });
      await memos.set('k1', 'analysis', { comps: ['B'] });
      expect(await memos.get('k1')).toEqual({ comps: ['B'] });
      // An entry older than the keep window is not used.
      await db.insert(briefMemos).values({
        key: 'old',
        kind: 'analysis',
        value: { comps: ['C'] },
        createdAt: new Date(Date.now() - 40 * 86_400_000),
      });
      expect(await memos.get('old')).toBeNull();
    } finally {
      await close();
    }
  });
});
