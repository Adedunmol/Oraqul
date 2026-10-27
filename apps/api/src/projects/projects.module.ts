import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CalendarController, CalendarFeedController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';
import { CampaignService } from './campaign.service.js';
import { PartnersService } from './partners.service.js';
import { PinsController } from './pins.controller.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { ReactionsService } from './reactions.service.js';
import { SharesController } from './shares.controller.js';
import { SharesService } from './shares.service.js';

@Module({
  imports: [AuthModule, AgentModule],
  controllers: [
    ProjectsController,
    PinsController,
    SharesController,
    CalendarController,
    CalendarFeedController,
  ],
  providers: [
    ProjectsService,
    SharesService,
    ReactionsService,
    PartnersService,
    CampaignService,
    CalendarService,
  ],
})
export class ProjectsModule {}
