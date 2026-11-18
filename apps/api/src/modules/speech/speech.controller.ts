import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { FilesService } from '../files/files.service.js';
import { SpeechService, type TranscriptionDto } from './speech.service.js';
import { RequiresAccount } from '../../common/guest/requires-account.js';

const uploadSchema = z
  .object({ contentType: z.string().max(64), sizeBytes: z.number().int().min(1) })
  .strict();
const uploadResultSchema = z.object({
  fileId: z.uuid(),
  upload: z.object({
    url: z.string(),
    method: z.literal('PUT'),
    headers: z.record(z.string(), z.string()),
    expiresAt: z.iso.datetime(),
  }),
  serverAvailable: z.boolean(),
});
const requestSchema = z
  .object({
    fileId: z.uuid(),
    purpose: z.enum(['dump', 'express', 'checkin', 'practice', 'reflect']),
  })
  .strict();
const transcriptionSchema = z.object({
  id: z.uuid(),
  status: z.enum(['pending', 'processing', 'done', 'failed']),
  text: z.string().nullable(),
  errorCode: z.string().nullable(),
  safety: z.boolean(),
});

@RequiresAccount()
@Controller('speech')
export class SpeechController {
  constructor(
    private readonly speech: SpeechService,
    private readonly files: FilesService,
  ) {}

  @Post('uploads')
  @Route({
    summary: 'Get a link to upload a recording (up to 10 minutes; S102)',
    tags: ['Speech'],
    body: uploadSchema,
    response: uploadResultSchema,
    status: 201,
  })
  async upload(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(uploadSchema)) body: z.infer<typeof uploadSchema>,
  ): Promise<z.infer<typeof uploadResultSchema>> {
    return {
      ...(await this.files.createUpload(
        user.id,
        'transcription_input',
        body.contentType,
        body.sizeBytes,
      )),
      serverAvailable: this.speech.available,
    };
  }

  @Post('transcriptions')
  @Route({
    summary: 'Turn an uploaded recording into text',
    tags: ['Speech'],
    body: requestSchema,
    response: transcriptionSchema,
    status: 201,
  })
  request(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(requestSchema)) body: z.infer<typeof requestSchema>,
  ): Promise<TranscriptionDto> {
    return this.speech.request(user.id, body.fileId, body.purpose);
  }

  @Get('transcriptions/:id')
  @Route({
    summary: 'A transcription (poll until done)',
    tags: ['Speech'],
    response: transcriptionSchema,
  })
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TranscriptionDto> {
    return this.speech.get(user.id, id);
  }
}
