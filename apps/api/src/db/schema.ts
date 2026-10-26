import {
  actionStatuses,
  categories,
  codePurposes,
  confidences,
  jobs,
  oauthProviders,
  reactionKinds,
  receiptSources,
  roles,
  startModes,
  stopReasons,
} from '@oraqul/schema';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Tables follow docs/product/spec.md section 6. All ids are UUIDs and every row has created_at.

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: oauthProviders }).notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique('oauth_accounts_provider_user_unique').on(table.provider, table.providerUserId),
  ],
);

export const emailCodes = pgTable(
  'email_codes',
  {
    id: id(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    purpose: text('purpose', { enum: codePurposes }).notNull(),
    name: text('name'),
    passwordHash: text('password_hash'),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index('email_codes_email_purpose_idx').on(table.email, table.purpose)],
);

export const loginFailures = pgTable(
  'login_failures',
  {
    id: id(),
    email: text('email').notNull(),
    ip: text('ip').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('login_failures_email_ip_idx').on(table.email, table.ip, table.createdAt),
    index('login_failures_ip_idx').on(table.ip, table.createdAt),
  ],
);

export const teams = pgTable('teams', {
  id: id(),
  name: text('name').notNull(),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: roles }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique('memberships_team_user_unique').on(table.teamId, table.userId)],
);

export const invites = pgTable(
  'invites',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role', { enum: roles }).notNull(),
    // Only the hash is stored, so a database leak does not hand out working invite links.
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('invites_team_email_pending_idx')
      .on(table.teamId, table.email)
      .where(sql`${table.acceptedAt} is null`),
  ],
);

// A project is saved from its first message, before the router has read its name, category and
// mode. Until then it is a draft (`status = 'intake'`) that no list shows.
export const projects = pgTable(
  'projects',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    category: text('category', { enum: categories }),
    name: text('name'),
    mode: text('mode', { enum: startModes }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind'),
    genre: text('genre'),
    places: text('places').array().notNull().default([]),
    // "window" in the spec; renamed because WINDOW is a reserved SQL word
    launchWindow: text('launch_window'),
    lead: text('lead'),
    comps: jsonb('comps'),
    inputs: jsonb('inputs'),
    status: text('status').notNull().default('intake'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('projects_team_status_idx').on(table.teamId, table.status, table.updatedAt)],
);

export const threads = pgTable(
  'threads',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    baseOutputId: uuid('base_output_id').references((): AnyPgColumn => outputs.id),
    fromOutputId: uuid('from_output_id').references((): AnyPgColumn => outputs.id),
    fresh: boolean('fresh').notNull().default(false),
    /** The older part of a long chat, folded down so replies are not sent all of it. */
    summary: text('summary'),
    /** The `seq` of the last message the summary covers. */
    summarizedThrough: integer('summarized_through').notNull().default(0),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('threads_project_idx').on(table.projectId)],
);

export const memoryKinds = ['point', 'decision', 'plan'] as const;

/**
 * What a project remembers: key points and decisions moving forward, and a pointer to each plan
 * worth keeping. Context for later chats, never evidence. A `plan` item belongs to the chat that
 * made it, so a newer plan from that chat replaces it and a plan from another chat sits beside it.
 */
export const memoryItems = pgTable(
  'memory_items',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: memoryKinds }).notNull(),
    text: text('text').notNull(),
    sourceOutputId: uuid('source_output_id').references((): AnyPgColumn => outputs.id, {
      onDelete: 'set null',
    }),
    sourceThreadId: uuid('source_thread_id').references((): AnyPgColumn => threads.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('memory_items_project_idx').on(table.projectId, table.updatedAt)],
);

export const messageRoles = ['user', 'agent', 'question', 'trace', 'output', 'context'] as const;

