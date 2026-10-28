'use client';

import type { LiftBand, Place } from '@oraqul/schema';
import { ReceiptChip } from '@oraqul/ui';
import { ChartCard, HBars, Legend, PairBars, type Tone, toneClass } from '../charts';
import { useOutputView } from './context';
import { ChangeMark, Evidence, FitBar, Line, Mark, Num, Stack, TabTitle } from './line';
import { footnotesOf, LineText } from './plan-document';
import { type SupportGridView, supportActsOf, territoriesOf } from './plan-views';
import { FitRow } from './tabs-core';
import { StructuredTerritories } from './tabs-launch';

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
  if (output.plan && output.plan.territories.length > 0) return <StructuredTerritories />;
  if (output.plan) return <TerritoryPlans />;
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
  // The stops in the order the team plays them. A plan ranks places by lift, so its list is not
  // the route; older outputs have no order and keep the list as it is.
  const byName = new Map(b.places.map((p) => [p.name.toLowerCase(), p]));
  const stops = (route?.order ?? []).flatMap((n) => byName.get(n.toLowerCase()) ?? []);
  const places = stops.length >= 2 ? stops : b.places;
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
          {places.map((p, i) => (
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
          rows: places.map((p, i) => [
            `${i + 1}. ${p.name}`,
            `${p.lift.toFixed(1)}x`,
            p.date ?? '',
            p.confidence,
          ]),
        }}
      >
        <HBars items={placeBars(places, (p) => p.name)} />
      </ChartCard>
      <Stack>
        {places.map((p) => (
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
  if (!g) return output.plan ? <SupportActsFromFindings /> : null;
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
        note="The recent books your readers pick up, ranked by how close their readers are to yours. The closest are the comps to pitch against."
      />
      <ChartCard
        title="Reader overlap with each comp"
        note="Out of 100, from one list of books. Compare rows only with each other."
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
              <div className="flex min-h-[88px] items-end rounded-md bg-surface2 p-2.5 font-display break-words text-[15px] leading-tight font-semibold">
                {s.name}
              </div>
              <FitBar value={s.overlap} />
              <span className="font-mono text-xs text-muted">
                {s.overlap} of 100 <ChangeMark lineId={s.id} />
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
            <p>{s.evidence}</p>
          </Line>
        ))}
      </Stack>
    </>
  );
}

const mediumTone: Record<string, Tone> = { Series: 'series', Film: 'series2', Podcast: 'good' };
const mediumOrder = ['Series', 'Film', 'Podcast'];

