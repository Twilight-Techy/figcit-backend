import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  handoverSchema,
  inviteResultSchema,
  inviteSchema,
  reasonSchema,
  rolesSchema,
  staffListSchema,
  staffMemberSchema,
  type StaffMember,
} from './staff.schemas.js';
import { StaffService } from './staff.service.js';

const TAGS = ['Admin'];
const ADMIN = ['admin'] as const;
const userIdParam = new ParseUUIDPipe();

/**
 * Staff accounts (E-63, E-64): admins, never on their own account, all on the audit log; only the
 * Owner gives or takes Admin and Clinical admin, acts on an admin, or hands over.
 */
@Controller('admin/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @Route({
    summary: 'Staff, their roles and status',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    response: staffListSchema,
  })
  async list(): Promise<z.infer<typeof staffListSchema>> {
    return { items: await this.staff.list() };
  }

  @Post()
  @Route({
    summary:
      'Invite someone as staff: the email gets these roles and a note to sign in to the staff app',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: inviteSchema,
    response: inviteResultSchema,
    status: 201,
  })
  invite(
    @CurrentUser() admin: RequestUser,
    @Body(new ZodPipe(inviteSchema)) body: z.infer<typeof inviteSchema>,
  ): Promise<z.infer<typeof inviteResultSchema>> {
    return this.staff.invite(admin, body);
  }

  @Post('owner')
  @HttpCode(200)
  @Route({
    summary: 'Hand ownership to another active admin (the Owner only)',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: handoverSchema,
    response: staffListSchema,
  })
  async handover(
    @CurrentUser() actor: RequestUser,
    @Body(new ZodPipe(handoverSchema)) body: z.infer<typeof handoverSchema>,
  ): Promise<z.infer<typeof staffListSchema>> {
    return { items: await this.staff.handover(actor, body.userId, body.reason) };
  }

  @Patch(':userId')
  @Route({
    summary: "Change a staff member's roles",
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: rolesSchema,
    response: staffMemberSchema,
  })
  roles(
    @CurrentUser() admin: RequestUser,
    @Param('userId', userIdParam) userId: string,
    @Body(new ZodPipe(rolesSchema)) body: z.infer<typeof rolesSchema>,
  ): Promise<StaffMember> {
    return this.staff.setRoles(admin, userId, body.roles);
  }

  @Post(':userId/remove')
  @HttpCode(200)
  @Route({
    summary: 'Remove from staff: every staff role goes and their staff sessions end',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: reasonSchema,
    response: staffMemberSchema,
  })
  remove(
    @CurrentUser() admin: RequestUser,
    @Param('userId', userIdParam) userId: string,
    @Body(new ZodPipe(reasonSchema)) body: z.infer<typeof reasonSchema>,
  ): Promise<StaffMember> {
    return this.staff.remove(admin, userId, body.reason);
  }

  @Post(':userId/suspend')
  @HttpCode(200)
  @Route({
    summary: "Suspend: the account can't sign in and every session ends; roles are kept",
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: reasonSchema,
    response: staffMemberSchema,
  })
  suspend(
    @CurrentUser() admin: RequestUser,
    @Param('userId', userIdParam) userId: string,
    @Body(new ZodPipe(reasonSchema)) body: z.infer<typeof reasonSchema>,
  ): Promise<StaffMember> {
    return this.staff.suspend(admin, userId, body.reason);
  }

  @Post(':userId/reinstate')
  @HttpCode(200)
  @Route({
    summary: 'Reinstate a suspended staff account',
    tags: TAGS,
    access: 'staff',
    roles: ADMIN,
    body: reasonSchema,
    response: staffMemberSchema,
  })
  reinstate(
    @CurrentUser() admin: RequestUser,
    @Param('userId', userIdParam) userId: string,
    @Body(new ZodPipe(reasonSchema)) body: z.infer<typeof reasonSchema>,
  ): Promise<StaffMember> {
    return this.staff.reinstate(admin, userId, body.reason);
  }
}