/** A thread's stored transcript. `seq` orders it and is the event stream's resume point. */
export const messages = pgTable(
  'messages',
  {
    id: id(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    role: text('role', { enum: messageRoles }).notNull(),
    body: jsonb('body').notNull(),
    seq: integer('seq').notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique('messages_thread_seq_unique').on(table.threadId, table.seq)],
);

export const outputs = pgTable('outputs', {
  id: id(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => threads.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: jobs }).notNull(),
  parentId: uuid('parent_id').references((): AnyPgColumn => outputs.id),
  title: text('title').notNull(),
  brief: jsonb('brief').notNull(),
  /** The launch plan (core sections, modules, findings) for outputs built on findings. */
  plan: jsonb('plan'),
  /** The audit report (items, risks, alternatives, results) for an audit. Null for every other kind. */
  report: jsonb('report'),
  /** What a check on a saved plan found changed, for a `refresh` output. Null for every other kind. */
  refresh: jsonb('refresh'),
  /** What the plan was built from (the agent's reading and the comps it used), so a follow up can rerun it. */
  inputs: jsonb('inputs'),
  /** What the plan was made with (writer model, prompts, code, Qloo host). Null on plans saved before this. */
  versions: jsonb('versions'),
  changedIds: text('changed_ids').array().notNull().default([]),
  headline: text('headline'),
  moves: jsonb('moves'),
  confidence: jsonb('confidence'),
  dataAsOf: timestamp('data_as_of', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/**
 * One Qloo call as a line cites it. A receipt belongs to the run that made the call; an answer
 * saves no output, so `output_id` is set only when a plan does.
 */
export const receipts = pgTable(
  'receipts',
  {
    id: id(),
    runId: uuid('run_id')
      .notNull()
      .references((): AnyPgColumn => runs.id, { onDelete: 'cascade' }),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    outputId: uuid('output_id').references(() => outputs.id, { onDelete: 'cascade' }),
    lineId: text('line_id'),
    endpoint: text('endpoint').notNull(),
    input: jsonb('input').notNull(),
    returned: jsonb('returned').notNull(),
    rule: text('rule').notNull(),
    confidence: text('confidence', { enum: confidences }).notNull(),
    source: text('source', { enum: receiptSources }).notNull(),
    calledAt: timestamp('called_at', { withTimezone: true }).notNull(),
    callId: uuid('call_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('receipts_run_idx').on(table.runId),
    index('receipts_output_idx').on(table.outputId),
  ],
);

export const shareLinks = pgTable('share_links', {
  id: id(),
  outputId: uuid('output_id')
    .notNull()
    .references(() => outputs.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: createdAt(),
});

/**
 * How a person rated a plan, for the weekly review of what helps and what is wrong. One per person
 * per output. `finding_ids` is a snapshot of the findings the plan cited when it was rated, so the
 * reaction can be traced to the evidence even after the plan is rebuilt. Never sent to Qloo or a model.
 */
export const reactions = pgTable(
  'reactions',
  {
    id: id(),
    outputId: uuid('output_id')
      .notNull()
      .references(() => outputs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: reactionKinds }).notNull(),
    findingIds: text('finding_ids').array().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [unique('reactions_output_user_unique').on(table.outputId, table.userId)],
);

/**
 * What a plan predicted next to what happened, one row per place or age band, written when an audit
 * compares results with the plan. Aggregates only (hard rule 7), kept so the lift and overlap bands
 * and the Games cut-offs can later be tested against outcomes. Never sent to Qloo or a model.
 */
export const outcomes = pgTable(
  'outcomes',
  {
    id: id(),
    /** The audit report that made the comparison. */
    outputId: uuid('output_id')
      .notNull()
      .references(() => outputs.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    category: text('category', { enum: categories }),
    kind: text('kind', { enum: ['place', 'age'] }).notNull(),
    /** The city or the age band. */
    label: text('label').notNull(),
    /** Place in the plan's order, from 1. Null for an age band, or a place the plan did not name. */
    plannedRank: integer('planned_rank'),
    actualRank: integer('actual_rank'),
    /** Share of the results, in percent. */
    actualShare: real('actual_share').notNull(),
    /** Qloo's lift for a place, or its taste index for an age band, when the audit measured it. */
    predicted: real('predicted'),
    gap: text('gap', { enum: ['under', 'over', 'as-planned'] }),
    /** What the figures count, in the person's words, and the date they are as of. */
    measure: text('measure').notNull(),
    asOf: text('as_of'),
    /** Where the figures came from, as the person wrote it. */
    source: text('source'),
    createdAt: createdAt(),
  },
  (table) => [index('outcomes_output_idx').on(table.outputId)],
);

export const runStatuses = ['running', 'waiting', 'done', 'error'] as const;

/**
 * One run segment of a thread: from a message until the agent finishes, asks, or stops. `state`
 * holds what the next segment needs (the router's reading, the open question), so a waiting run
 * survives a restart. `job` is null while the router has not read it yet.
 */
export const runs = pgTable(
  'runs',
  {
    id: id(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    agent: text('agent').notNull(),
    job: text('job', { enum: jobs }),
    steps: jsonb('steps'),
    state: jsonb('state'),
    qlooCalls: integer('qloo_calls').notNull().default(0),
    tokens: integer('tokens').notNull().default(0),
    status: text('status', { enum: runStatuses }).notNull().default('running'),
    stopReason: text('stop_reason', { enum: stopReasons }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index('runs_thread_idx').on(table.threadId, table.createdAt)],
);

/** One person's pinned projects. Three at most, kept by the service, not the database. */
export const pins = pgTable(
  'pins',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [unique('pins_user_project_unique').on(table.userId, table.projectId)],
);

/** How far one person has read a thread, by message `seq`. Drives "new" marks and Needs you. */
export const threadReads = pgTable(
  'thread_reads',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    readSeq: integer('read_seq').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [unique('thread_reads_user_thread_unique').on(table.userId, table.threadId)],
);

// Packs live in code; this table only records which pack version produced an output.
export const categoryPacks = pgTable('category_packs', {
  id: id(),
  category: text('category', { enum: categories }).notNull().unique(),
  version: text('version').notNull(),
  createdAt: createdAt(),
});

/**
 * One step of a saved plan's campaign: a row of its content calendar, with a guide from the
 * creative kit. It belongs to one plan version (`output_id`), so a revised plan gets its own set and
 * this one, with the team's edits, stays as it was. Nothing here is sent to Qloo or a model.
 */
export const campaignActions = pgTable(
  'campaign_actions',
  {
    id: id(),
    outputId: uuid('output_id')
      .notNull()
      .references(() => outputs.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** The calendar row it came from. Null for an action the team added. */
    rowId: text('row_id'),
    territory: text('territory'),
    channel: text('channel').notNull(),
    title: text('title').notNull(),
    asset: text('asset'),
    startsOn: text('starts_on'),
    endsOn: text('ends_on'),
    week: integer('week'),
    guide: jsonb('guide'),
    findingIds: text('finding_ids').array().notNull().default(sql`'{}'::text[]`),
    status: text('status', { enum: actionStatuses }).notNull().default('todo'),
    note: text('note').notNull().default(''),
    edited: boolean('edited').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('campaign_actions_output_idx').on(table.outputId, table.position)],
);

/** Two creative angles for one action and the one thing to measure. There is no winner column. */
export const campaignTests = pgTable(
  'campaign_tests',
  {
    id: id(),
    actionId: uuid('action_id')
      .notNull()
      .references(() => campaignActions.id, { onDelete: 'cascade' }),
    angles: jsonb('angles').notNull(),
    measure: text('measure').notNull(),
    conventions: text('conventions').array().notNull().default(sql`'{}'::text[]`),
    /** What the team measured for each angle. Null until they add it. */
    results: jsonb('results'),
    createdAt: createdAt(),
  },
  (table) => [unique('campaign_tests_action_unique').on(table.actionId)],
);
