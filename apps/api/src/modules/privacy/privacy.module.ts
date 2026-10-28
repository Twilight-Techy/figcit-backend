import { Global, Module } from '@nestjs/common';
import { ExportBuilder } from './export.builder.js';
import { PrivacyController } from './privacy.controller.js';
import { PrivacyService } from './privacy.service.js';

@Global()
@Module({
  controllers: [PrivacyController],
  providers: [PrivacyService, ExportBuilder],
  exports: [PrivacyService],
})
export class PrivacyModule {}
