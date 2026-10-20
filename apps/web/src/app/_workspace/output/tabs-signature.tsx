'use client';

import type { LiftBand, Place } from '@oraqul/schema';
import { ChartCard, HBars, Legend, PairBars, type Tone, toneClass } from '../charts';
import { useOutputView } from './context';
import { ChangeMark, Evidence, FitBar, Line, Mark, Num, Stack, TabTitle } from './line';
import { FitRow } from './tabs-core';

const bandTone: Record<LiftBand, Tone> = { strong: 'good', usable: 'warn', weak: 'crit' };
const placeTone = (p: Place): Tone => (p.confidence === 'lower' ? 'na' : bandTone[p.band]);
const liftWidth = (lift: number) => (lift / 2) * 100;

const liftLegend = (
  <Legend
    items={[
      { tone: 'good', label: '✓ Strong, 1.5 and above' },
      { tone: 'warn', label: '◐ Usable, 1.2 to 1.5' },
      { tone: 'crit', label: '✕ Weak, below 1.2' },
      { tone: 'na', label: '◌ Thin data' },
    ]}
  />
);

function PlaceLine({ place, showDate }: { place: Place; showDate: boolean }) {
  return (
    <Line
      lineId={place.id}
      title={`${place.name}${showDate && place.date ? ` · ${place.date}` : ''}`}
      side={
        <>
          <Num>{place.lift.toFixed(1)}x</Num>
          <Evidence lineId={place.id} />
        </>
      }
    >
      <p>Audience: {place.audience}</p>
      <p>{place.note}</p>
    </Line>
  );
}

const placeBars = (places: Place[], label: (p: Place, i: number) => string) =>
  places.map((p, i) => ({
    label: label(p, i),
    value: `${p.lift.toFixed(1)}x`,
    width: liftWidth(p.lift),
    tone: placeTone(p),
    tip: `${p.name}: lift ${p.lift.toFixed(1)}x`,
  }));

export function TerritoriesTab() {
  const { output } = useOutputView();
  const places = output.brief.places.slice().sort((a, b) => b.lift - a.lift);
  return (
    <>
      <TabTitle
        title="Territories"
        note="One plan per territory, each with its own date and audience. The ladder shows lift over a neutral audience."
      />
      <ChartCard
        title="Territory ladder"
        note="Above 1.5 is strong, 1.2 to 1.5 usable, below 1.2 weak. Grey means thin data."
        table={{
          head: ['Territory', 'Lift', 'Opens', 'Confidence'],
          rows: places.map((p) => [
            p.name,
            `${p.lift.toFixed(1)}x`,
            p.date ?? 'To be set',
            p.confidence,
          ]),
        }}
      >
        <HBars items={placeBars(places, (p) => p.name)} />
        {liftLegend}
      </ChartCard>
      <Stack>
        {places.map((p) => (
          <PlaceLine key={p.id} place={p} showDate />
        ))}
      </Stack>
    </>
  );
}

export function RouteTab() {
  const { output } = useOutputView();
  const b = output.brief;
  const route = b.route;
  return (
    <>
      <TabTitle
        title="Tour route"
        note="Stops in the order of the plan. Earlier stops count more. Lift shows audience fit for each city. Venue size and ticket demand are not forecast."
      />
      <section className="rounded-2xl bg-card px-5 py-[18px]">
        <h3 className="font-display text-[15px] font-semibold">Route in order</h3>
        <p className="mb-3 text-[13px] text-muted">
          The colour of each stop is its fit. Grey means thin data.
        </p>
        <div role="img" aria-label="Tour route" className="flex overflow-x-auto py-1.5">
          {b.places.map((p, i) => (
            <div
              key={p.id}
              className="relative flex min-w-[104px] flex-1 flex-col items-center gap-1 text-center text-[13px] before:absolute before:top-[22px] before:left-[-50%] before:h-0.5 before:w-full before:bg-line first:before:hidden"
            >
              <span
                data-tip={`${p.name}: lift ${p.lift.toFixed(1)}x`}
                className={`relative z-10 grid size-[46px] place-items-center rounded-full border-[3px] border-card font-mono text-[13px] font-semibold text-bg ${toneClass[placeTone(p)]}`}
              >
                {p.lift.toFixed(1)}
              </span>
              <b>
                {i + 1}. {p.name}
              </b>
              <small className="text-muted">{p.date ?? ''}</small>
              <ChangeMark lineId={p.id} />
            </div>
          ))}
        </div>
        {liftLegend}
      </section>
      {route ? (
        <div className="flex flex-wrap gap-3.5">
          <Tile
            label="Route score"
            value={`${route.score.toFixed(2)}x`}
            note="weighted by position"
          />
          <Tile
            label="Best order by lift"
            value={`${route.bestScore.toFixed(2)}x`}
            note={route.isBestOrder ? 'This is already the best order' : route.bestOrder.join(', ')}
          />
        </div>
      ) : null}
      <ChartCard
        title="Lift by stop"
        table={{
          head: ['Stop', 'Lift', 'Date', 'Confidence'],
          rows: b.places.map((p, i) => [
            `${i + 1}. ${p.name}`,
            `${p.lift.toFixed(1)}x`,
            p.date ?? '',
            p.confidence,
          ]),
        }}
      >
        <HBars items={placeBars(b.places, (p) => p.name)} />
      </ChartCard>
      <Stack>
        {b.places.map((p) => (
          <PlaceLine key={p.id} place={p} showDate />
        ))}
      </Stack>
    </>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col rounded-2xl bg-card px-[18px] py-3.5">
      <span className="text-[13px] text-muted">{label}</span>
      <b className="text-[28px] font-semibold tracking-[-0.02em] tabular-nums">{value}</b>
      <span className="text-[13px] text-muted">{note}</span>
    </div>
  );
}

