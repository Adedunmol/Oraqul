import { Module } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';
import { SessionGuard } from './session.guard.js';

// TODO: email and password, Google OAuth and email code sign in. See docs/backend/README.md.
@Module({
  providers: [SessionGuard, RolesGuard],
  exports: [SessionGuard, RolesGuard],
})
export class AuthModule {}
