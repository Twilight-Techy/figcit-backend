import { Global, Module } from '@nestjs/common';
import { SafetyController } from './safety.controller.js';
import { SafetyService } from './safety.service.js';
import { SupportService } from './support.service.js';
import { SustainedService } from './sustained.service.js';

@Global()
@Module({
  controllers: [SafetyController],
  providers: [SafetyService, SupportService, SustainedService],
  exports: [SafetyService, SupportService, SustainedService],
})
export class SafetyModule {}
