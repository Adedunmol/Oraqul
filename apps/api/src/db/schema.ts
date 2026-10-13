import { categories, codePurposes, jobs, oauthProviders, roles } from '@oraqul/schema';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Tables follow docs/product/spec.md section 6. All ids are UUIDs and every row has created_at.

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

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
  kind: text('kind').notNull(),
  createdAt: createdAt(),
});

export const memberships = pgTable('memberships', {
  id: id(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: roles }).notNull(),
  status: text('status', { enum: ['active', 'invited'] }).notNull(),
  createdAt: createdAt(),
});

export const projects = pgTable('projects', {
  id: id(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  category: text('category', { enum: categories }).notNull(),
  name: text('name').notNull(),
  kind: text('kind'),
  genre: text('genre'),
  places: text('places').array().notNull().default([]),
  // "window" in the spec; renamed because WINDOW is a reserved SQL word
  launchWindow: text('launch_window'),
  lead: text('lead'),
  comps: jsonb('comps'),
  inputs: jsonb('inputs'),
  status: text('status').notNull().default('draft'),
  createdAt: createdAt(),
});

export const threads = pgTable('threads', {
  id: id(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  baseOutputId: uuid('base_output_id').references((): AnyPgColumn => outputs.id),
  fromOutputId: uuid('from_output_id').references((): AnyPgColumn => outputs.id),
  fresh: boolean('fresh').notNull().default(false),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const messages = pgTable('messages', {
  id: id(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => threads.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'agent', 'question', 'trace', 'output'] }).notNull(),
  body: jsonb('body').notNull(),
  seq: integer('seq').notNull(),
  createdAt: createdAt(),
});

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
  changedIds: text('changed_ids').array().notNull().default([]),
  headline: text('headline'),
  moves: jsonb('moves'),
  confidence: jsonb('confidence'),
  dataAsOf: timestamp('data_as_of', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const receipts = pgTable('receipts', {
  id: id(),
  outputId: uuid('output_id')
    .notNull()
    .references(() => outputs.id, { onDelete: 'cascade' }),
  lineId: text('line_id'),
  endpoint: text('endpoint').notNull(),
  input: jsonb('input').notNull(),
  returned: jsonb('returned').notNull(),
  rule: text('rule').notNull(),
  confidence: text('confidence').notNull(),
  calledAt: timestamp('called_at', { withTimezone: true }).notNull(),
  callId: uuid('call_id').notNull(),
  createdAt: createdAt(),
});

export const shareLinks = pgTable('share_links', {
  id: id(),
  outputId: uuid('output_id')
    .notNull()
    .references(() => outputs.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: createdAt(),
});

export const runs = pgTable('runs', {
  id: id(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => threads.id, { onDelete: 'cascade' }),
  agent: text('agent').notNull(),
  job: text('job', { enum: jobs }).notNull(),
  steps: jsonb('steps'),
  qlooCalls: integer('qloo_calls').notNull().default(0),
  tokens: integer('tokens').notNull().default(0),
  status: text('status').notNull().default('running'),
  createdAt: createdAt(),
});

// Packs live in code; this table only records which pack version produced an output.
export const categoryPacks = pgTable('category_packs', {
  id: id(),
  category: text('category', { enum: categories }).notNull().unique(),
  version: text('version').notNull(),
  createdAt: createdAt(),
});
