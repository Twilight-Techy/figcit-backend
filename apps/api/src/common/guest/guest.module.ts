import { Global, Module } from '@nestjs/common';
import { GuestCaps } from './guest-caps.service.js';

@Global()
@Module({ providers: [GuestCaps], exports: [GuestCaps] })
export class GuestModule {}
