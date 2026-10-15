import type {
  Category,
  Project,
  QuestionAnswer,
  QuestionCard,
  StartMode,
  Thread,
} from '@oraqul/schema';
import { categories } from '@oraqul/schema';
import { dedupe, defSplit, diffIds, gaps, splitList } from './brief';
import { compareBriefs, type DOutput, isPlanKind } from './build-output';
import { uuidFrom } from './ids';
import { PACKS } from './packs';
import {
  douts,
  getState,
  insertOutput,
  insertProject,
  insertThread,
  patchItem,
  patchProject,
  patchThread,
  pushItem,
  setBusy,
} from './store';
import type { DBrief, DemoPack, DResultsInput } from './types';

// The scripted agent: each flow asks question cards, runs a trace and ends in an output, the way
// the real runtime will over SSE. Answers go back through `answerQuestion`.

type Handler = (answer: QuestionAnswer) => void;
const handlers = new Map<string, Handler>();
const startModes = new Map<string, StartMode>();
const resultsAttached = new Set<string>();

let seq = 0;
let clock: () => string = () => new Date().toISOString();
let actor = 'You';

/** First name used for "by" on threads and outputs made in this session. */
export function setActor(name: string): void {
  actor = name.split(' ')[0] || name;
}

const itemId = (): string => `item-${++seq}`;

const project = (id: string): Project => {
  const p = getState().projects.find((x) => x.id === id);
  if (!p) throw new Error(`No project ${id}`);
  return p;
};
const thread = (id: string): Thread => {
  const t = getState().threads.find((x) => x.id === id);
  if (!t) throw new Error(`No thread ${id}`);
  return t;
};
const pack = (r: Project): DemoPack => PACKS[r.category];

function planOutputs(projectId: string): DOutput[] {
  return getState()
    .outputs.filter((o) => o.projectId === projectId && isPlanKind(o.kind))
    .map((o) => douts.get(o.id))
    .filter((o): o is DOutput => o !== undefined);
}
const latestPlan = (projectId: string): DOutput | undefined => planOutputs(projectId).at(-1);
const labelOf = (outputId: string): string =>
  getState().outputs.find((o) => o.id === outputId)?.label ?? 'the plan';

export function mkThread(
  r: Project,
  name: string,
  base: string | null,
  by = actor,
  at = clock(),
  key = `thread:${++seq}`,
): Thread {
  const t: Thread = {
    id: uuidFrom(key),
    projectId: r.id,
    name,
    createdBy: by,
    createdAt: at,
    baseOutputId: base,
    fromOutputId: base,
    fresh: false,
  };
  insertThread(t);
  return t;
}

export function mkOut(
  r: Project,
  t: Thread,
  kind: DOutput['kind'],
  title: string,
  brief: DBrief,
  extra: Partial<
    Pick<DOutput, 'parentId' | 'ofId' | 'changed' | 'focusIds' | 'src' | 'by' | 'at'>
  > = {},
  key = `output:${++seq}`,
): DOutput {
  const o: DOutput = {
    id: uuidFrom(key),
    projectId: r.id,
    threadId: t.id,
    kind,
    title,
    by: extra.by ?? actor,
    at: extra.at ?? clock(),
    brief,
    parentId: extra.parentId ?? null,
    ofId: extra.ofId ?? null,
    changed: extra.changed ?? [],
    focusIds: extra.focusIds ?? [],
    src: extra.src,
  };
  insertOutput(o);
  return o;
}

export function say(threadId: string, text: string): void {
  pushItem(threadId, { id: itemId(), role: 'agent', text });
}

type CardWithoutId = QuestionCard extends infer Q
  ? Q extends unknown
    ? Omit<Q, 'id'>
    : never
  : never;

function ask(threadId: string, question: CardWithoutId, handler: Handler): void {
  const id = itemId();
  handlers.set(id, handler);
  pushItem(threadId, { id, role: 'question', question: { ...question, id }, answer: null });
}

function options(list: { v: string; l: string; d?: string }[]) {
  return list.map((o) => ({ id: o.v, label: o.l, description: o.d }));
}

function runTrace(threadId: string, steps: string[], done: () => void): void {
  const id = itemId();
  setBusy(threadId, true);
  pushItem(threadId, { id, role: 'trace', steps, done: 0 });
  let shown = 0;
  const tick = () => {
    if (shown < steps.length) {
      shown++;
      patchItem(threadId, id, (x) => (x.role === 'trace' ? { ...x, done: shown } : x));
      setTimeout(tick, 380);
      return;
    }
    setBusy(threadId, false);
    done();
  };
  setTimeout(tick, 380);
}

function finish(threadId: string, o: DOutput, lead?: string): void {
  const out = getState().outputs.find((x) => x.id === o.id);
  say(threadId, lead ?? out?.summary ?? '');
  pushItem(threadId, { id: itemId(), role: 'output', outputId: o.id });
}

function rename(t: Thread, name: string): void {
  const current = thread(t.id);
  const hasOutput = getState().outputs.some((o) => o.threadId === t.id);
  if (current.name === 'New thread' || (current.name === 'First plan' && !hasOutput)) {
    patchThread(t.id, { name });
  }
}

