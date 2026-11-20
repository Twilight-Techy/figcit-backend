import { Module } from '@nestjs/common';
import { AppFeedbackController } from './app-feedback.controller.js';
import { AppFeedbackService } from './app-feedback.service.js';

@Module({ controllers: [AppFeedbackController], providers: [AppFeedbackService] })
export class AppFeedbackModule {}
