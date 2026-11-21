import { Module } from '@nestjs/common';
import { AppFeedbackController } from './app-feedback.controller.js';
import { AppFeedbackService } from './app-feedback.service.js';
import { SurveyController } from './survey.controller.js';
import { SurveyService } from './survey.service.js';

@Module({
  controllers: [AppFeedbackController, SurveyController],
  providers: [AppFeedbackService, SurveyService],
})
export class AppFeedbackModule {}
