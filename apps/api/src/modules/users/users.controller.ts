import { Body, Controller, Get, HttpCode, Patch, Post, Put } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  ageConfirmationSchema,
  detailsResultSchema,
  detailsSchema,
  mePatchSchema,
  meSchema,
  preferencesPatchSchema,
  preferencesSchema,
  type MeDto,
  type PreferencesDto,
} from './users.schemas.js';
import { profilePatchSchema, profileViewSchema, type ProfileView } from './profile.schemas.js';
import { ProfileService } from './profile.service.js';
import { UsersService } from './users.service.js';
import type { z } from 'zod';

@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly profiles: ProfileService,
  ) {}

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

  @Get('profile')
  @Route({
    summary: 'Me: the optional profile and Life right now (ME-1 to ME-6), private by default',
    tags: ['Users'],
    response: profileViewSchema,
  })
  profile(@CurrentUser() user: RequestUser): Promise<ProfileView> {
    return this.profiles.view(user.id);
  }

  @Patch('profile')
  @Route({
    summary: 'Change the optional profile or Life right now; never changes the colour (LE-0)',
    tags: ['Users'],
    body: profilePatchSchema,
    response: profileViewSchema,
  })
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(profilePatchSchema)) body: z.infer<typeof profilePatchSchema>,
  ): Promise<ProfileView> {
    return this.profiles.update(user.id, body);
  }

  @Post('profile/prompt-dismissed')
  @HttpCode(200)
  @Route({
    summary: '"Make FigCit more yours" was dismissed: back in 7 days, 3 times at most (ME-1)',
    tags: ['Users'],
    response: profileViewSchema,
  })
  dismissPrompt(@CurrentUser() user: RequestUser): Promise<ProfileView> {
    return this.profiles.dismissPrompt(user.id);
  }

  @Post('details')
  @HttpCode(200)
  @Route({
    summary: 'Your details at sign-up: name, age band, country or nation, Terms (S04a, age rule)',
    tags: ['Users'],
    body: detailsSchema,
    response: detailsResultSchema,
  })
  saveDetails(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(detailsSchema)) body: z.infer<typeof detailsSchema>,
  ): Promise<z.infer<typeof detailsResultSchema>> {
    return this.users.saveDetails(user.id, body);
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
    @Body(new ZodPipe(ageConfirmationSchema)) body: z.infer<typeof ageConfirmationSchema>,
  ): Promise<MeDto> {
    return this.users.confirmAge(user.id, 'under18ViaInstitution' in body);
  }
}
