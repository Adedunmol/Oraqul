import { z } from 'zod';
import { registerPlace } from './places';
import type { QlooCall, QlooClient } from './qloo/client';
import * as lookup from './qloo/lookup';

const propertiesSchema = z.looseObject({
  admin_level: z.number().optional(),
  boundaries: z.string().optional(),
  akas: z.array(z.looseObject({ value: z.string().optional() })).optional(),
  ancestors: z
    .array(z.looseObject({ name: z.string().optional(), place: z.string().optional() }))
    .optional(),
});

export interface FoundPlace {
  /** What Qloo calls it, such as "Kumasi Metropolitan District". */
  qlooName: string;
  centre: [number, number];
  country: string | null;
}

// Qloo's own country names, where they differ from the names the city table uses.
const COUNTRY_NAMES: Record<string, string> = { 'United States of America': 'United States' };

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Longitude and latitude pairs of a WKT shape. */
function corners(wkt: string): [number, number][] {
  const numbers = (wkt.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    pairs.push([numbers[i] as number, numbers[i + 1] as number]);
  }
  return pairs;
}

/**
 * Looks a city up in Qloo as a locality (one `/search` call) and registers its centre, the middle
 * of its boundary, so it can be ranked like a table city. Neighbourhoods are skipped, and of
 * several places with the name the one in `country` wins, then the most popular. `place` is null
 * when Qloo has no locality with that name.
 */
export async function findPlace(
  client: QlooClient,
  name: string,
  country: string | null,
): Promise<{ place: FoundPlace | null; call: QlooCall }> {
  const { data, call } = await lookup.search(client, {
    query: name,
    types: ['urn:entity:locality'],
    take: 5,
  });
  const wanted = words(name);
  let best: { place: FoundPlace; score: number } | null = null;
  for (const entity of data.results) {
    const props = propertiesSchema.safeParse(entity.properties ?? {});
    if (!props.success) continue;
    const { admin_level: level, boundaries, akas, ancestors } = props.data;
    if (!boundaries || (level !== undefined && level > 9)) continue;
    const names = [entity.name, ...(akas ?? []).map((a) => a.value ?? '')].map(words);
    if (!names.some((n) => n === wanted || n.startsWith(`${wanted} `))) continue;
    const shape = corners(boundaries);
    if (shape.length === 0) continue;
    const lons = shape.map(([lon]) => lon);
    const lats = shape.map(([, lat]) => lat);
    const centre: [number, number] = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lons) + Math.max(...lons)) / 2,
    ];
    const countryName = ancestors?.find((a) => a.place === 'country')?.name;
    const found = countryName ? (COUNTRY_NAMES[countryName] ?? countryName) : null;
    const score =
      (country && found && words(found) === words(country) ? 10 : 0) + (entity.popularity ?? 0);
    if (!best || score > best.score) {
      best = { place: { qlooName: entity.name, centre, country: found }, score };
    }
  }
  if (best) registerPlace(name, best.place.centre, best.place.country);
  return { place: best?.place ?? null, call };
}
