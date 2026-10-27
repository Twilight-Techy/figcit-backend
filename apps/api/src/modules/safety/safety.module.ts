import { Global, Module } from '@nestjs/common';
import { SafetyController } from './safety.controller.js';
import { SafetyService } from './safety.service.js';
import { SupportService } from './support.service.js';

@Global()
@Module({
  controllers: [SafetyController],
  providers: [SafetyService, SupportService],
  exports: [SafetyService, SupportService],
})
export class SafetyModule {}
