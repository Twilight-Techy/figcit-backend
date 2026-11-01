import { Module } from '@nestjs/common';
import { DecisionsController, EngineToolsController } from './decisions.controller.js';
import { DecisionsService } from './decisions.service.js';
import { EngineRuntimeService } from './engine-runtime.service.js';

/** Engine v2 decisions, replay and the staff engine tools (M5). */
@Module({
  controllers: [DecisionsController, EngineToolsController],
  providers: [DecisionsService, EngineRuntimeService],
  exports: [DecisionsService],
})
export class DecisionsModule {}