function baseOf(t: Thread): DOutput | undefined {
  const current = thread(t.id);
  return (
    (current.baseOutputId ? douts.get(current.baseOutputId) : undefined) ??
    latestPlan(current.projectId)
  );
}

function needBase(t: Thread): DOutput | undefined {
  const b = baseOf(t);
  if (!b) say(t.id, 'I need a plan first. Tell me about the project and I will build one.');
  return b;
}

/** Answers an open question card. Returns false if the card was already answered. */
export function answerQuestion(threadId: string, id: string, answer: QuestionAnswer): boolean {
  const handler = handlers.get(id);
  const item = getState().items[threadId]?.find((x) => x.id === id);
  if (!handler || !item || item.role !== 'question' || item.answer !== null) return false;
  handlers.delete(id);
  patchItem(threadId, id, (x) =>
    x.role === 'question' ? { ...x, answer: answerLabel(x.question, answer) } : x,
  );
  handler(answer);
  return true;
}

function answerLabel(q: QuestionCard, a: QuestionAnswer): string {
  switch (a.card) {
    case 'options': {
      const opts = 'options' in q ? q.options : [];
      return a.optionIds.map((id) => opts.find((o) => o.id === id)?.label ?? id).join(', ');
    }
    case 'text':
      return a.text;
    case 'attachments':
      return `Attached: ${a.names.join(', ')}`;
    case 'split':
      return q.card === 'split'
        ? q.split.groups.map((g, i) => `${g} ${a.values[i] ?? 0}%`).join(', ')
        : '';
    case 'date':
      return prettyDate(a.value);
    case 'file':
      return `Read ${a.name}`;
    case 'alt':
      return q.card === 'file' ? (q.altLabel ?? '') : '';
    case 'confirm':
      if (q.card !== 'confirm') return '';
      return `${q.rows.map((x) => x.value).join('. ')}. ${q.primary.title} ${a.primary.join(', ')}${
        a.secondary && q.secondary ? `. ${q.secondary.title} ${a.secondary.join(', ')}` : ''
      }.`;
  }
}

const firstOption = (a: QuestionAnswer): string =>
  a.card === 'options' ? (a.optionIds[0] ?? '') : '';
const textOf = (a: QuestionAnswer): string => (a.card === 'text' ? a.text : '');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function prettyDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const month = MONTHS[Number.parseInt(m ?? '', 10) - 1];
  return month && d ? `${month} ${Number.parseInt(d, 10)}` : 'Oct 2';
}

const MODE_READ: Record<StartMode, string> = {
  start: 'a new plan',
  audit: 'a check of the plan you have',
  rescue: 'a rescue after results',
};

/** What a person would type to switch to the job the agent did not pick. */
const MODE_FIX: Record<StartMode, string> = {
  start: 'check my plan instead',
  audit: 'plan from scratch instead',
  rescue: 'plan from scratch instead',
};

const GENRES: Record<Category, [RegExp, string][]> = {
  film: [
    [/horror|haunt/, 'Horror'],
    [/comedy|wedding/, 'Comedy'],
    [/crime/, 'Crime drama'],
    [/drama/, 'Drama'],
  ],
  music: [
    [/indie ?pop/, 'Indie pop'],
    [/alte|soul/, 'Dream pop'],
    [/hip ?hop|rap/, 'Hip hop'],
    [/pop/, 'Pop'],
    [/rock/, 'Rock'],
  ],
  books: [
    [/thriller/, 'Literary thriller'],
    [/romance/, 'Romance'],
    [/fantasy/, 'Fantasy'],
    [/memoir/, 'Memoir'],
    [/literary/, 'Literary fiction'],
  ],
  podcasts: [
    [/food|cook|kitchen/, 'Food and travel stories'],
    [/true crime|crime/, 'True crime'],
    [/comedy/, 'Comedy'],
    [/business|money/, 'Business'],
    [/news/, 'News'],
  ],
  games: [
    [/survival|craft/, 'Survival crafting'],
    [/rpg|role/, 'Role playing'],
    [/puzzle/, 'Puzzle'],
    [/racing/, 'Racing'],
    [/horror/, 'Horror'],
  ],
};

const KINDS_RX: Record<Category, [RegExp, string][]> = {
  film: [[/series|season|episode|six part|premier/, 'Series']],
  music: [
    [/\bep\b/, 'EP'],
    [/single/, 'Single'],
    [/album/, 'Album'],
    [/tour|dates|shows/, 'Tour'],
  ],
  books: [
    [/non.?fiction|memoir/, 'Non fiction'],
    [/debut/, 'Debut'],
    [/series/, 'Series book'],
  ],
  podcasts: [
    [/season (two|2)/, 'Season two'],
    [/relaunch/, 'Relaunch'],
    [/season/, 'Season launch'],
  ],
  games: [
    [/story/, 'Story game'],
    [/mobile/, 'Mobile game'],
    [/live service/, 'Live service'],
  ],
};

const PLACE_RX: Record<string, RegExp> = {
  UK: /\buk\b|britain|british|united kingdom|england|scotland/i,
  US: /\bUS\b|\bUSA\b|united states|america|u\.s\./,
  Canada: /canada|canadian/i,
  Mexico: /mexico|mexican|guadalajara/i,
  Germany: /german|berlin/i,
  Brazil: /brazil|sao paulo/i,
  Japan: /japan|tokyo/i,
  London: /london/i,
  Austin: /austin/i,
  Toronto: /toronto/i,
  'Mexico City': /mexico city|cdmx/i,
  Chicago: /chicago/i,
  Seoul: /seoul/i,
};

