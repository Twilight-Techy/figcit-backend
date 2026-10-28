import { Controller, Get } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../common/db/prisma.service.js';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ContentService } from '../content/content.service.js';

const adaptSchema = z.object({
  kinds: z.array(
    z.object({
      kind: z.string(),
      title: z.string(),
      summary: z.string(),
      options: z.array(
        z.object({ code: z.string(), label: z.string(), detail: z.string(), saved: z.boolean() }),
      ),
    }),
  ),
  saved: z.array(z.object({ kind: z.string(), detailCode: z.string() })),
  commCards: z.array(z.object({ code: z.string(), text: z.string() })),
});

/** The Adapt library with the user's favourites first (S24, S120–S123). Re-running is POST /recommendations/{id}/adapt. */
@Controller('adapt')
export class AdaptController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
  ) {}

  @Get()
  @Route({ summary: 'Ways to adapt, favourites first', tags: ['Adapt'], response: adaptSchema })
  async library(@CurrentUser() user: RequestUser): Promise<z.infer<typeof adaptSchema>> {
    const [library, cards, saved] = await Promise.all([
      this.content.get('adapt.library'),
      this.content.get('comm.cards'),
      this.prisma.savedAdaptation.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { kind: true, detailCode: true },
      }),
    ]);
    const fav = new Set(saved.map((s) => `${s.kind}:${s.detailCode}`));
    return {
      kinds: library.map((k) => ({
        kind: k.kind,
        title: k.title,
        summary: k.summary,
        options: k.options
          .map((o) => ({ ...o, saved: fav.has(`${k.kind}:${o.code}`) }))
          .sort((a, b) => Number(b.saved) - Number(a.saved)),
      })),
      saved,
      commCards: [...cards],
    };
  }
}
