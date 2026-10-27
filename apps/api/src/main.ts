import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { loadDotEnv } from './common/config/dotenv.js';
import { loadEnv } from './common/config/env.js';

async function bootstrap(): Promise<void> {
  loadDotEnv();
  const env = loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();