function detectPlaces(category: Category, text: string): string[] {
  const opts = [...PACKS[category].placeOpts, ...(category === 'music' ? ['Seoul'] : [])];
  return opts.filter((p) => PLACE_RX[p]?.test(text));
}

function detectMode(text: string, attached: string[]): StartMode {
  const t = text.toLowerCase();
  const resultsFile = attached.some((a) =>
    /result|streams|preorder|pre-order|wishlist|dashboard|download/.test(a),
  );
  const resultsText =
    /(opened to|opening weekend|audience split|premiere week|box office|we opened|we sold|launched to|first week|pre.?orders were|wishlists? were|downloads were|sold out)/.test(
      t,
    ) && /\d/.test(t);
  if (resultsFile || resultsText) return 'rescue';
  if (
    attached.some((a) => /plan/.test(a)) ||
    /(marketing plan|our plan|we plan|we have planned|campaign plan|launch plan|tour plan|growth plan)/.test(
      t,
    )
  ) {
    return 'audit';
  }
  return 'start';
}

/**
 * What the first message carries. `text` is what a file could be read as. `mode` is the job the
 * person hinted at, or null to let the agent read it from the message.
 */
export interface FirstMessage {
  mode: StartMode | null;
  category: Category | null;
  text: string;
  files: { name: string; text?: string }[];
}

// Checked in order, so the narrower words win: "season" alone is a series, a podcast says so.
const CATEGORY_RX: [RegExp, Category][] = [
  [/podcast|episodes?\b|listeners?|downloads/, 'podcasts'],
  [/\bgames?\b|steam|players?\b|wishlists?|console|playtest/, 'games'],
  [/\bbooks?\b|novel|memoir|author|publish|pre.?orders?|imprint|readers?\b/, 'books'],
  [/album|\bep\b|\bsingle\b|\btour\b|artist|\bband\b|streams|songs?\b|indie ?pop|gigs?\b/, 'music'],
  [/film|movie|series|cinema|screen|festival|box office|distribut|season/, 'film'],
];

const RESULTS_FILE =
  /result|stream|sales|download|wishlist|ticket|pre.?order|dashboard|\.csv$|\.xlsx?$/i;

