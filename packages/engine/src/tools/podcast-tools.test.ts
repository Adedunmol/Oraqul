import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, testClient } from '../qloo/fake-fetch';
import { tools } from './index';
import type { SeenEntity, ToolContext } from './tool';
import { topicMapOutputSchema, topicOwnership } from './topic-map';

function context(): ToolContext {
  return { qloo: testClient(), source: 'demo', entities: new Map<string, SeenEntity>() };
}

const tag = (name: string, count?: number, namespace = 'keyword') => ({
  tag_id: `urn:tag:${namespace}:qloo:${name.toLowerCase().replace(/ /g, '_')}`,
  name,
  query: count === undefined ? { score: 0.73 } : { count: String(count) },
});

afterEach(() => vi.unstubAllGlobals());

describe('topicOwnership', () => {
  it('calls a topic yours when only your shows carry it, and the rivals when only theirs do', () => {
    // Your 2 shows both carry Storytelling; the 4 rival shows carry Politics in 2 of 4. A typical rival
    // topic is carried by half the rival shows, so Storytelling (every one of yours) weighs 2.
    const split = topicOwnership(
      [tag('Storytelling', 2), tag('Money', 1), tag('True Crime', 2)],
      [],
      [tag('Politics', 2), tag('Faith', 2), tag('True Crime', 2)],
      { own: 2, rival: 4 },
    );
    expect(split.yours.map((t) => [t.name, t.weight])).toEqual([
      ['Storytelling', 2],
      ['Money', 1],
    ]);
    expect(split.shared.map((t) => t.name)).toEqual(['True Crime']);
    expect(split.rivals.map((t) => t.name)).toEqual(['Politics', 'Faith']);
  });

  it('tells topics apart by name, since Qloo lists one topic under several namespaces', () => {
    const split = topicOwnership(
      [tag('True Crime', 2, 'genre'), tag('True Crime', 2, 'keyword'), tag('Justice', 2, 'theme')],
      [],
      [tag('True Crime', 4, 'genre')],
      { own: 2, rival: 4 },
    );
    expect(split.yours.map((t) => t.name)).toEqual(['Justice']);
    expect(split.shared.map((t) => t.name)).toEqual(['True Crime']);
  });

  it('counts only subject tags, not how a show sounds or who it is for', () => {
    const split = topicOwnership(
      [tag('Justice', 2, 'theme'), tag('Immersive', 2, 'style'), tag('Charismatic', 2, 'host')],
      [],
      [tag('Faith', 1, 'keyword'), tag('Crime Enthusiast', 1, 'audience')],
      { own: 2, rival: 1 },
    );
    expect(split.yours.map((t) => t.name)).toEqual(['Justice']);
    expect(split.rivals.map((t) => t.name)).toEqual(['Faith']);
  });

  it('counts a tag in the shared list as shared, even if a side leaves it out', () => {
    const split = topicOwnership([tag('Humour', 2)], [tag('Humour')], [tag('Faith', 1)], {
      own: 2,
      rival: 1,
    });
    expect(split.yours).toEqual([]);
    expect(split.shared.map((t) => t.name)).toEqual(['Humour']);
  });

  it('weighs against its own side when the rivals have no counts', () => {
    const split = topicOwnership([tag('A', 1), tag('B', 2)], [], [tag('C')], { own: 2, rival: 1 });
    expect(split.yours.map((t) => [t.name, t.weight])).toEqual([
      ['B', 1.33],
      ['A', 0.67],
    ]);
  });

  it('gives weight 0 when no side has counts', () => {
    expect(topicOwnership([tag('A')], [], [], { own: 1, rival: 1 }).yours[0]?.weight).toBe(0);
  });
});

describe('topicMap', () => {
  it('asks Qloo once with your anchors against the rivals', async () => {
    const fetch = stubFetch(
      jsonResponse({
        success: true,
        results: {
          tags: [tag('Humour')],
          a: [tag('Storytelling', 2), tag('Humour', 2)],
          b: [tag('Faith', 1), tag('Humour', 1)],
        },
      }),
    );
    const { data, receipts } = await tools.topicMap.run(context(), {
      entityIds: ['P1', 'P2'],
      rivalIds: ['R1'],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const params = new URL(String(fetch.mock.calls[0]?.[0])).searchParams;
    expect(params.get('a.signal.interests.entities')).toBe('P1,P2');
    expect(params.get('b.signal.interests.entities')).toBe('R1');
    const out = topicMapOutputSchema.parse(data);
    expect(out.yours.map((t) => t.name)).toEqual(['Storytelling']);
    expect(out.shared.map((t) => t.name)).toEqual(['Humour']);
    expect(out.rivals.map((t) => t.name)).toEqual(['Faith']);
    expect(receipts).toHaveLength(1);
  });
});
