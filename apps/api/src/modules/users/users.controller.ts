import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  ageConfirmationSchema,
  mePatchSchema,
  meSchema,
  preferencesPatchSchema,
  preferencesSchema,
  type MeDto,
  type PreferencesDto,
} from './users.schemas.js';
import { UsersService } from './users.service.js';
import type { z } from 'zod';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Route({
    summary: 'The signed-in user, with preferences and plan',
    tags: ['Users'],
    response: meSchema,
  })
  me(@CurrentUser() user: RequestUser): Promise<MeDto> {
    return this.users.me(user.id);
  }

  @Patch()
  @Route({
    summary: 'Update nickname, locale, onboarding progress',
    tags: ['Users'],
    body: mePatchSchema,
    response: meSchema,
  })
  update(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(mePatchSchema)) body: z.infer<typeof mePatchSchema>,
  ): Promise<MeDto> {
    return this.users.update(user.id, body);
  }

  @Put('preferences')
  @Route({
    summary: 'Update comfort and notification settings (last write wins per field)',
    tags: ['Users'],
    body: preferencesPatchSchema,
    response: preferencesSchema,
  })
  preferences(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(preferencesPatchSchema)) body: z.infer<typeof preferencesPatchSchema>,
  ): Promise<PreferencesDto> {
    return this.users.updatePreferences(user.id, body);
  }

  @Post('age-confirmation')
  @Route({
    summary: 'Confirm the user is 18 or over (D-02)',
    tags: ['Users'],
    body: ageConfirmationSchema,
    response: meSchema,
  })
  confirmAge(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(ageConfirmationSchema)) _body: z.infer<typeof ageConfirmationSchema>,
  ): Promise<MeDto> {
    return this.users.confirmAge(user.id);
  }
}