const titleCase = (text: string): string => text.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** A working title from the start of some text. Long sentences give none. */
function titleIn(text: string): string | undefined {
  const quoted = text.match(/["“]([^"”]{2,60})["”]/)?.[1];
  if (quoted) return quoted.trim();
  const clause = (text.split(/[\n.,;:!?]|\s[-–—]\s/)[0] ?? '')
    .trim()
    .replace(
      /^(we('re| are)?|i('m| am)?|our|my)\s+(launching|releasing|planning|publishing|putting out|dropping)\s+/i,
      '',
    )
    .replace(/^(a|an|the)\s+(new\s+)?\w+\s+(called|named|titled)\s+/i, '')
    .replace(/\s+(launch|marketing|release|tour|campaign)?\s*plan$/i, '')
    .trim();
  return clause && clause.split(/\s+/).length <= 6 ? clause : undefined;
}

/** A working title from the message, then from what a file says, then from the file's name. */
function titleFrom(text: string, files: { name: string; text?: string }[]): string | undefined {
  const fromText =
    titleIn(text) ?? files.map((f) => (f.text ? titleIn(f.text) : undefined)).find(Boolean);
  if (fromText) return fromText;
  const file = files[0]?.name
    ?.replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(marketing|launch|plan|results?|final|draft|deck|v\d+)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return file ? titleCase(file) : undefined;
}

/**
 * Creates the project and its first thread from the first message on the start page, so a
 * choice nobody follows up leaves nothing behind. Returns the thread to open.
 */
export function startFromMessage(message: FirstMessage): string {
  const names = message.files.map((f) => f.name);
  const body = [message.text, ...message.files.map((f) => f.text ?? '')].join('\n').trim();
  const lower = `${body} ${names.join(' ')}`.toLowerCase();
  const detected = CATEGORY_RX.find(([re]) => re.test(lower))?.[1];
  const category = message.category ?? detected ?? null;
  const title = titleFrom(message.text, message.files);
  const r: Project = {
    id: uuidFrom(`project:${++seq}`),
    category: category ?? 'film',
    name: title ?? 'Untitled launch',
    kind: '',
    genre: '',
    places: [],
    window: '',
    lead: '',
    comps: [],
    status: 'Planning',
    updatedAt: clock(),
    qlooMatch: null,
    extra: {},
  };
  insertProject(r);
  if (message.mode) startModes.set(r.id, message.mode);
  const t = mkThread(r, 'First plan', null);
  pushItem(t.id, {
    id: itemId(),
    role: 'user',
    text: [message.text, names.length ? `Attached: ${names.join(', ')}` : '']
      .filter(Boolean)
      .join('\n\n'),
  });

  const read = () => {
    const pk = pack(project(r.id));
    // The demo knows each pack's sample files, so a real file stands in for the matching one.
    const attached = names.map((n) =>
      message.mode === 'rescue' || RESULTS_FILE.test(n) ? pk.files.res : pk.files.plan,
    );
    processDescription(r.id, t, body, attached);
  };
  const withTitle = () => {
    if (title) {
      say(t.id, `I will call this ${title}.`);
      read();
      return;
    }
    ask(
      t.id,
      {
        card: 'text',
        prompt: 'What is it called?',
        hint: 'A working title is fine. Type it in the message box below.',
      },
      (a) => {
        patchProject(r.id, { name: textOf(a).trim() || 'Untitled launch' });
        read();
      },
    );
  };

  if (category) {
    if (!message.category) say(t.id, `This reads as ${PACKS[category].name}.`);
    withTitle();
  } else {
    ask(
      t.id,
      {
        card: 'single',
        prompt: 'Which category is this in?',
        options: options(
          categories.map((id) => ({ v: id, l: PACKS[id].name, d: PACKS[id].blurb })),
        ),
      },
      (a) => {
        const chosen = categories.find((c) => c === firstOption(a)) ?? 'film';
        patchProject(r.id, { category: chosen });
        say(t.id, `Okay, ${PACKS[chosen].name}. I will use its inputs, charts and checks.`);
        withTitle();
      },
    );
  }
  return t.id;
}

function processDescription(projectId: string, t: Thread, text: string, attached: string[]): void {
  const r = project(projectId);
  const pk = pack(r);
  const lower = text.toLowerCase();
  const kind = (KINDS_RX[r.category].find(([re]) => re.test(lower))?.[1] ?? pk.kinds[0]) || '';
  const genre = GENRES[r.category].find(([re]) => re.test(lower))?.[1] ?? '';
  const named = detectPlaces(r.category, text);
  // A guess the person can correct in one message costs less than a card before any result.
  const places = named.length ? named : pk.placeOpts.slice(0, 3);
  const window =
    text
      .match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(20\d\d)?/i)?.[0]
      ?.replace(/[.\s]+$/, '') ?? '';
  const comps = text.match(/comps?:?\s*([A-Z][^.;\n]+)/)?.[1];
  if (attached.includes(pk.files.res)) resultsAttached.add(projectId);
  const mode = startModes.get(projectId) ?? detectMode(text, attached);
  startModes.delete(projectId);
  patchProject(projectId, {
    kind,
    genre,
    places,
    window,
    comps: comps ? splitList(comps) : r.comps,
  });
  const bits = [
    kind.toLowerCase(),
    genre.toLowerCase(),
    window && `window ${window}`,
    `${pk.placeLabel} ${places.join(', ')}${named.length ? '' : ' (assumed, you did not name any)'}`,
  ].filter(Boolean);
  say(
    t.id,
    `Reading this as ${MODE_READ[mode]}: ${bits.join(', ')}.\nIf any of that is wrong, just tell me, for example "${MODE_FIX[mode]}" or "${pk.placeOpts.at(-1) ?? 'other places'} too".`,
  );
  askMatch(projectId, t, mode);
}

function askMatch(projectId: string, t: Thread, mode: StartMode): void {
  const r = project(projectId);
  const pk = pack(r);
  ask(
    t.id,
    {
      card: 'match',
      prompt: `I searched Qloo for the ${pk.noun}. Which one is yours?`,
      options: options([
        ...pk.matchOpts(r.name),
        { v: '', l: 'None of these', d: `Use ${pk.fallback} instead` },
      ]),
    },
    (a) => {
      const v = firstOption(a);
      patchProject(projectId, { qlooMatch: v || `Matched by ${pk.fallback}` });
      if (mode === 'start') runStart(projectId, t);
      else if (mode === 'audit') runAudit(projectId, t);
      else runRebuild(projectId, t);
    },
  );
}

function runStart(projectId: string, t: Thread, title?: string): void {
  const first = planOutputs(projectId).length === 0;
  const r = project(projectId);
  runTrace(t.id, pack(r).trace.plan.slice(), () => {
    const current = project(projectId);
    const o = mkOut(
      current,
      t,
      'plan',
      title ?? (first ? 'First plan' : 'New plan, started fresh'),
      pack(current).base(current),
    );
    patchProject(projectId, { status: 'Planning' });
    finish(
      t.id,
      o,
      `${summaryOf(o)}\n(Demo: every new project in this category shows the same sample plan.)`,
    );
  });
}

function auditBrief(r: Project): DBrief {
  const pk = pack(r);
  const b = pk.base(r);
  const sources = pk.auditFix(b);
  for (const a of b.assumptions) a.src = sources[a.id];
  return b;
}

function runAudit(projectId: string, t: Thread): void {
  const r = project(projectId);
  runTrace(t.id, pack(r).trace.audit.slice(), () => {
    const current = project(projectId);
    const o = mkOut(current, t, 'audit', 'Audit of your plan', auditBrief(current));
    patchProject(projectId, { status: 'Audit' });
    finish(t.id, o, `${summaryOf(o)}\n(Demo: the plan it reads is sample content.)`);
  });
}

