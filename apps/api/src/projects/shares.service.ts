import { randomBytes } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OutputDetail, ShareState } from '@oraqul/schema';
import { and, eq } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { shareLinks } from '../db/schema.js';
import { redactForShare } from '../outputs/share-view.js';
import { ProjectsService } from './projects.service.js';

/** Read only links to one output (spec §7). The token is the only thing a visitor holds. */
@Injectable()
export class SharesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  /** Turns the output's link on or off. The first time on makes the token; later it is kept. */
  async set(outputId: string, enabled: boolean): Promise<ShareState> {
    await this.projects.outputDetail(outputId);
    const [existing] = await this.db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.outputId, outputId))
      .limit(1);
    if (existing) {
      const [row] = await this.db
        .update(shareLinks)
        .set({ enabled })
        .where(eq(shareLinks.id, existing.id))
        .returning();
      return { token: (row ?? existing).token, enabled: (row ?? existing).enabled };
    }
    const [row] = await this.db
      .insert(shareLinks)
      .values({ outputId, token: randomBytes(32).toString('base64url'), enabled })
      .returning();
    if (!row) throw new Error('Share link insert returned no row');
    return { token: row.token, enabled: row.enabled };
  }

  /** The output behind an enabled token. A wrong token and a turned off one answer the same 404. */
  async shared(token: string): Promise<OutputDetail> {
    const [link] = await this.db
      .select({ outputId: shareLinks.outputId })
      .from(shareLinks)
      .where(and(eq(shareLinks.token, token), eq(shareLinks.enabled, true)))
      .limit(1);
    if (!link) throw new NotFoundException('No such link');
    return redactForShare(await this.projects.outputDetail(link.outputId));
  }
}
