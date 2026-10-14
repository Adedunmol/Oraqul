// Demo ids are UUIDs derived from a stable key, so the server render and the browser seed the
// same ids and the hydrated page matches.

function fnv1a(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A version 4 shaped UUID from a key. The same key always gives the same id. */
export function uuidFrom(key: string): string {
  const hex = [0x811c9dc5, 0x01000193, 0x2f2f2f2f, 0x5bd1e995]
    .map((seed) => fnv1a(key, seed).toString(16).padStart(8, '0'))
    .join('');
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