function runRebuild(projectId: string, t: Thread): void {
  const r = project(projectId);
  const fb = pack(r).fallback;
  runTrace(
    t.id,
    [
      'Reading the results you attached',
      `No plan was given, so rebuilding the assumed audience from ${fb}`,
      'Saving the rebuilt plan',
    ],
    () => {
      const current = project(projectId);
      const o = mkOut(current, t, 'plan', `Plan rebuilt from ${fb}`, pack(current).base(current));
      patchProject(projectId, { status: 'Launched' });
      finish(t.id, o, 'I rebuilt the audience the plan assumed. Now the results.');
      resultsFlow(t.id);
    },
  );
}

const summaryOf = (o: DOutput): string =>
  getState().outputs.find((x) => x.id === o.id)?.summary ?? '';

export const traceForScenario = (label: string): string[] => [
  `Reading the changed assumption: ${label}`,
  'Finding the lines that depend on it',
  'Rerunning only those lines against Qloo',
  'Keeping the other lines as they were',
  'Red teaming the new result',
  'Saving the output',
];

/** Runs a preset scenario. Resolves with the new output's id, or undefined if nothing changed. */
export function runScenario(
  threadId: string,
  scenarioId: string,
  baseId?: string,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const t = thread(threadId);
    if (getState().busy[threadId]) {
      resolve(undefined);
      return;
    }
    const b = (baseId ? douts.get(baseId) : undefined) ?? needBase(t);
    if (!b) {
      resolve(undefined);
      return;
    }
    patchThread(threadId, { baseOutputId: b.id });
    const r = project(t.projectId);
    const s = pack(r).scen.find((x) => x.id === scenarioId);
    if (!s) {
      resolve(undefined);
      return;
    }
    rename(t, `Scenario: ${s.label}`);
    runTrace(threadId, traceForScenario(s.label), () => {
      const nb = structuredClone(b.brief);
      s.apply(nb);
      dedupe(nb);
      const changed = diffIds(b.brief, nb);
      if (!changed.length) {
        say(threadId, `Nothing changed. This scenario is already reflected in ${labelOf(b.id)}.`);
        resolve(undefined);
        return;
      }
      const o = mkOut(project(t.projectId), t, 'scenario', `Scenario: ${s.label}`, nb, {
        parentId: b.id,
        changed,
      });
      finish(threadId, o);
      resolve(o.id);
    });
  });
}

function askScenario(threadId: string): void {
  const t = thread(threadId);
  if (!needBase(t)) return;
  const r = project(t.projectId);
  ask(
    threadId,
    {
      card: 'single',
      prompt: 'Which assumption do you want to change?',
      options: options([
        ...pack(r).scen.map((s) => ({ v: s.id, l: s.label })),
        { v: 'none', l: 'Never mind' },
      ]),
    },
    (a) => {
      const v = firstOption(a);
      if (v === 'none') say(threadId, 'Okay, nothing changed.');
      else void runScenario(threadId, v);
    },
  );
}

export function runDateCheck(threadId: string): void {
  if (getState().busy[threadId]) return;
  const t = thread(threadId);
  const b = needBase(t);
  if (!b) return;
  const pk = pack(project(t.projectId));
  rename(t, pk.dateTitle);
  ask(
    threadId,
    {
      card: 'single',
      prompt: `Which ${pk.rivalWord}s should I check against?`,
      options: options([
        { v: 'paste', l: 'I will paste them', d: 'Names and dates of the ones you know about' },
        {
          v: 'calendar',
          l: 'Use the public calendar',
          d: 'I will look for titles that share your audience',
        },
      ]),
    },
    (a) => {
      if (firstOption(a) !== 'paste') {
        doDateCheck(t, b, 'calendar');
        return;
      }
      ask(
        threadId,
        {
          card: 'text',
          prompt: `Paste the ${pk.rivalWord}s and their dates.`,
          hint: 'For example: Night Tide, Nov 13. Winter Harvest, Nov 6.',
        },
        (pasted) => {
          const n = (textOf(pasted).match(/[A-Za-z]{3,}\s+\d{1,2}/g) ?? []).length || 1;
          say(
            threadId,
            `I read ${n} ${pk.rivalWord}${n > 1 ? 's' : ''} from your list and matched ${n > 1 ? 'them' : 'it'} to Qloo titles. (Demo: the sample ones are used.)`,
          );
          doDateCheck(t, b, 'you');
        },
      );
    },
  );
}

function doDateCheck(t: Thread, b: DOutput, src: 'you' | 'calendar'): void {
  const r = project(t.projectId);
  runTrace(t.id, pack(r).trace.date.slice(), () => {
    const current = project(t.projectId);
    const o = mkOut(current, t, 'date', pack(current).dateTitle, b.brief, {
      ofId: b.id,
      src,
      focusIds: b.brief.dates.map((d) => d.id),
    });
    finish(t.id, o);
  });
}

export function askPartner(threadId: string): void {
  const t = thread(threadId);
  const b = needBase(t);
  if (!b) return;
  ask(
    threadId,
    {
      card: 'single',
      prompt: 'Who should I brief?',
      options: options(
        b.brief.partners.map((p) => ({ v: p.id, l: p.name, d: `${p.type} · ${p.fits}` })),
      ),
    },
    (a) => runPartner(threadId, firstOption(a)),
  );
}

