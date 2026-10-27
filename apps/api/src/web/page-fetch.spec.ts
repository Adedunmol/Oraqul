import { describe, expect, it } from 'vitest';
import { fetchPage, htmlToText, isPrivateAddress, pageContains } from './page-fetch.js';

const html = (body: string, type = 'text/html') =>
  new Response(body, { status: 200, headers: { 'content-type': type } });
const publicDns = async () => ['93.184.216.34'];

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '::1',
    'fd00::1',
    '::ffff:10.0.0.1',
    '0.0.0.0',
  ])('refuses %s', (a) => expect(isPrivateAddress(a)).toBe(true));
  it.each(['93.184.216.34', '8.8.8.8', '2606:4700::1111'])('allows %s', (a) =>
    expect(isPrivateAddress(a)).toBe(false),
  );
});

describe('fetchPage', () => {
  const now = () => new Date('2026-10-27T10:00:00Z');

  it('reads a public https page as text with the day it was read', async () => {
    const page = await fetchPage('https://example.org/fund', {
      fetch: async () => html('<p>Deadline: 30 November 2026</p><script>x()</script>'),
      resolve: publicDns,
      now,
    });
    expect(page?.text).toBe('Deadline: 30 November 2026');
    expect(page?.retrievedAt).toBe('2026-10-27');
    expect(page && pageContains(page, '30 november  2026')).toBe(true);
    expect(page && pageContains(page, '1 December 2026')).toBe(false);
  });

  it('refuses http, odd ports, credentials and private hosts without fetching', async () => {
    let calls = 0;
    const fetchStub = (async () => {
      calls++;
      return html('x');
    }) as typeof fetch;
    for (const url of [
      'http://example.org',
      'https://example.org:8443',
      'https://user:pw@example.org',
      'https://127.0.0.1/x',
      'https://[::1]/x',
    ]) {
      expect(await fetchPage(url, { fetch: fetchStub, resolve: publicDns })).toBeNull();
    }
    expect(
      await fetchPage('https://intranet.example', {
        fetch: fetchStub,
        resolve: async () => ['10.0.0.5'],
      }),
    ).toBeNull();
    expect(calls).toBe(0);
  });

  it('checks every redirect hop', async () => {
    const hosts: Record<string, string[]> = {
      'a.example': ['93.184.216.34'],
      'b.example': ['10.0.0.1'],
    };
    const result = await fetchPage('https://a.example/', {
      fetch: async () =>
        new Response(null, { status: 302, headers: { location: 'https://b.example/' } }),
      resolve: async (h) => hosts[h] ?? [],
    });
    expect(result).toBeNull();
  });

  it('refuses a page over the size cap and a non text type', async () => {
    expect(
      await fetchPage('https://example.org', {
        fetch: async () => html('x'.repeat(1_000_001)),
        resolve: publicDns,
      }),
    ).toBeNull();
    expect(
      await fetchPage('https://example.org', {
        fetch: async () => html('{}', 'application/json'),
        resolve: publicDns,
      }),
    ).toBeNull();
  });
});

describe('htmlToText', () => {
  it('drops tags, comments and entities', () => {
    expect(htmlToText('<h1>A &amp; B</h1><!-- x --><style>p{}</style> <b>c</b>')).toBe('A & B c');
  });
});
