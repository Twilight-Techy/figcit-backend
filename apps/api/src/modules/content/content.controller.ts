import { Controller, Get, Header } from '@nestjs/common';
import { z } from 'zod';
import { Route } from '../../common/http/route.js';
import { ContentService } from './content.service.js';

const contentSchema = z.object({
  release: z.number().int(),
  items: z.array(
    z.object({ key: z.string(), kind: z.string(), version: z.number().int(), body: z.unknown() }),
  ),
});

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @Header('cache-control', 'public, max-age=300')
  @Route({
    summary:
      'Published content: prompts, starters, tool scripts (works signed out and offline-cached)',
    tags: ['Content'],
    access: 'public',
    response: contentSchema,
  })
  all(): Promise<z.infer<typeof contentSchema>> {
    return this.content.all();
  }
}
