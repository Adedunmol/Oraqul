import { Body, Controller, Get, MessageEvent, Param, Post, Sse } from '@nestjs/common';
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
import { ZodPipe } from '../validation/zod.pipe.js';
import { AgentService } from './agent.service.js';

const startBodySchema = z.object({ mode: startModeSchema.default('start') });

// TODO(accounts): guard these with SessionGuard and RolesGuard once sessions work. They are open
// because only demo projects exist.
@Controller()
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Get('demo/projects')
  demoProjects() {
    return this.agent.demoProjects();
  }

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
