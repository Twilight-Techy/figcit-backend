import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { AccessTokens } from './tokens.js';

@Global()
@Module({
  providers: [AccessTokens, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AccessTokens],
})
export class GuardsModule {}
