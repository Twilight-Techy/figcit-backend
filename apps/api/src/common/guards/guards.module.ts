import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccountGuard } from './account.guard.js';
import { AuthGuard } from './auth.guard.js';
import { AccessTokens } from './tokens.js';

// Order matters: AuthGuard attaches the user, then AccountGuard reads it.
@Global()
@Module({
  providers: [
    AccessTokens,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AccountGuard },
  ],
  exports: [AccessTokens],
})
export class GuardsModule {}
