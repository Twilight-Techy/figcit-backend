import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { CryptoService, type UserCipher } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotEntitled, NotFound } from '../../common/errors/errors.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import { decodeCursor, encodeCursor } from '../checkin/checkin.mapper.js';
import type { ReflectVariant } from '../content/catalogue/reflect.js';
import { ContentService } from '../content/content.service.js';
import { ReflectDeps } from './reflect.deps.js';
import { improvedTopics } from './rumination.js';
import type {
  Gate,
  listQuerySchema,
  reflectionCreatedSchema,
  ReflectionCreate,
  ReflectionDto,
  reflectionUpdateSchema,
} from './reflect.schemas.js';

const SELECT = {
  id: true,
  variant: true,
  answersEnc: true,
  takeawayEnc: true,
  topicTag: true,
  saved: true,
  savedForLater: true,
  createdAt: true,
} satisfies Prisma.ReflectionSelect;
type Row = Prisma.ReflectionGetPayload<{ select: typeof SELECT }>;
interface StoredAnswers {
  readonly answers: { promptId: string; chips: string[]; text?: string | undefined }[];
  readonly winSize?: string | undefined;
}

const NOT_HERE = new Set(['formal', 'exam', 'clinical', 'worship']);
const RUMINATION_DAYS = 7;
const ALT = {
  dump: { pathway: 'dump', toolId: 'dump_text', label: 'Dump it out', href: '/dump/' },
  breathe: {
    pathway: 'regulate',
    toolId: 'breathe',
    label: 'A 2-minute reset',
    href: '/regulate/session/?tool=breathe&min=2',
  },
  ground: {
    pathway: 'regulate',
    toolId: 'ground',
    label: 'Ground for 3 minutes',
    href: '/regulate/session/?tool=ground&min=3',
  },
  talk: {
    pathway: 'connect',
    toolId: 'trusted_contact',
    label: 'Talk to someone',
    href: '/connect/?tool=trusted_contact',
  },
} as const;

function toDto(r: Row, c: UserCipher, variants: readonly ReflectVariant[]): ReflectionDto {
  const v = variants.find((x) => x.code === r.variant);
  const stored = JSON.parse(c.dec(r.answersEnc)) as StoredAnswers;
  return {
    id: r.id,
    variant: r.variant,
    kind: v?.kind ?? 'prompts',
    title: v?.title ?? 'Reflection',
    answers: stored.answers.map((a) => ({
      promptId: a.promptId,
      prompt: v?.prompts.find((p) => p.id === a.promptId)?.text ?? '',
      chips: a.chips,
      text: a.text ?? null,
    })),
    takeaway: c.decOpt(r.takeawayEnc),
    topicTag: r.topicTag,
    winSize: stored.winSize ?? null,
    saved: r.saved,
    savedForLater: r.savedForLater,
    createdAt: r.createdAt.toISOString(),
  };
}

/** RF-1 and the context filter: no looking back in distress or where it can't be done. */
function distressBlock(
  state: { light: Gate['light']; peakNegative: number },
  high: number,
  settingClass: string | undefined,
): Gate | null {
  const { light } = state;
  if (light === 'red')
    return {
      allowed: false,
      reason: 'regulate_first',
      rule: 'RF-1',
      light,
      alternatives: [ALT.dump, ALT.breathe],
    };
  if (light === 'amber' || state.peakNegative >= high)
    return {
      allowed: false,
      reason: 'save_for_later',
      rule: 'RF-1',
      light,
      alternatives: [ALT.dump, ALT.breathe],
    };
  if (settingClass && NOT_HERE.has(settingClass))
    return { allowed: false, reason: 'not_here', rule: 'CX-D', light, alternatives: [ALT.breathe] };
  return null;
}

