import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, testClient } from '../qloo/fake-fetch';
import { tools } from './index';
import type { SeenEntity, ToolContext } from './tool';
import { topicMapOutputSchema, topicOwnership } from './topic-map';

function context(): ToolContext {
  return { qloo: testClient(), source: 'demo', entities: new Map<string, SeenEntity>() };
}

const tag = (name: string, count?: number, score?: number) => ({
  tag_id: `urn:tag:keyword:qloo:${name}`,
  name,
  query: {
    ...(count === undefined ? {} : { count: String(count) }),
    ...(score === undefined ? {} : { score }),
  },
});

afterEach(() => vi.unstubAllGlobals());

describe('topicOwnership', () => {
  it('calls a topic yours when only your side carries it, weighed against a typical rival topic', () => {
    // The rival topics average 3, so a topic your side counts 20 times weighs 6.67 of them.
    const split = topicOwnership(
      [tag('storytelling', 20), tag('money', 9)],
      [tag('humour', undefined, 0.5)],
      [tag('politics', 4), tag('faith', 3), tag('tech', 2)],
    );
    expect(split.yours).toEqual([
      { tagId: 'urn:tag:keyword:qloo:storytelling', name: 'storytelling', weight: 6.67 },
      { tagId: 'urn:tag:keyword:qloo:money', name: 'money', weight: 3 },
    ]);
    expect(split.shared.map((t) => t.name)).toEqual(['humour']);
    expect(split.rivals.map((t) => t.name)).toEqual(['politics', 'faith', 'tech']);
  });

  it('never calls a tag both sides carry yours', () => {
    const split = topicOwnership(
      [tag('humour', 10)],
      [tag('humour', undefined, 0.4)],
      [tag('faith', 1)],
    );
    expect(split.yours).toEqual([]);
    expect(split.shared.map((t) => t.name)).toEqual(['humour']);
  });

  it('weighs against its own side when the rivals have no counts', () => {
    const split = topicOwnership([tag('a', 10), tag('b', 20)], [], [tag('c')]);
    expect(split.yours.map((t) => [t.name, t.weight])).toEqual([
      ['b', 1.33],
      ['a', 0.67],
    ]);
  });

  it('gives weight 0 when no side has counts', () => {
    expect(topicOwnership([tag('a')], [], []).yours[0]?.weight).toBe(0);
  });
});

describe('topicMap', () => {
  it('asks Qloo once with your anchors against the rivals', async () => {
    const fetch = stubFetch(
      jsonResponse({
        success: true,
        results: {
          tags: [tag('humour', undefined, 0.5)],
          a: [tag('storytelling', 9)],
          b: [tag('faith', 4), tag('tech', 2)],
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
    expect(out.yours.map((t) => t.name)).toEqual(['storytelling']);
    expect(receipts).toHaveLength(1);
  });
});