function runPartner(threadId: string, partnerId: string): void {
  if (getState().busy[threadId]) return;
  const t = thread(threadId);
  const b = needBase(t);
  if (!b) return;
  const p = b.brief.partners.find((x) => x.id === partnerId) ?? b.brief.partners[0];
  if (!p) return;
  rename(t, `${p.name} brief`);
  const r = project(t.projectId);
  runTrace(threadId, pack(r).trace.partner.slice(), () => {
    const o = mkOut(project(t.projectId), t, 'partner', `${p.name} brief`, b.brief, {
      ofId: b.id,
      focusIds: [p.id],
    });
    finish(threadId, o);
  });
}

function demoResults(r: Project): DResultsInput {
  const x = pack(r).res;
  const labels = x.tLabels(r);
  const t = labels ? labels.map((label, i) => ({ label, share: x.demoT(r)[i] ?? 0 })) : null;
  return {
    date: x.confirmRows[0]?.[1] ?? '',
    a: fitSplit(x.demoA(r), x.aLabels(r).length),
    t,
    hold: x.holdDefault,
  };
}

const fitSplit = (arr: number[], n: number): number[] =>
  arr.length === n ? arr.slice() : defSplit(n);

function resultsFlow(threadId: string): void {
  if (getState().busy[threadId]) return;
  const t = thread(threadId);
  const r = project(t.projectId);
  const pk = pack(r);
  const b = baseOf(t);
  if (b?.brief.course) {
    say(threadId, `Results are already applied in ${labelOf(b.id)}.`);
    return;
  }
  if (!b) {
    say(threadId, 'I need a plan first. Tell me about the project and I will build one.');
    return;
  }
  rename(t, 'Results and relaunch');
  if (resultsAttached.has(r.id)) {
    resultsAttached.delete(r.id);
    confirmFile(threadId, pk.files.res);
    return;
  }
  ask(
    threadId,
    {
      card: 'file',
      prompt: `Add your results. Qloo has no ${pk.noFcWhat}, so these are your numbers. Drop the report if you have one.`,
      dropLabel: 'Drop a CSV, PDF or screenshot, or click to choose',
      altLabel: "I'll type the numbers instead",
    },
    (a) => {
      if (a.card === 'alt') askResultsDate(threadId);
      else confirmFile(threadId, pk.files.res);
    },
  );
}

function confirmFile(threadId: string, name: string): void {
  const t = thread(threadId);
  const r = project(t.projectId);
  const x = pack(r).res;
  const demo = demoResults(r);
  say(threadId, `Here is what I read from ${name}. Check it before I run anything.`);
  const secondary = demo.t
    ? {
        title: x.tTitle,
        groups: demo.t.map((g) => g.label),
        values: demo.t.map((g) => g.share),
      }
    : null;
  ask(
    threadId,
    {
      card: 'confirm',
      prompt: 'Is this right?',
      rows: x.confirmRows.map(([label, value]) => ({ label, value })),
      primary: { title: x.aTitle, groups: x.aLabels(r), values: demo.a },
      secondary,
      holdLabel: x.holdLabel,
      hold: demo.hold ?? 0,
    },
    (a) => {
      if (a.card !== 'confirm') return;
      runRescue(threadId, {
        date: demo.date,
        a: a.primary,
        t:
          secondary && a.secondary
            ? secondary.groups.map((label, i) => ({ label, share: a.secondary?.[i] ?? 0 }))
            : null,
        hold: a.hold || null,
      });
    },
  );
}

function askResultsDate(threadId: string): void {
  const r = project(thread(threadId).projectId);
  const x = pack(r).res;
  ask(threadId, { card: 'date', prompt: `${x.dateLabel}?`, defaultValue: '2026-10-02' }, (a) => {
    askResultsSplit(threadId, a.card === 'date' ? prettyDate(a.value) : 'Oct 2');
  });
}

function askResultsSplit(threadId: string, date: string): void {
  const r = project(thread(threadId).projectId);
  const x = pack(r).res;
  const groups = x.aLabels(r);
  ask(
    threadId,
    {
      card: 'split',
      prompt: `${x.aTitle}: roughly what share each? Move the sliders.`,
      split: { title: x.aTitle, groups, values: defSplit(groups.length) },
    },
    (a) => {
      const values = a.card === 'split' ? a.values : defSplit(groups.length);
      const secondary = x.tLabels(r);
      if (secondary) askResultsSecondary(threadId, date, values, secondary);
      else askResultsHold(threadId, date, values, null);
    },
  );
}

function askResultsSecondary(
  threadId: string,
  date: string,
  actual: number[],
  labels: string[],
): void {
  const r = project(thread(threadId).projectId);
  const x = pack(r).res;
  ask(
    threadId,
    {
      card: 'split',
      prompt: `${x.tTitle}: and this one? Move the sliders.`,
      split: { title: x.tTitle, groups: labels, values: defSplit(labels.length) },
    },
    (a) => {
      const values = a.card === 'split' ? a.values : defSplit(labels.length);
      askResultsHold(
        threadId,
        date,
        actual,
        labels.map((label, i) => ({ label, share: values[i] ?? 0 })),
      );
    },
  );
}

