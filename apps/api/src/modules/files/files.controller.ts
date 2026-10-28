import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Forbidden } from '../../common/errors/errors.js';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { StorageService } from '../../platform/storage/storage.service.js';
import { FilesService } from './files.service.js';

const uploadRequestSchema = z
  .object({
    purpose: z.enum(['practice_audio', 'voice_note', 'transcription_input']),
    contentType: z.string().max(64),
    sizeBytes: z.number().int().min(1),
  })
  .strict();
const uploadSchema = z.object({
  fileId: z.uuid(),
  upload: z.object({
    url: z.string(),
    method: z.literal('PUT'),
    headers: z.record(z.string(), z.string()),
    expiresAt: z.iso.datetime(),
  }),
});
const signedSchema = z
  .object({ e: z.coerce.number().int(), s: z.string().min(10).max(100) })
  .strict();
const urlSchema = z.object({ url: z.string() });

@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly storage: StorageService,
  ) {}

  @Post('uploads')
  @Route({
    summary: 'Get a link to upload a file to',
    tags: ['Files'],
    body: uploadRequestSchema,
    response: uploadSchema,
    status: 201,
  })
  upload(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(uploadRequestSchema)) body: z.infer<typeof uploadRequestSchema>,
  ): Promise<z.infer<typeof uploadSchema>> {
    return this.files.createUpload(user.id, body.purpose, body.contentType, body.sizeBytes);
  }

  @Post(':id/complete')
  @HttpCode(204)
  @Route({ summary: 'Tell us an S3 upload finished', tags: ['Files'], status: 204 })
  complete(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.files.markUploaded(user.id, id);
  }

  @Get(':id/url')
  @Route({ summary: 'A short-lived link to one of my files', tags: ['Files'], response: urlSchema })
  async url(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<z.infer<typeof urlSchema>> {
    return { url: await this.files.downloadUrl(user.id, id) };
  }

  @Put('local/:key')
  @HttpCode(204)
  @Route({
    summary: 'Local storage only: signed upload',
    tags: ['Files'],
    access: 'public',
    status: 204,
  })
  async put(
    @Param('key') key: string,
    @Query(new ZodPipe(signedSchema)) q: z.infer<typeof signedSchema>,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    if (!this.storage.verifyLocal(key, 'PUT', q.e, q.s))
      throw new Forbidden('This upload link has expired.');
    await this.files.receiveLocal(key, req.body as Buffer, req.headers['content-type'] ?? '');
  }

  @Get('local/:key')
  @Route({ summary: 'Local storage only: signed download', tags: ['Files'], access: 'public' })
  async get(
    @Param('key') key: string,
    @Query(new ZodPipe(signedSchema)) q: z.infer<typeof signedSchema>,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!this.storage.verifyLocal(key, 'GET', q.e, q.s))
      throw new Forbidden('This link has expired.');
    const body = await this.storage.get(key);
    await reply
      .header('content-type', await this.files.contentTypeOf(key))
      .header('cache-control', 'private, no-store')
      .send(body);
  }
}
