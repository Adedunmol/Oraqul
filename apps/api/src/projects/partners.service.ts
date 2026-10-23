import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { PartnersState } from '@oraqul/schema';
import { eq } from 'drizzle-orm';
import { withTeamPartners } from '../agent/launch/partners.js';
import { type Database, DB } from '../db/db.module.js';
import { outputs } from '../db/schema.js';
import { ProjectsService } from './projects.service.js';

/** The team's own partners on a saved plan (spec §7). Code recomputes the rows; Qloo is not asked. */
@Injectable()
export class PartnersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  async set(outputId: string, names: string[]): Promise<PartnersState> {
    const { output, project } = await this.projects.outputDetail(outputId);
    const plan = output.plan;
    if (!plan || plan.scope !== 'full' || output.kind === 'creative') {
      throw new BadRequestException('Only a full plan has partners to edit');
    }
    const next = withTeamPartners(plan, names, project.category);
    await this.db.update(outputs).set({ plan: next }).where(eq(outputs.id, outputId));
    return { partners: next.partners, calls: next.calls, territories: next.territories };
  }
}
