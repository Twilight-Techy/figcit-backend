import { Global, Module } from '@nestjs/common';
import { InstitutionsController } from './institutions.controller.js';
import { InstitutionsService } from './institutions.service.js';

@Global()
@Module({
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}
