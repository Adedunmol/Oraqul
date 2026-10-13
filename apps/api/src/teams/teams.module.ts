import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InvitesController } from './invites.controller.js';
import { InvitesService } from './invites.service.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TeamsController, InvitesController],
  providers: [TeamsService, InvitesService],
  exports: [TeamsService],
})
export class TeamsModule {}
