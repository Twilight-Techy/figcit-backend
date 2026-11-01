import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { CustomPlacesService, type CustomPlace } from './custom-places.service.js';

const place = z.object({ id: z.uuid(), label: z.string(), likeCode: z.string() });
const createBody = z
  .object({
    label: z.string().trim().min(1).max(40),
    likeCode: z.string().regex(/^[A-Za-z0-9_]{1,48}$/),
  })
  .strict();

/** The user's own places for the check-in (S10 "Somewhere else", S90; E-45). */
@Controller('custom-places')
export class CustomPlacesController {
  constructor(private readonly places: CustomPlacesService) {}

  @Get()
  @Route({
    summary: 'My places',
    tags: ['Check-in'],
    response: z.object({ items: z.array(place) }),
  })
  async list(@CurrentUser() user: RequestUser): Promise<{ items: CustomPlace[] }> {
    return { items: await this.places.list(user.id) };
  }

  @Post()
  @Route({
    summary: 'Save a place of my own, linked to the place it is most like',
    tags: ['Check-in'],
    body: createBody,
    response: place,
    status: 201,
    example: { body: { label: 'Library quiet zone', likeCode: 'school' } },
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(createBody)) body: z.infer<typeof createBody>,
  ): Promise<CustomPlace> {
    return this.places.create(user.id, body.label, body.likeCode);
  }

  @Delete(':id')
  @HttpCode(204)
  @Route({ summary: 'Remove one of my places', tags: ['Check-in'], status: 204 })
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.places.remove(user.id, id);
  }
}
