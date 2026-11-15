import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  invoiceSchema,
  invoicesSchema,
  invoiceStatusSchema,
  issuedCodeSchema,
  newInvoiceSchema,
  newLeadSchema,
  updateOrganisationSchema,
  type InvoiceDto,
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

  @Patch(':id')
  @Route({
    summary: 'Set the seats an organisation pays for, or its anonymity floor',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: updateOrganisationSchema,
    response: organisationSchema,
  })
  update(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateOrganisationSchema)) body: z.infer<typeof updateOrganisationSchema>,
  ): Promise<OrganisationDto> {
    return this.orgs.update(staff, id, body);
  }

  @Post(':id/leads')
  @Route({
    summary: "Make an account the organisation's support lead: they see its dashboard",
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: newLeadSchema,
    response: organisationSchema,
    status: 201,
  })
  addLead(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(newLeadSchema)) body: z.infer<typeof newLeadSchema>,
  ): Promise<OrganisationDto> {
    return this.orgs.addLead(staff, id, body);
  }

  @Get(':id/invoices')
  @Route({
    summary: "An organisation's invoices",
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    response: invoicesSchema,
  })
  async invoices(@Param('id', ParseUUIDPipe) id: string): Promise<z.infer<typeof invoicesSchema>> {
    return { items: await this.orgs.invoices(id) };
  }

  @Post(':id/invoices')
  @Route({
    summary: 'Draft an invoice for a month or a year of seats, VAT worked out',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: newInvoiceSchema,
    response: invoiceSchema,
    status: 201,
  })
  createInvoice(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(newInvoiceSchema)) body: z.infer<typeof newInvoiceSchema>,
  ): Promise<InvoiceDto> {
    return this.orgs.createInvoice(staff, id, body);
  }

  @Patch(':id/invoices/:invoiceId')
  @Route({
    summary: 'Mark an invoice sent, paid or void',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: invoiceStatusSchema,
    response: invoiceSchema,
  })
  setInvoiceStatus(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body(new ZodPipe(invoiceStatusSchema)) body: z.infer<typeof invoiceStatusSchema>,
  ): Promise<InvoiceDto> {
    return this.orgs.setInvoiceStatus(staff, id, invoiceId, body);
  }
}
