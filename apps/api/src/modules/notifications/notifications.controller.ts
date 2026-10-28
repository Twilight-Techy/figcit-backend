import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { InboxService } from './inbox.service.js';
import {
  inboxSchema,
  pushSubscribeSchema,
  pushSubscriptionSchema,
  reminderCreateSchema,
  reminderListSchema,
  reminderSchema,
  reminderUpdateSchema,
  vapidSchema,
  type ReminderCreate,
  type ReminderDto,
} from './notifications.schemas.js';
import { PushService } from './push.service.js';
import { RemindersService } from './reminders.service.js';

const okSchema = z.object({ ok: z.literal(true) });

@Controller()
export class NotificationsController {
  constructor(
    private readonly push: PushService,
    private readonly reminders: RemindersService,
    private readonly inbox: InboxService,
  ) {}

  @Get('push/vapid-key')
  @Route({
    summary: 'The public key for Web Push',
    tags: ['Notifications'],
    access: 'public',
    response: vapidSchema,
  })
  vapid(): z.infer<typeof vapidSchema> {
    return { publicKey: this.push.publicKey };
  }

  @Post('push/subscriptions')
  @Route({
    summary: 'Register this device for push',
    tags: ['Notifications'],
    body: pushSubscribeSchema,
    response: pushSubscriptionSchema,
    status: 201,
  })
  subscribe(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(pushSubscribeSchema)) body: z.infer<typeof pushSubscribeSchema>,
  ): Promise<z.infer<typeof pushSubscriptionSchema>> {
    return this.push.subscribe(user.id, body);
  }

  @Delete('push/subscriptions/:id')
  @HttpCode(204)
  @Route({ summary: 'Stop push on a device', tags: ['Notifications'], status: 204 })
  unsubscribe(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.push.unsubscribe(user.id, id);
  }

  @Get('reminders')
  @Route({ summary: 'My reminders (S48)', tags: ['Notifications'], response: reminderListSchema })
  async list(@CurrentUser() user: RequestUser): Promise<z.infer<typeof reminderListSchema>> {
    return { items: await this.reminders.list(user.id) };
  }

  @Post('reminders')
  @Route({
    summary: 'Add a reminder (or "remind me later")',
    tags: ['Notifications'],
    body: reminderCreateSchema,
    response: reminderSchema,
    status: 201,
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(reminderCreateSchema)) body: ReminderCreate,
  ): Promise<ReminderDto> {
    return this.reminders.create(user.id, body);
  }

  @Patch('reminders/:id')
  @Route({
    summary: 'Change, pause or resume a reminder',
    tags: ['Notifications'],
    body: reminderUpdateSchema,
    response: reminderSchema,
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(reminderUpdateSchema)) body: z.infer<typeof reminderUpdateSchema>,
  ): Promise<ReminderDto> {
    return this.reminders.update(user.id, id, body);
  }

  @Delete('reminders/:id')
  @HttpCode(204)
  @Route({ summary: 'Delete a reminder', tags: ['Notifications'], status: 204 })
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.reminders.remove(user.id, id);
  }

  @Get('inbox')
  @Route({
    summary: 'Inbox: held reminders and notices',
    tags: ['Notifications'],
    response: inboxSchema,
  })
  list_(@CurrentUser() user: RequestUser): Promise<z.infer<typeof inboxSchema>> {
    return this.inbox.list(user.id);
  }

  @Post('inbox/read-all')
  @HttpCode(200)
  @Route({ summary: 'Mark everything read', tags: ['Notifications'], response: okSchema })
  async readAll(@CurrentUser() user: RequestUser): Promise<{ ok: true }> {
    await this.inbox.read(user.id, null);
    return { ok: true };
  }

  @Post('inbox/:id/read')
  @HttpCode(200)
  @Route({ summary: 'Mark an item read', tags: ['Notifications'], response: okSchema })
  async read(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    await this.inbox.read(user.id, id);
    return { ok: true };
  }
}