const heatClass = [
  'bg-surface2',
  'bg-accent-soft',
  'bg-[color-mix(in_srgb,var(--accent)_55%,var(--surface))]',
  'bg-accent text-accent-ink',
];

export function SupportActsTab() {
  const { output } = useOutputView();
  const g = output.brief.grid;
  if (!g) return null;
  const best = g.rows.find((r) => r.id === g.bestRowId);
  return (
    <>
      <TabTitle
        title="Support acts"
        note="Lift for each act in each route city, from one ranking call. Darker means a stronger fit."
      />
      <ChartCard
        title="Support act fit by city"
        note={
          best
            ? `${best.name} averages ${best.average.toFixed(2)}x across these cities.`
            : undefined
        }
        table={{
          head: ['Act', ...g.cities, 'Average'],
          rows: g.rows.map((r) => [
            r.name,
            ...r.lifts.map((v) => v.toFixed(1)),
            r.average.toFixed(2),
          ]),
        }}
      >
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[420px] items-center gap-1.5 text-[13px]"
            style={{
              gridTemplateColumns: `minmax(150px,1.2fr) repeat(${g.cities.length}, minmax(64px,1fr)) 70px`,
            }}
          >
            <span />
            {g.cities.map((c) => (
              <span key={c} className="text-center text-xs text-muted">
                {c}
              </span>
            ))}
            <span className="text-center text-xs text-muted">Average</span>
            {g.rows.map((r) => (
              <HeatRow key={r.id} row={r} cities={g.cities} />
            ))}
          </div>
        </div>
      </ChartCard>
      <Stack>
        {g.rows.map((r) => (
          <Line
            key={r.id}
            lineId={r.id}
            title={r.name}
            tags={<Mark>{r.tag}</Mark>}
            side={
              <>
                <Num>{r.average.toFixed(2)}x</Num>
                <Evidence lineId={r.id} />
              </>
            }
          >
            <p>Lift {r.lifts.map((v, i) => `${g.cities[i] ?? ''} ${v.toFixed(1)}`).join(', ')}</p>
          </Line>
        ))}
      </Stack>
    </>
  );
}

function HeatRow({
  row,
  cities,
}: {
  row: { name: string; tag: string; lifts: number[]; levels: number[]; average: number };
  cities: string[];
}) {
  const suggested = /^Suggested|^Chosen/.test(row.tag);
  return (
    <>
      <div>
        <b>{row.name}</b>
        <div className={`text-[11px] ${suggested ? 'font-semibold text-accent' : 'text-muted'}`}>
          {row.tag}
        </div>
      </div>
      {row.lifts.map((v, i) => (
        <span
          key={cities[i] ?? i}
          data-tip={`${row.name}: ${v.toFixed(1)}x`}
          className={`rounded-md px-1.5 py-2.5 text-center font-mono text-[13px] ${heatClass[row.levels[i] ?? 0]}`}
        >
          {v.toFixed(1)}
        </span>
      ))}
      <span className="text-center font-mono font-semibold">{row.average.toFixed(2)}</span>
    </>
  );
}

