import { Global, Module } from '@nestjs/common';
import { AiClient } from './ai.client.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';

@Global()
@Module({ controllers: [AiController], providers: [AiClient, AiService], exports: [AiService] })
export class AiModule {}
