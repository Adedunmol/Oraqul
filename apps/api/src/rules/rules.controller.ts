import { Controller, Get } from '@nestjs/common';
import type { RulesResponse } from '@oraqul/schema';
import { rulesView } from './rules.view.js';

/** Spec §7 `GET /rules`. Public on purpose: it holds launch craft and sources, never team data. */
@Controller('rules')
export class RulesController {
  @Get()
  list(): RulesResponse {
    return rulesView();
  }
}