export function ShelfTab() {
  const { output, change } = useOutputView();
  const shelf = (output.brief.shelf ?? []).slice().sort((a, b) => b.overlap - a.overlap);
  return (
    <>
      <TabTitle
        title="Comp shelf"
        note="How much each comparable title's readers overlap with your readers. The closest comps are the ones to pitch against."
      />
      <ChartCard
        title="Reader overlap with each comp"
        note="Share of readers who also read your book, from the taste data."
        table={{
          head: ['Comp', 'Overlap', 'Evidence'],
          rows: shelf.map((s) => [s.name, s.overlap, s.evidence]),
        }}
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
          {shelf.map((s) => (
            <div
              key={s.id}
              className={`flex flex-col gap-1.5 rounded-xl border p-2.5 ${change(s.id) ? 'border-accent/40 bg-accent-soft' : 'border-transparent bg-inset'}`}
            >
              <div className="flex h-[88px] items-end rounded-md bg-surface2 p-2.5 font-display text-[15px] leading-tight font-semibold">
                {s.name}
              </div>
              <FitBar value={s.overlap} />
              <span className="font-mono text-xs text-muted">
                {s.overlap} percent <ChangeMark lineId={s.id} />
              </span>
              <Evidence lineId={s.id} confidence={false} />
            </div>
          ))}
        </div>
      </ChartCard>
      <Stack>
        {shelf.map((s) => (
          <Line
            key={s.id}
            lineId={s.id}
            title={s.name}
            side={
              <>
                <Num>{s.overlap}</Num>
                <Evidence lineId={s.id} />
              </>
            }
          >
            <p>
              {s.evidence}
              {s.overlap < 50 ? '. Not recommended as a pitch comp.' : ''}
            </p>
          </Line>
        ))}
      </Stack>
    </>
  );
}

const mediumTone: Record<string, Tone> = { Series: 'series', Film: 'series2', Podcast: 'good' };

export function BridgeTab() {
  const { output } = useOutputView();
  const bridge = (output.brief.bridge ?? []).slice().sort((a, b) => b.fit - a.fit);
  const media = ['Series', 'Film', 'Podcast'].filter((m) => bridge.some((x) => x.medium === m));
  return (
    <>
      <TabTitle
        title="Adaptation bridge"
        note="Readers of the book also watch and listen to these titles. They give the pitch angles for screen and audio."
      />
      <ChartCard
        title="Reader overlap by screen and audio title"
        note="Grouped by medium. Higher means more of your readers also use the title."
        table={{
          head: ['Title', 'Medium', 'Overlap'],
          rows: bridge.map((x) => [x.name, x.medium ?? '', x.fit]),
        }}
      >
        <HBars
          items={bridge.map((x) => ({
            label: `${x.name} (${x.medium ?? ''})`,
            value: String(x.fit),
            width: x.fit,
            tone: mediumTone[x.medium ?? ''] ?? 'series',
            tip: `${x.name}: ${x.fit}`,
          }))}
        />
        <Legend items={media.map((m) => ({ tone: mediumTone[m] ?? 'series', label: m }))} />
      </ChartCard>
      <Stack>
        {bridge.map((x) => (
          <FitRow key={x.id} line={x} />
        ))}
      </Stack>
    </>
  );
}

