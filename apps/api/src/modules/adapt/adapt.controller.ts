import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../common/db/prisma.service.js';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { AppError } from '../../common/errors/errors.js';
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

const KINDS = [
  'environment',
  'scope',
  'modality',
  'pace',
  'sequence',
  'instructions',
  'communication',
] as const;
const rememberSchema = z
  .object({
    kind: z.enum(KINDS),
    detailCode: z.string().regex(/^[a-z0-9_]{1,64}$/),
  })
  .strict();

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

  /** "Remember what helps me" (Prime, brief: saved "what helps me" settings): from a task or step sheet. */
  @Post('saved')
  @HttpCode(204)
  @Route({
    summary: 'Remember an Adapt option as what helps me',
    tags: ['Adapt'],
    body: rememberSchema,
    status: 204,
  })
  async remember(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(rememberSchema)) body: z.infer<typeof rememberSchema>,
  ): Promise<void> {
    const library = await this.content.get('adapt.library');
    const known = library.some(
      (k) => k.kind === body.kind && k.options.some((o) => o.code === body.detailCode),
    );
    if (!known)
      throw new AppError(400, 'unknown_option', 'That option is not in the Adapt library');
    await this.prisma.savedAdaptation.createMany({
      data: [{ userId: user.id, kind: body.kind, detailCode: body.detailCode }],
      skipDuplicates: true,
    });
  }

  @Delete('saved/:kind/:detailCode')
  @HttpCode(204)
  @Route({
    summary: 'Forget an Adapt option remembered as what helps me',
    tags: ['Adapt'],
    status: 204,
  })
  async forget(
    @CurrentUser() user: RequestUser,
    @Param('kind') kind: string,
    @Param('detailCode') detailCode: string,
  ): Promise<void> {
    const k = z.enum(KINDS).safeParse(kind);
    if (!k.success) return;
    await this.prisma.savedAdaptation.deleteMany({
      where: { userId: user.id, kind: k.data, detailCode },
    });
  }
}
