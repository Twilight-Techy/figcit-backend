import { Global, Module } from '@nestjs/common';
import { RecommendationActionsService } from './actions.service.js';
import { RecommendationController } from './recommendation.controller.js';
import { RecommendationService } from './recommendation.service.js';
import { SignalsService } from './signals.service.js';

@Global()
@Module({
  controllers: [RecommendationController],
  providers: [RecommendationService, RecommendationActionsService, SignalsService],
  exports: [RecommendationService, SignalsService],
})
export class RecommendationModule {}