export function BridgeTab() {
  const { output } = useOutputView();
  // Overlap is scored within one kind of media, so rows are grouped by medium and ranked only
  // inside their group, never across.
  const bridge = (output.brief.bridge ?? []).slice().sort((a, b) => {
    const kind = mediumOrder.indexOf(a.medium ?? '') - mediumOrder.indexOf(b.medium ?? '');
    return kind || b.fit - a.fit;
  });
  const media = mediumOrder.filter((m) => bridge.some((x) => x.medium === m));
  return (
    <>
      <TabTitle
        title="Adaptation bridge"
        note="The series, films and podcasts your readers also follow. They give the pitch angles for screen and audio. Compare rows within one kind of media, never across."
      />
      <ChartCard
        title="Reader overlap by screen and audio title"
        note="Grouped by medium. Out of 100: higher means more of your readers also use the title."
        table={{
          head: ['Title', 'Medium', 'Overlap'],
          rows: bridge.map((x) => [x.name, x.medium ?? '', x.fit]),
        }}
      >
        <HBars
          items={bridge.map((x) => ({
            label: `${x.medium ? `${x.medium} · ` : ''}${x.name}${x.note ? ` (${x.note.toLowerCase()})` : ''}`,
            value: String(x.fit),
            width: x.fit,
            tone: mediumTone[x.medium ?? ''] ?? 'series',
            tip: `${x.name}: ${x.fit} of 100`,
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

const placeNote = (p: Place) =>
  p.confidence === 'lower'
    ? 'Thin data'
    : { strong: 'Strong', usable: 'Usable', weak: 'Weak' }[p.band];

/**
 * One plan per territory. Each is the plan's own lines for that city, with the findings Qloo
 * returned for it behind them, so the order to open in and what to do in each place read together.
 */
function TerritoryPlans() {
  const { output, openReceipt } = useOutputView();
  const plan = output.plan;
  if (!plan) return null;
  const territories = territoriesOf(plan, output.brief.places);
  const notes = footnotesOf(plan.sections.flatMap((s) => s.lines));
  return (
    <>
      <TabTitle
        title="Territories"
        note="One plan per territory, in the order the audience is strongest. Each has the lines of the plan that are about it."
      />
      <Stack>
        {territories.map((t) => (
          <section
            key={t.place.id}
            aria-labelledby={`territory-${t.place.id}`}
            className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-[18px]"
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3
                id={`territory-${t.place.id}`}
                className="font-display text-[17px] font-semibold tracking-[-0.02em]"
              >
                {t.rank}. {t.place.name}
                {t.rank === 1 ? <Mark>Open here first</Mark> : null}
                {t.place.date ? <Mark>{t.place.date}</Mark> : null}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Num>{t.place.lift.toFixed(1)}x</Num>
                <span className="text-[13px] text-muted">{placeNote(t.place)}</span>
                <Evidence lineId={t.place.id} />
              </div>
            </header>
            {t.parts.length === 0 ? (
              <p className="text-[13px] text-muted">
                The plan has no lines about {t.place.name} yet. Ask for a plan for this territory in
                the chat.
              </p>
            ) : (
              t.parts.map((part) => (
                <div key={part.section} className="flex flex-col gap-1.5">
                  <h4 className="text-[12px] font-semibold text-muted">{part.section}</h4>
                  <ul className="font-read flex flex-col gap-1.5 text-[15px] leading-[1.55]">
                    {part.lines.map((line) => (
                      <li key={line.id}>
                        <LineText
                          line={line}
                          notes={notes}
                          sources={plan.sources}
                          onSource={(id) => openReceipt(id)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        ))}
      </Stack>
    </>
  );
}

/** The support acts a plan's findings list, city by city. Values are Qloo's affinity, not a lift. */
function SupportActsFromFindings() {
  const { output, openReceipt } = useOutputView();
  const grid: SupportGridView | null = output.plan ? supportActsOf(output.plan) : null;
  if (!grid) return null;
  const best = grid.rows[0];
  return (
    <>
      <TabTitle
        title="Support acts"
        note="The acts Qloo ranks highest with your audience in each tour city, with your sound-alikes left out. Darker means a stronger match. A dash means that city's list left the act out."
      />
      <ChartCard
        title="Support act match by city"
        note={
          best
            ? `${best.name} is listed in the most cities, with an average match of ${best.average} out of 100.`
            : undefined
        }
        table={{
          head: ['Act', ...grid.cities, 'Average'],
          rows: grid.rows.map((r) => [r.name, ...r.values.map((v) => v ?? '–'), r.average]),
        }}
      >
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[420px] items-center gap-1.5 text-[13px]"
            style={{
              gridTemplateColumns: `minmax(150px,1.2fr) repeat(${grid.cities.length}, minmax(64px,1fr)) 70px`,
            }}
          >
            <span />
            {grid.cities.map((c) => (
              <span key={c} className="text-center text-xs text-muted">
                {c}
              </span>
            ))}
            <span className="text-center text-xs text-muted">Average</span>
            {grid.rows.map((r) => (
              <FindingsRow key={r.name} row={r} cities={grid.cities} />
            ))}
          </div>
        </div>
      </ChartCard>
      <Stack>
        {grid.rows.map((r) => (
          <Line
            key={r.name}
            title={r.name}
            side={
              <>
                <Num>{r.average}</Num>
                <ReceiptChip
                  onClick={() => r.findingIds[0] && openReceipt(r.findingIds[0])}
                  aria-label="Open receipt"
                />
              </>
            }
          >
            <p>
              Match{' '}
              {r.values
                .map((v, i) => (v === null ? null : `${grid.cities[i] ?? ''} ${v}`))
                .filter(Boolean)
                .join(', ')}
            </p>
          </Line>
        ))}
      </Stack>
    </>
  );
}

function FindingsRow({ row, cities }: { row: SupportGridView['rows'][number]; cities: string[] }) {
  return (
    <>
      <b>{row.name}</b>
      {row.values.map((v, i) => (
        <span
          key={cities[i] ?? i}
          data-tip={v === null ? `${row.name}: not in this city's list` : `${row.name}: ${v}`}
          className={`rounded-md px-1.5 py-2.5 text-center font-mono text-[13px] ${v === null ? 'text-muted' : heatClass[row.levels[i] ?? 0]}`}
        >
          {v ?? '–'}
        </span>
      ))}
      <span className="text-center font-mono font-semibold">{row.average}</span>
    </>
  );
}
