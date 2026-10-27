import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const FETCH_TIMEOUT_MS = 10_000;
export const FETCH_MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

export type Resolve = (host: string) => Promise<string[]>;

const defaultResolve: Resolve = async (host) =>
  (await lookup(host, { all: true })).map((a) => a.address);

/** Loopback, private, link-local, unspecified and carrier ranges, for IPv4 and IPv6. */
export function isPrivateAddress(address: string): boolean {
  const v4 = address.match(/^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/i);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return (
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe8') ||
    v6.startsWith('fe9') ||
    v6.startsWith('fea') ||
    v6.startsWith('feb')
  );
}

export interface FetchedPage {
  url: string;
  text: string;
  retrievedAt: string;
}

export interface PageFetchDeps {
  fetch?: typeof fetch;
  resolve?: Resolve;
  now?: () => Date;
}

/** Plain text of an HTML page: scripts and styles out, tags out, entities and spacing tidied. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reads a public web page for a check that must see the page itself, not a search answer's
 * summary of it. Outbound, so it is narrow: https only, no private addresses at any redirect hop,
 * ten seconds, a megabyte. The text is returned and never stored.
 */
export async function fetchPage(
  rawUrl: string,
  deps: PageFetchDeps = {},
): Promise<FetchedPage | null> {
  const doFetch = deps.fetch ?? fetch;
  const resolve = deps.resolve ?? defaultResolve;
  const now = deps.now ?? (() => new Date());
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.port && url.port !== '443') return null;
    if (!(await publicHost(url.hostname, resolve))) return null;
    let response: Response;
    try {
      response = await doFetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'text/html,text/plain;q=0.9', 'user-agent': 'OraqulPageCheck/1.0' },
      });
    } catch {
      return null;
    }
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location');
      if (!next) return null;
      try {
        url = new URL(next, url);
      } catch {
        return null;
      }
      continue;
    }
    if (!response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    if (!/text\/(html|plain)|application\/xhtml/i.test(type)) return null;
    const body = await readCapped(response);
    if (body === null) return null;
    return {
      url: url.toString(),
      text: /html/i.test(type) ? htmlToText(body) : body.replace(/\s+/g, ' ').trim(),
      retrievedAt: now().toISOString().slice(0, 10),
    };
  }
  return null;
}

async function publicHost(host: string, resolve: Resolve): Promise<boolean> {
  const bare = host.replace(/^\[|\]$/g, '');
  const addresses = isIP(bare) ? [bare] : await resolve(bare).catch(() => []);
  return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a));
}

async function readCapped(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > FETCH_MAX_BYTES) return null;
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > FETCH_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** True when `quote` (a date, an amount, a name) is on the page, ignoring case and spacing. */
export function pageContains(page: FetchedPage, quote: string): boolean {
  const squash = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
  const needle = squash(quote);
  return needle.length > 0 && squash(page.text).includes(needle);
}
