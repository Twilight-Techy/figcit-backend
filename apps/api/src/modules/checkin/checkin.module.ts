import { Module } from '@nestjs/common';
import { CheckInController } from './checkin.controller.js';
import { CheckInRepository } from './checkin.repository.js';
import { CheckInEngineService } from './checkin-engine.service.js';
import { CheckInInputService } from './checkin-input.service.js';
import { CheckInService } from './checkin.service.js';
import { CustomPlacesController } from './custom-places.controller.js';
import { CustomPlacesService } from './custom-places.service.js';

@Module({
  controllers: [CheckInController, CustomPlacesController],
  providers: [
    CheckInService,
    CheckInEngineService,
    CheckInInputService,
    CheckInRepository,
    CustomPlacesService,
  ],
  exports: [CheckInService],
})
export class CheckInModule {}
