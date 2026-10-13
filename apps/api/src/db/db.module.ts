import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import type { Env } from '../config/env.js';
import * as schema from './schema.js';

export const DB = Symbol('DB');
/** Not the node-postgres type, so the specs can pass an in-process Postgres (PGlite) instead. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Database => {
        const pool = new pg.Pool({ connectionString: config.get('DATABASE_URL', { infer: true }) });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
