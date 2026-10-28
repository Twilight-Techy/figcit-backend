import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { PrivacyService } from './privacy.service.js';

const exportJobSchema = z.object({ id: z.uuid(), status: z.string() });
const exportsSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      status: z.string(),
      requestedAt: z.iso.datetime(),
      completedAt: z.iso.datetime().nullable(),
      expiresAt: z.iso.datetime().nullable(),
      url: z.string().nullable(),
    }),
  ),
});
const deleteSchema = z.object({ confirm: z.literal('delete my account') }).strict();
const deletedSchema = z.object({ scheduledFor: z.iso.datetime() });

@Controller('me')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Post('export')
  @HttpCode(202)
  @Route({
    summary: 'Ask for a copy of all my data (S56)',
    tags: ['Privacy'],
    response: exportJobSchema,
    status: 202,
  })
  export(@CurrentUser() user: RequestUser): Promise<z.infer<typeof exportJobSchema>> {
    return this.privacy.requestExport(user.id);
  }

  @Get('exports')
  @Route({
    summary: 'My data exports and download links',
    tags: ['Privacy'],
    response: exportsSchema,
  })
  async exports(@CurrentUser() user: RequestUser): Promise<z.infer<typeof exportsSchema>> {
    return { items: await this.privacy.exports(user.id) };
  }

  @Delete()
  @HttpCode(202)
  @Route({
    summary: 'Delete my account (hard delete after 30 days; S57)',
    tags: ['Privacy'],
    body: deleteSchema,
    response: deletedSchema,
    status: 202,
  })
  remove(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(deleteSchema)) _body: z.infer<typeof deleteSchema>,
  ): Promise<z.infer<typeof deletedSchema>> {
    return this.privacy.requestDeletion(user.id);
  }
}
