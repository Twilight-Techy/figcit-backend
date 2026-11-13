import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  issuedCodeSchema,
  newCodeSchema,
  newOrganisationSchema,
  organisationSchema,
  organisationsSchema,
  type OrganisationDto,
} from './organisations.schemas.js';
import { OrganisationsService } from './organisations.service.js';

const TAGS = ['Admin'];
const ADMIN = ['admin'] as const;

/** Organisations and their codes, for FigCit staff (Developer Brief, Organisation seats). */
@Controller('admin/organisations')
export class OrganisationsController {
  constructor(private readonly orgs: OrganisationsService) {}

  @Get()
  @Route({
    summary: 'Organisations, their codes and how many places are in use',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    response: organisationsSchema,
  })
  async list(): Promise<z.infer<typeof organisationsSchema>> {
    return { items: await this.orgs.list() };
  }

  @Post()
  @Route({
    summary: 'Add an organisation: its people get Premium (a seat) or the six-week pilot',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: newOrganisationSchema,
    response: organisationSchema,
    status: 201,
  })
  create(
    @CurrentUser() staff: RequestUser,
    @Body(new ZodPipe(newOrganisationSchema)) body: z.infer<typeof newOrganisationSchema>,
  ): Promise<OrganisationDto> {
    return this.orgs.create(staff, body);
  }

  @Post(':id/codes')
  @Route({
    summary: 'Issue an organisation code: people enter it at sign-up or in Plans',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: newCodeSchema,
    response: issuedCodeSchema,
    status: 201,
  })
  issue(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(newCodeSchema)) body: z.infer<typeof newCodeSchema>,
  ): Promise<z.infer<typeof issuedCodeSchema>> {
    return this.orgs.issueCode(staff, id, body);
  }
}