/** Reflect: three prompts, private, gated against distress and rumination (M10, RF-1–RF-5). */
@Injectable()
export class ReflectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly content: ContentService,
    private readonly deps: ReflectDeps,
    private readonly events: DomainEvents,
  ) {}

  variants(): Promise<readonly ReflectVariant[]> {
    return this.content.get('reflect.variants');
  }

  async variantsFor(userId: string): Promise<(ReflectVariant & { locked: boolean })[]> {
    const plus = (await this.deps.entitlements.tierFor(userId)) === 'plus';
    return (await this.variants()).map((v) => ({ ...v, locked: v.tier === 'advanced' && !plus }));
  }

  /** Whether Reflect should be offered right now (RF-1, RF-2, context filter D). */
  async gate(
    userId: string,
    q: { variant?: string | undefined; topicTag?: string | undefined },
  ): Promise<Gate> {
    const [state, { snapshot }, variants] = await Promise.all([
      this.deps.recs.currentState(userId),
      this.deps.rules.current(),
      this.variants(),
    ]);
    const variant = q.variant ? variants.find((v) => v.code === q.variant) : undefined;
    const light = state.light;
    if (variant?.tier === 'advanced' && (await this.deps.entitlements.tierFor(userId)) !== 'plus')
      return { allowed: false, reason: 'advanced', rule: 'ENT-1', light, alternatives: [] };
    // A win or a gratitude note is a lighter task than looking back over a hard day.
    const lightTouch = variant?.kind === 'win' || variant?.code === 'gratitude';
    const settingClass = snapshot.environments.find((e) => e.code === state.setting)?.settingClass;
    const blocked = lightTouch
      ? null
      : distressBlock(state, snapshot.thresholds.high, settingClass);
    if (blocked) return blocked;
    const ruminating =
      state.families.includes('rumination') ||
      (q.topicTag !== undefined &&
        (await this.topicLoops(userId, q.topicTag, snapshot.thresholds.ruminationTopicCount)));
    if (!lightTouch && ruminating)
      return {
        allowed: false,
        reason: 'rumination',
        rule: 'RF-2',
        light,
        alternatives: [ALT.dump, ALT.ground, ALT.talk],
      };
    return { allowed: true, reason: 'ok', rule: null, light, alternatives: [] };
  }

  private async topicCount(userId: string, topicTag: string): Promise<number> {
    return this.prisma.reflection.count({
      where: {
        userId,
        topicTag,
        deletedAt: null,
        savedForLater: false,
        createdAt: { gt: new Date(Date.now() - RUMINATION_DAYS * 86_400_000) },
      },
    });
  }

  async create(
    userId: string,
    input: ReflectionCreate,
  ): Promise<z.infer<typeof reflectionCreatedSchema>> {
    const c = await this.crypto.forUser(userId);
    const variants = await this.variants();
    if (input.id) {
      const existing = await this.prisma.reflection.findFirst({
        where: { id: input.id, userId },
        select: SELECT,
      });
      if (existing) return { ...toDto(existing, c, variants), safety: false, crisisRoutes: [] };
    }
    const v = await this.validate(userId, input, variants);
    // RF-5: any free text passes the safety screen.
    const match = await this.deps.safety.check([
      ...input.answers.map((a) => a.text),
      input.takeaway,
    ]);
    const row = await this.prisma.reflection.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        userId,
        sessionId: input.sessionId ?? null,
        variant: v.code,
        answersEnc: c.enc(
          JSON.stringify({
            answers: input.answers,
            winSize: input.winSize,
          } satisfies StoredAnswers),
        ),
        takeawayEnc: c.encOpt(input.takeaway),
        topicTag: input.topicTag ?? null,
        saved: input.saved,
        savedForLater: input.savedForLater,
        safetyFlag: match !== null,
      },
      select: SELECT,
    });
    if (input.topicTag) await this.rollUpTopic(userId, input.topicTag);
    const crisisRoutes = match
      ? await this.deps.safety.flag(userId, 'reflect', match, input.origin)
      : [];
    this.events.emit('reflection.created', {
      userId,
      reflectionId: row.id,
      topicTag: input.topicTag ?? null,
      dumpItemId: input.dumpItemId ?? null,
    });
    return { ...toDto(row, c, variants), safety: match !== null, crisisRoutes };
  }

  private async validate(
    userId: string,
    input: ReflectionCreate,
    variants: readonly ReflectVariant[],
  ): Promise<ReflectVariant> {
    const v = variants.find((x) => x.code === input.variant);
    if (!v) throw new BadInput(`Unknown reflection: ${input.variant}`);
    if (v.tier === 'advanced' && (await this.deps.entitlements.tierFor(userId)) !== 'plus')
      throw new NotEntitled(v.title);
    const known = new Set(v.prompts.map((p) => p.id));
    if (input.answers.some((a) => !known.has(a.promptId)))
      throw new BadInput('An answer does not match this reflection.');
    if (
      input.sessionId &&
      (await this.prisma.pathwaySession.count({ where: { id: input.sessionId, userId } })) === 0
    )
      throw new NotFound('session');
    return v;
  }

  /** RF-2: the same topic reflected on too often in 7 days, with no improvement. */
  private async topicLoops(userId: string, topicTag: string, limit: number): Promise<boolean> {
    if ((await this.topicCount(userId, topicTag)) < limit) return false;
    return !(await improvedTopics(this.prisma, userId, [topicTag])).has(topicTag);
  }

  /** Keeps user_topic_counts current for the rumination gate (RF-2) and the engine's signals. */
  async rollUpTopic(userId: string, topicTag: string): Promise<void> {
    const [count7d, countAll] = await Promise.all([
      this.topicCount(userId, topicTag),
      this.prisma.reflection.count({ where: { userId, topicTag, deletedAt: null } }),
    ]);
    await this.prisma.userTopicCount.upsert({
      where: { userId_topicTag: { userId, topicTag } },
      create: { userId, topicTag, count7d, countAll, lastAt: new Date() },
      update: { count7d, countAll, lastAt: new Date() },
    });
  }

  async get(userId: string, id: string): Promise<ReflectionDto> {
    const row = await this.prisma.reflection.findFirst({
      where: { id, userId, deletedAt: null },
      select: SELECT,
    });
    if (!row) throw new NotFound('reflection');
    return toDto(row, await this.crypto.forUser(userId), await this.variants());
  }

  async list(
    userId: string,
    q: z.infer<typeof listQuerySchema>,
  ): Promise<{ items: ReflectionDto[]; next: string | null }> {
    const variants = await this.variants();
    const codes =
      q.kind === 'all' || q.kind === 'later'
        ? null
        : variants.filter((v) => v.kind === q.kind).map((v) => v.code);
    const cur = q.after ? decodeCursor(q.after) : null;
    const rows = await this.prisma.reflection.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(q.kind === 'later'
          ? { savedForLater: true }
          : { OR: [{ saved: true }, { savedForLater: false }] }),
        ...(codes ? { variant: { in: codes } } : {}),
        ...(cur
          ? {
              AND: [
                {
                  OR: [
                    { createdAt: { lt: cur.createdAt } },
                    { createdAt: cur.createdAt, id: { lt: cur.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      select: SELECT,
    });
    const c = await this.crypto.forUser(userId);
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return {
      items: page.map((r) => toDto(r, c, variants)),
      next: rows.length > q.limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async update(
    userId: string,
    id: string,
    input: z.infer<typeof reflectionUpdateSchema>,
  ): Promise<ReflectionDto> {
    await this.get(userId, id);
    const c = await this.crypto.forUser(userId);
    await this.prisma.reflection.update({
      where: { id },
      data: {
        ...(input.saved !== undefined ? { saved: input.saved } : {}),
        ...(input.savedForLater !== undefined ? { savedForLater: input.savedForLater } : {}),
        ...(input.takeaway !== undefined ? { takeawayEnc: c.encOpt(input.takeaway) } : {}),
      },
    });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.reflection.findFirst({
      where: { id, userId, deletedAt: null },
      select: { topicTag: true },
    });
    if (!row) throw new NotFound('reflection');
    await this.prisma.reflection.update({ where: { id }, data: { deletedAt: new Date() } });
    if (row.topicTag) await this.rollUpTopic(userId, row.topicTag);
  }
}
