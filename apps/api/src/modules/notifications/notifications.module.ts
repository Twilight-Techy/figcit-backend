import { Global, Module } from '@nestjs/common';
import { DispatcherService } from './dispatcher.service.js';
import { InboxService } from './inbox.service.js';
import { NotificationsController } from './notifications.controller.js';
import { PushService } from './push.service.js';
import { RemindersService } from './reminders.service.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [PushService, RemindersService, InboxService, DispatcherService],
  exports: [InboxService, DispatcherService, RemindersService, PushService],
})
export class NotificationsModule {}
