import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../test/test-database.js';
import { QlooMeterService } from './qloo-meter.js';

const config = (total: number, reserve: number) =>
  new ConfigService({ QLOO_MONTHLY_BUDGET: total, QLOO_INTERACTIVE_RESERVE: reserve });

describe('QlooMeterService', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(() => database.close());

  it('counts calls and refuses past the month limit, and a new month starts again', async () => {
    const meter = new QlooMeterService(database.db, config(3, 0) as never);
    const june = new Date('2026-06-15T00:00:00Z');
    expect(await meter.take('web', june)).toBe(true);
    expect(await meter.take('web', june)).toBe(true);
    expect(await meter.take('web', june)).toBe(true);
    expect(await meter.take('web', june)).toBe(false);
    expect(await meter.used(june)).toBe(3);
    expect(await meter.take('web', new Date('2026-07-01T00:00:00Z'))).toBe(true);
  });

  it('keeps the reserve for the web app: a connected agent or watch stops short of it', async () => {
    const meter = new QlooMeterService(database.db, config(5, 2) as never);
    const august = new Date('2026-08-10T00:00:00Z');
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await meter.take('mcp', august));
    expect(results).toEqual([true, true, true, false]);
    expect(await meter.take('web', august)).toBe(true);
    expect(await meter.take('web', august)).toBe(true);
    expect(await meter.take('web', august)).toBe(false);
    expect(await meter.take('watch', august)).toBe(false);
  });

  it('does not overshoot when calls arrive together', async () => {
    const meter = new QlooMeterService(database.db, config(4, 0) as never);
    const september = new Date('2026-09-02T00:00:00Z');
    const answers = await Promise.all(
      Array.from({ length: 10 }, () => meter.take('web', september)),
    );
    expect(answers.filter(Boolean)).toHaveLength(4);
    expect(await meter.used(september)).toBe(4);
  });
});
