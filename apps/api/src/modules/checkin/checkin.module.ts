import { Module } from '@nestjs/common';
import { CheckInController } from './checkin.controller.js';
import { CheckInRepository } from './checkin.repository.js';
import { CheckInService } from './checkin.service.js';

@Module({
  controllers: [CheckInController],
  providers: [CheckInService, CheckInRepository],
  exports: [CheckInService],
})
export class CheckInModule {}
