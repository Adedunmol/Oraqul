import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

// TODO(verify): the property and tag names below come from one recorded `insights` fixture
// (Elden Ring as the signal). Run `qloo:games-probes` before a plan leans on `/entities`.
const propertiesSchema = z.looseObject({
  platforms: z.array(z.string()).optional(),
  genre: z.array(z.string()).optional(),
  steam_tags: z.array(z.string()).optional(),
  content_rating: z.string().optional(),
  developer: z.string().optional(),
  publisher: z.string().optional(),
  universe: z.string().optional(),
  release_date: z.string().optional(),
});

/** The tag kinds a launch can use. Names are the middle of `urn:tag:<kind>:qloo`. */
export const gameTagKinds = [
  'genre',
  'gameplay_type',
  'player_mode',
  'skill_level',
  'art_style',
  'emotional_tone',
] as const;
const tagKindSchema = z.enum(gameTagKinds);

export const gameProfilesOutputSchema = z.object({
  games: z.array(
    z.object({
      entityId: z.string(),
      name: z.string(),
      platforms: z.array(z.string()),
      genres: z.array(z.string()),
      steamTags: z.array(z.string()),
      contentRating: z.string().nullable(),
      developer: z.string().nullable(),
      publisher: z.string().nullable(),
      /** The franchise, as Qloo names it. */
      franchise: z.string().nullable(),
      releaseDate: z.string().nullable(),
      tags: z.partialRecord(tagKindSchema, z.array(z.string())),
    }),
  ),
  confidence: z.enum(['high', 'medium', 'lower']),
  why: z.string(),
  receiptId: z.string(),
});

function kindOf(type: string | undefined): z.infer<typeof tagKindSchema> | null {
  const kind = type?.match(/^urn:tag:([a-z_]+):qloo$/)?.[1];
  const parsed = tagKindSchema.safeParse(kind);
  return parsed.success ? parsed.data : null;
}

export const gameProfiles = defineTool({
  name: 'gameProfiles',
  description:
    "What Qloo holds about each game: platforms, genre, gameplay and tone tags, age rating, developer, publisher and franchise. One lookup, no scoring. Use it to check a launch's platforms and store tags against its comparable games.",
  input: z.object({
    entityIds: z.array(z.string()).min(1).max(20),
  }),
  async run(ctx, { entityIds }) {
    const { data: response, call } = await qloo.lookup.entities(ctx.qloo, entityIds);
    const games = response.results.map((e) => {
      const props = propertiesSchema.safeParse(e.properties ?? {});
      const p = props.success ? props.data : {};
      const tags: z.infer<typeof gameProfilesOutputSchema>['games'][number]['tags'] = {};
      for (const t of e.tags ?? []) {
        const kind = kindOf(t.type);
        if (!kind || !t.name) continue;
        const list = tags[kind] ?? [];
        if (!list.includes(t.name)) list.push(t.name);
        tags[kind] = list;
      }
      return {
        entityId: e.entity_id,
        name: e.name,
        platforms: p.platforms ?? [],
        genres: p.genre ?? [],
        steamTags: p.steam_tags ?? [],
        contentRating: p.content_rating ?? null,
        developer: p.developer ?? null,
        publisher: p.publisher ?? null,
        franchise: p.universe ?? null,
        releaseDate: p.release_date ?? null,
        tags,
      };
    });
    const withData = games.filter(
      (g) => g.platforms.length > 0 || g.steamTags.length > 0 || Object.keys(g.tags).length > 0,
    );
    for (const e of response.results) {
      ctx.entities.set(e.entity_id, { name: e.name, popularity: e.popularity ?? null });
    }

    const { level, reason } = confidenceFor({
      anchorsWithData: withData.length,
      knownAnchors: countKnown(
        withData.map((g) => ctx.entities.get(g.entityId)?.popularity ?? null),
      ),
      cannotTest: withData.length === 0,
    });
    const receipt = toReceipt(call, {
      returned: { games },
      rule: `What Qloo lists for each game, as returned. Nothing is scored. Confidence ${reason}.`,
      confidence: level,
      source: ctx.source,
    });
    const data: z.infer<typeof gameProfilesOutputSchema> = {
      games,
      confidence: level,
      why: reason,
      receiptId: receipt.callId,
    };
    return { data, receipts: [receipt] };
  },
});
