import { Body, Controller, Get, MessageEvent, Param, Post, Sse, UseGuards } from '@nestjs/common';
import {
  type Answer,
  answerSchema,
  type Category,
  categorySchema,
  type StartMode,
  startModeSchema,
} from '@oraqul/schema';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';
import { SessionGuard } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { AgentService } from './agent.service.js';

const startBodySchema = z.object({ mode: startModeSchema.default('start') });

// TODO(teams): add RolesGuard once projects belong to teams. Until then any signed in user can
// start a run, and the project id is still a category name.
@Controller()
@UseGuards(SessionGuard)
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('projects/:id/threads')
  createThread(
    @Param('id', new ZodPipe(categorySchema)) id: Category,
    @Body(new ZodPipe(startBodySchema)) body: { mode: StartMode },
  ) {
    return this.agent.createThread(id, body.mode);
  }

  @Get('threads/:id')
  thread(@Param('id') id: string) {
    return this.agent.thread(id);
  }

  @Post('threads/:id/messages')
  async answer(@Param('id') id: string, @Body(new ZodPipe(answerSchema)) body: Answer) {
    await this.agent.answer(id, body);
    return this.agent.thread(id);
  }

  @Sse('threads/:id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    return this.agent.events(id).pipe(map((event) => ({ data: event })));
  }
}
