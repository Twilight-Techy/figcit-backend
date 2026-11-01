import { Global, Module } from '@nestjs/common';
import { CardBridgeService } from './card-bridge.service.js';
import { DecisionsController, EngineToolsController } from './decisions.controller.js';
import { DecisionsService } from './decisions.service.js';
import { EngineRuntimeService } from './engine-runtime.service.js';

/** Engine v2 decisions, replay, the staff engine tools (M5) and the check-in's v2 cards (M8). */
@Global()
@Module({
  controllers: [DecisionsController, EngineToolsController],
  providers: [DecisionsService, EngineRuntimeService, CardBridgeService],
  exports: [DecisionsService, CardBridgeService],
})
export class DecisionsModule {}
