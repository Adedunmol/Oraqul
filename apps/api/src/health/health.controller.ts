import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  async check() {
    const db = await this.db.execute(sql`select 1`).then(
      () => true,
      () => false,
    );
    return { ok: db, db };
  }
}
