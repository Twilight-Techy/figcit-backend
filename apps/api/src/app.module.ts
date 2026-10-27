import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';

// One module per line, alphabetical, so merge conflicts are a one-line keep-both (WORKFLOW §3).
@Module({
  imports: [HealthModule],
})
export class AppModule {}