function askResultsHold(
  threadId: string,
  date: string,
  actual: number[],
  secondary: DResultsInput['t'],
): void {
  const r = project(thread(threadId).projectId);
  const x = pack(r).res;
  ask(
    threadId,
    {
      card: 'text',
      prompt: `${x.holdLabel}?`,
      hint: 'Type a number, or type skip if you do not have it yet.',
    },
    (a) => {
      const n = textOf(a).match(/\d+/)?.[0];
      runRescue(threadId, {
        date,
        a: actual,
        t: secondary,
        hold: n ? Number.parseInt(n, 10) : null,
      });
    },
  );
}

function runRescue(threadId: string, res: DResultsInput): void {
  const t = thread(threadId);
  const b = baseOf(t);
  if (!b) return;
  const r = project(t.projectId);
  runTrace(threadId, pack(r).trace.rescue.slice(), () => {
    const current = project(t.projectId);
    const nb = structuredClone(b.brief);
    applyRescue(current, nb, res);
    dedupe(nb);
    const changed = diffIds(b.brief, nb);
    const o = mkOut(current, t, 'rescue', 'Rescue: results', nb, { parentId: b.id, changed });
    patchProject(current.id, { status: 'Launched, replanned' });
    finish(threadId, o);
  });
}

export function applyRescue(r: Project, b: DBrief, res: DResultsInput): void {
  const g = gaps(b, res.a);
  b.results = { ...res, a: res.a.slice(), g };
  pack(r).rescue(b, g);
}

/**
 * Opens a thread on a project. It builds on the current plan without asking, and says so, so the
 * person can type what they want next. Returns the thread id.
 */
export function startThread(projectId: string): string {
  const r = project(projectId);
  const t = mkThread(r, 'New thread', null);
  const latest = planOutputs(projectId).at(-1);
  if (!latest) {
    say(t.id, `Something new for ${r.name}. There is no plan yet.`);
    askFresh(t);
    return t.id;
  }
  patchThread(t.id, { baseOutputId: latest.id, fromOutputId: latest.id });
  say(
    t.id,
    `Picking up from ${labelOf(latest.id)}, with the project inputs (${r.name}${r.kind ? `, ${r.kind.toLowerCase()}` : ''}, comps: ${r.comps.join(', ') || 'none given'}). Nothing else.\nTell me what to do next. Say "start fresh" or "use an older plan" to work from something else.`,
  );
  return t.id;
}

function askOlderPlan(t: Thread): void {
  const plans = planOutputs(t.projectId);
  if (plans.length < 2) {
    say(t.id, `There is only one plan so far: ${labelOf(plans[0]?.id ?? '')}. I am using it.`);
    return;
  }
  ask(
    t.id,
    {
      card: 'single',
      prompt: 'Which plan should I work from?',
      options: options(
        plans
          .slice()
          .reverse()
          .map((o) => ({ v: o.id, l: labelOf(o.id), d: `By ${o.by}` })),
      ),
    },
    (a) => {
      const id = firstOption(a);
      patchThread(t.id, { baseOutputId: id, fromOutputId: id, fresh: false });
      say(t.id, `Working from ${labelOf(id)} now. What should I do with it?`);
    },
  );
}

function startFresh(t: Thread): void {
  patchThread(t.id, { baseOutputId: null, fromOutputId: null, fresh: true });
  say(t.id, 'Starting fresh. I will not use any earlier plan, only the project inputs.');
  rename(t, 'Fresh plan');
  runStart(t.projectId, t);
}

function askFresh(t: Thread): void {
  ask(
    t.id,
    {
      card: 'single',
      prompt: 'What are you starting from?',
      options: options([
        { v: 'start', l: 'Plan from scratch', d: 'Use the project inputs' },
        { v: 'audit', l: 'A plan I already have', d: 'I will audit it' },
        { v: 'rescue', l: 'Results', d: 'Rebuild the plan, then add the results' },
      ]),
    },
    (a) => {
      const v = firstOption(a);
      if (v === 'start') {
        rename(t, 'Fresh plan');
        runStart(t.projectId, t);
      } else if (v === 'audit') {
        rename(t, 'Audit of a plan');
        ask(
          t.id,
          {
            card: 'file',
            prompt: 'Drop the plan to audit.',
            dropLabel: 'Drop a file or paste it in the chat',
          },
          () => runAudit(t.projectId, t),
        );
      } else {
        rename(t, 'Rescue from results');
        runRebuild(t.projectId, t);
      }
    },
  );
}

const RX_DATE = /rival|date|clash|collision|overlap|same (week|month|weekend)/;
const RX_AUDIT = /check (my|the|our) plan|audit/;
const RX_FRESH = /start (fresh|over|again)|from scratch/;
const RX_OLDER = /(older|earlier|different|another|previous) plan/;
const RX_PARTNER = /draft|partner|sponsor|creator|outreach|collab|brief|guest|influencer/;
const RX_RESULTS =
  /result|opening numbers|add (the )?(numbers|data|streams|tickets|downloads|wishlist|pre.?order)|streams and tickets|pre.?order numbers|wishlist numbers|we (got|had|sold)/;

/** The open text card, which the chat box answers instead of starting a new message. */
export function openTextQuestion(threadId: string): string | undefined {
  const items = getState().items[threadId] ?? [];
  for (let i = items.length - 1; i >= 0; i--) {
    const x = items[i];
    if (x?.role === 'question' && x.answer === null) {
      return x.question.card === 'text' ? x.id : undefined;
    }
  }
  return undefined;
}

