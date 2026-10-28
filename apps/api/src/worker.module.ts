import { Module } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { WorkerRunner } from './worker.runner.js';

// The worker loads the same modules as the API (no HTTP server) and runs the job handlers.
@Module({ imports: [AppModule], providers: [WorkerRunner] })
export class WorkerModule {}
