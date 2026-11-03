import { Global, Module } from '@nestjs/common';
import { CardBridgeService } from './card-bridge.service.js';
import { CheckInSimulatorService } from './checkin-simulator.service.js';
import { DecisionsController, EngineToolsController } from './decisions.controller.js';
import { DecisionsService } from './decisions.service.js';
import { EngineRuntimeService } from './engine-runtime.service.js';
import { EngineToolsService } from './engine-tools.service.js';
import { ExplorationsService } from './explorations.service.js';
import { ScenariosController } from './scenarios.controller.js';
import { ScenariosService } from './scenarios.service.js';

/** Engine v2 decisions, replay, the staff engine tools (M5) and the check-in's v2 cards (M8). */
@Global()
@Module({
  controllers: [DecisionsController, EngineToolsController, ScenariosController],
  providers: [
    DecisionsService,
    EngineRuntimeService,
    EngineToolsService,
    ExplorationsService,
    CardBridgeService,
    CheckInSimulatorService,
    ScenariosService,
  ],
  exports: [DecisionsService, CardBridgeService, ExplorationsService],
})
export class DecisionsModule {}
