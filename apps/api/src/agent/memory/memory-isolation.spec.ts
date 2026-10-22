import { createTestDatabase } from '../../../test/test-database.js';
import { memoryItems, projects, teams } from '../../db/schema.js';
import { MemoryStore } from './memory-store.js';

// A note is reached through its project. Naming another project's note under your own project id
// must find nothing, because the route only checks the caller's role in the project it names.
describe('MemoryStore across projects', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let store: MemoryStore;
  let mine: string;
  let theirs: string;
  let theirNote: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    store = new MemoryStore(database.db);
    const [a, b] = await database.db
      .insert(teams)
      .values([{ name: 'Mine' }, { name: 'Theirs' }])
      .returning();
    const [p, q] = await database.db
      .insert(projects)
      .values([
        { teamId: a?.id ?? '', status: 'active' },
        { teamId: b?.id ?? '', status: 'active' },
      ])
      .returning();
    mine = p?.id ?? '';
    theirs = q?.id ?? '';
    const [note] = await database.db
      .insert(memoryItems)
      .values({ projectId: theirs, kind: 'point', text: 'Their decision' })
      .returning();
    theirNote = note?.id ?? '';
  });
  afterAll(() => database.close());

  it('does not list another project’s notes', async () => {
    expect(await store.list(mine)).toEqual([]);
    expect((await store.list(theirs)).map((n) => n.text)).toEqual(['Their decision']);
  });

  it('cannot edit or remove another project’s note through its own project id', async () => {
    expect(await store.edit(mine, theirNote, 'Changed')).toBeNull();
    expect(await store.remove(mine, theirNote)).toBe(false);
    expect((await store.list(theirs)).map((n) => n.text)).toEqual(['Their decision']);
  });
});
