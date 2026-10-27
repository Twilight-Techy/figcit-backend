import { Global, Module } from '@nestjs/common';
import { RulesController } from './rules.controller.js';
import { RulesService } from './rules.service.js';

@Global()
@Module({ controllers: [RulesController], providers: [RulesService], exports: [RulesService] })
export class RulesModule {}
