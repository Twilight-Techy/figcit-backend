import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

// Liveness only for now; readiness checks (database, queue) arrive with @nestjs/terminus.
@Module({ controllers: [HealthController] })
export class HealthModule {}
