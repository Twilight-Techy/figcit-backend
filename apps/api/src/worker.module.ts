import { Module } from '@nestjs/common';

// The worker loads the same product modules as the API, without HTTP controllers.
// pg-boss and job handlers arrive with backend issue #30.
@Module({
  imports: [],
})
export class WorkerModule {}
