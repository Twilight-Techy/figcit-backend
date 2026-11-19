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
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  commCardInputSchema,
  commCardListSchema,
  commCardSchema,
  type CommCardDto,
  type CommCardInput,
} from './cards.schemas.js';
import { CommCardsService } from './cards.service.js';

/** Communication cards the person wrote (S117), shown beside the app's own set. */
@Controller('comm-cards')
export class CommCardsController {
  constructor(private readonly cards: CommCardsService) {}

  @Get()
  @Route({ summary: 'My own communication cards', tags: ['Express'], response: commCardListSchema })
  async list(@CurrentUser() user: RequestUser): Promise<z.infer<typeof commCardListSchema>> {
    return { items: await this.cards.list(user.id) };
  }

  @Post()
  @Route({
    summary: 'Add a communication card (up to 50)',
    tags: ['Express'],
    body: commCardInputSchema,
    response: commCardSchema,
    status: 201,
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(commCardInputSchema)) body: CommCardInput,
  ): Promise<CommCardDto> {
    return this.cards.create(user.id, body);
  }

  @Patch(':id')
  @Route({
    summary: 'Change what a card says',
    tags: ['Express'],
    body: commCardInputSchema,
    response: commCardSchema,
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(commCardInputSchema)) body: CommCardInput,
  ): Promise<CommCardDto> {
    return this.cards.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Route({ summary: 'Delete a card of my own', tags: ['Express'], status: 204 })
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.cards.remove(user.id, id);
  }
}