/** A typed message: answers the open text card, or starts a reply. */
export function sendText(threadId: string, text: string): void {
  const open = openTextQuestion(threadId);
  if (open) {
    answerQuestion(threadId, open, { card: 'text', text });
    return;
  }
  pushItem(threadId, { id: itemId(), role: 'user', text });
  reply(threadId, text);
}

function reply(threadId: string, text: string): void {
  const t = thread(threadId);
  const pk = pack(project(t.projectId));
  const q = text.toLowerCase();
  if (t.name === 'New thread') rename(t, text.length > 40 ? `${text.slice(0, 38)}…` : text);
  if (pk.noFc.re.test(q) && !/\badd\b|numbers|we (got|had|sold)|results|report/.test(q)) {
    say(threadId, pk.noFc.msg);
    return;
  }
  if (/send|book |email them|post it/.test(q)) {
    say(threadId, "I only draft. I don't send or book anything. I can draft it for you to send.");
    return;
  }
  if (/why|receipt|evidence|proof/.test(q)) {
    say(
      threadId,
      'Every output has an Evidence tab and every line a receipt button. It opens the Qloo call behind it: the endpoint, the input, what came back and how the verdict was reached.',
    );
    return;
  }
  if (RX_AUDIT.test(q)) {
    rename(t, 'Audit of a plan');
    runAudit(t.projectId, t);
    return;
  }
  if (RX_FRESH.test(q)) {
    startFresh(t);
    return;
  }
  if (RX_OLDER.test(q)) {
    askOlderPlan(t);
    return;
  }
  if (!needBase(t)) return;
  if (/compare|differ|changed since/.test(q)) {
    comparePlansInChat(t);
    return;
  }
  const scenario = pk.scen.find((s) => s.re.test(q));
  if (/what if|scenario/.test(q)) {
    if (scenario) void runScenario(threadId, scenario.id);
    else askScenario(threadId);
    return;
  }
  if (RX_DATE.test(q)) {
    runDateCheck(threadId);
    return;
  }
  if (RX_PARTNER.test(q)) {
    askPartner(threadId);
    return;
  }
  if (RX_RESULTS.test(q)) {
    resultsFlow(threadId);
    return;
  }
  if (scenario) {
    void runScenario(threadId, scenario.id);
    return;
  }
  const r = project(t.projectId);
  const named = detectPlaces(r.category, text);
  if (named.length) {
    const places = /\b(too|also|add|plus)\b/.test(q)
      ? [...new Set([...r.places, ...named])]
      : named;
    patchProject(r.id, { places });
    say(threadId, `Okay, ${pk.placeLabel} now ${places.join(', ')}. Replanning with them.`);
    runStart(r.id, t, `Plan for ${places.join(', ')}`);
    return;
  }
  say(
    threadId,
    `In this demo I can run a scenario ("what if ..."), check ${pk.rivalWord}s, draft a ${pk.partnerWord} brief, add your results, change the ${pk.placeLabel}, compare plans or open any receipt. Just say which.`,
  );
}

/** Line by line, what moved between the plan this thread works from and the one before it. */
function comparePlansInChat(t: Thread): void {
  const b = baseOf(t);
  if (!b) return;
  const plans = planOutputs(t.projectId);
  const before = (b.parentId ? douts.get(b.parentId) : undefined) ?? plans[plans.indexOf(b) - 1];
  if (!before) {
    say(t.id, `${labelOf(b.id)} is the only plan so far, so there is nothing to compare it with.`);
    return;
  }
  const changes = compareBriefs(before.brief, b.brief);
  if (!changes.length) {
    say(t.id, `${labelOf(before.id)} and ${labelOf(b.id)} are the same, line for line.`);
    return;
  }
  const shown = changes
    .slice(0, 4)
    .map((c) => `• ${c.label}: ${c.before ?? 'not there'} → ${c.after ?? 'removed'}`);
  const rest =
    changes.length > 4 ? `\n…and ${changes.length - 4} more. Open the output for all of them.` : '';
  say(
    t.id,
    `${labelOf(b.id)} against ${labelOf(before.id)}: ${changes.length} ${changes.length === 1 ? 'line differs' : 'lines differ'}.\n${shown.join('\n')}${rest}`,
  );
}

/** Runs one of the suggested next steps, typed into the chat the way a person would. */
export function runNextStep(threadId: string, step: { id: string; label: string }): void {
  if (getState().busy[threadId]) return;
  pushItem(threadId, { id: itemId(), role: 'user', text: step.label });
  const [kind, arg] = step.id.split(':');
  if (kind === 'scn' && arg) void runScenario(threadId, arg);
  else if (kind === 'results') resultsFlow(threadId);
  else if (kind === 'partner') askPartner(threadId);
  else if (kind === 'date') runDateCheck(threadId);
}

/** Lets the seed write with fixed dates and keys, so server and browser agree. */
export function withSeedClock(at: string, run: () => void): void {
  const previous = clock;
  clock = () => at;
  try {
    run();
  } finally {
    clock = previous;
  }
}

export { auditBrief };
