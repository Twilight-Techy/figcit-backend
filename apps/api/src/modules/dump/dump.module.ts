import { Global, Module } from '@nestjs/common';
import { DumpController } from './dump.controller.js';
import { DumpSortService } from './dump-sort.service.js';
import { DumpService } from './dump.service.js';

@Global()
@Module({
  controllers: [DumpController],
  providers: [DumpService, DumpSortService],
  exports: [DumpService],
})
export class DumpModule {}
