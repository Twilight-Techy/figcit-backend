import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadDotEnv } from './common/config/dotenv.js';
import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  loadDotEnv();
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
}

void bootstrap();