export function TopicsTab() {
  const { output } = useOutputView();
  const topics = output.brief.topics ?? [];
  const tag = (t: (typeof topics)[number]) => (
    <span
      key={t.id}
      data-tip={`${t.name}: ${t.evidence}`}
      style={{ fontSize: `${Math.min(13 + t.weight * 2, 22)}px` }}
      className={`rounded-full px-3.5 py-1 ${t.ownership === 'distinct' ? 'bg-accent-soft font-semibold' : 'bg-surface2'}`}
    >
      {t.name}
      <ChangeMark lineId={t.id} />
    </span>
  );
  return (
    <>
      <TabTitle
        title="Topic map"
        note="What your listeners like, against what rival shows already own. Build the show around the tags only you have."
      />
      <ChartCard
        title="Topics against rival shows"
        note="Larger means a stronger tag weight. Filled means rivals do not own it."
        table={{
          head: ['Topic', 'Kind', 'Weight', 'Evidence'],
          rows: topics.map((t) => [
            t.name,
            t.ownership === 'distinct' ? 'Only yours' : 'Shared',
            t.weight,
            t.evidence,
          ]),
        }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <span className="w-full flex-none text-xs font-semibold text-muted min-[900px]:w-[150px]">
            Only yours
          </span>
          {topics.filter((t) => t.ownership === 'distinct').map(tag)}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="w-full flex-none text-xs font-semibold text-muted min-[900px]:w-[150px]">
            Shared with rival shows
          </span>
          {topics.filter((t) => t.ownership === 'shared').map(tag)}
        </div>
      </ChartCard>
      <Stack>
        {topics.map((t) => (
          <Line
            key={t.id}
            lineId={t.id}
            title={t.name}
            tags={<Mark>{t.ownership === 'distinct' ? 'Only yours' : 'Shared with rivals'}</Mark>}
            side={
              <>
                <Num>{t.weight}x</Num>
                <Evidence lineId={t.id} />
              </>
            }
          >
            <p>{t.evidence}</p>
          </Line>
        ))}
      </Stack>
    </>
  );
}

export function FanBaseTab() {
  const { output } = useOutputView();
  const fan = output.brief.fan ?? [];
  const moved = fan.some((g) => g.before !== g.after);
  // A row says which kind of media it is. Overlap is scored within one kind, so rows are grouped
  // in that order and never ranked across kinds.
  const label = (g: (typeof fan)[number]) =>
    g.medium ? `${g.medium.charAt(0).toUpperCase()}${g.medium.slice(1)} · ${g.name}` : g.name;
  // The API names the tab. A category with its own words for it (Podcasts: a swap list) says them.
  const tab = output.tabs.find((t) => t.key === 'fanbase');
  const own = tab !== undefined && tab.label !== 'Fan base bridge';
  const row = own ? 'Show' : 'Fan base';
  return (
    <>
      <TabTitle
        title={own ? tab.label : 'Fan base bridge'}
        note={
          own
            ? tab.note
            : 'How much the people who follow other media overlap with your players. Compare rows within one kind of media, never across.'
        }
      />
      <ChartCard
        title={own ? 'Overlap with your listeners' : 'Overlap with other fan bases'}
        note={
          moved
            ? 'Grey is before the change, blue is after.'
            : own
              ? 'Out of 100. Your pick is marked beside its row.'
              : 'Out of 100. Your collab is marked beside its row.'
        }
        table={{
          head: moved ? [row, 'Before', 'After'] : [row, 'Overlap'],
          rows: fan.map((g) => (moved ? [label(g), g.before, g.after] : [label(g), g.after])),
        }}
      >
        {moved ? (
          <PairBars
            items={fan.map((g) => ({ label: label(g), a: g.before, b: g.after }))}
            nameA="Before"
            nameB="After"
          />
        ) : (
          <HBars
            items={fan.map((g) => ({
              label: g.note ? `${label(g)} (${g.note.toLowerCase()})` : label(g),
              value: String(g.after),
              width: g.after,
              tone: g.note ? 'series2' : 'series',
              tip: `${label(g)}: ${g.after} of 100`,
            }))}
          />
        )}
      </ChartCard>
      <Stack>
        {fan.map((g) => (
          <Line
            key={g.id}
            lineId={g.id}
            title={g.name}
            side={
              <>
                <Num>{g.before === g.after ? g.after : `${g.before} to ${g.after}`}</Num>
                <Evidence lineId={g.id} />
              </>
            }
          >
            <p>
              {g.evidence}
              {g.note ? `. ${g.note}` : ''}
            </p>
          </Line>
        ))}
      </Stack>
    </>
  );
}

export function RegionsTab() {
  const { output } = useOutputView();
  const places = output.brief.places;
  const sorted = places.slice().sort((a, b) => b.lift - a.lift);
  const lead = places[0];
  const top = sorted[0];
  // The API names the tab: a category that says markets instead of regions (Podcasts) says so.
  const noun =
    output.tabs.find((t) => t.key === 'regions')?.label === 'Markets' ? 'market' : 'region';
  const Noun = `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
  return (
    <>
      <TabTitle
        title={`${Noun}s`}
        note={`${Noun}s ranked by lift over a neutral audience. The plan names a lead ${noun}. Oraqul checks it against the ranking.`}
      />
      <div className="flex flex-wrap gap-3.5">
        <Tile
          label={`Planned lead ${noun}`}
          value={lead?.name ?? 'None'}
          note={
            lead
              ? `ranks ${sorted.findIndex((x) => x.id === lead.id) + 1} of ${sorted.length} by lift`
              : ''
          }
        />
        <Tile
          label="Highest lift"
          value={top?.name ?? 'None'}
          note={top ? `${top.lift.toFixed(1)}x` : ''}
        />
      </div>
      <ChartCard
        title={`${Noun} ranking`}
        note="Above 1.5 is strong, 1.2 to 1.5 usable, below 1.2 weak."
        table={{
          head: [Noun, 'Lift', 'Confidence'],
          rows: sorted.map((p) => [p.name, `${p.lift.toFixed(1)}x`, p.confidence]),
        }}
      >
        <HBars
          items={placeBars(
            sorted,
            (p, i) => `${i + 1}. ${p.name}${lead && p.id === lead.id ? ' (planned lead)' : ''}`,
          )}
        />
        {liftLegend}
      </ChartCard>
      <Stack>
        {sorted.map((p) => (
          <PlaceLine key={p.id} place={p} showDate={false} />
        ))}
      </Stack>
    </>
  );
}
