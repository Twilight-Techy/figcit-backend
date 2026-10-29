import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { PrismaService } from '../../common/db/prisma.service.js';
import { RulesService } from '../rules/rules.service.js';
import { SafetyService } from '../safety/safety.service.js';
import type {
  actionRequestSchema,
  actionResultSchema,
  adaptRequestSchema,
  CardDto,
  whySchema,
} from './recommendation.schemas.js';
import { RecommendationService } from './recommendation.service.js';
import { ADVANCED_DISMISSED, SignalsService } from './signals.service.js';

type ActionRequest = z.infer<typeof actionRequestSchema>;
type ActionResult = z.infer<typeof actionResultSchema>;
type AdaptRequest = z.infer<typeof adaptRequestSchema>;
type Why = z.infer<typeof whySchema>;

const GATE_TEXT: Readonly<Record<string, string>> = {
  limited: 'Kept this shorter or gentler',
  blocked: 'Left this out for now',
};

/** What the user does with a card: start, try another, not now, get support, adapt, why (S30–S35). */
@Injectable()
export class RecommendationActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recs: RecommendationService,
    private readonly signals: SignalsService,
    private readonly rules: RulesService,
    private readonly safety: SafetyService,
  ) {}

  async act(userId: string, id: string, req: ActionRequest): Promise<ActionResult> {
    const rec = await this.recs.stored(userId, id);
    const primaryTool = rec.trace.result.primary.toolId ?? null;
    await this.prisma.recommendationAction.create({
      data: {
        recommendationId: id,
        userId,
        action: req.action,
        toolId: req.toolId ?? primaryTool,
        reason: req.reason ?? null,
      },
    });
    switch (req.action) {
      case 'try_another': {
        // Avoid the suggestion just declined; the engine falls back to it only if nothing else fits here.
        const declined = req.toolId ?? primaryTool;
        const avoid = declined ? [declined] : [];
        const next = await this.recs.run(rec.trace.input, {
          userId,
          checkInId: rec.checkInId,
          taskId: rec.taskId,
          parentId: id,
          avoidTools: avoid,
        });
        return { ok: true, card: next.card, quietUntil: null };
      }
      case 'not_now':
        // Dismissing the Advanced alternative (ENT-3) is not a declined suggestion.
        if (req.reason === ADVANCED_DISMISSED) return { ok: true, card: null, quietUntil: null };
        return { ok: true, card: null, quietUntil: await this.quietUntil(userId) };
      case 'get_support':
        await this.safety.record({
          userId,
          sourceModule: 'recommendation',
          trigger: 'button',
          routeChosen: req.reason ?? null,
        });
        return { ok: true, card: null, quietUntil: null };
      case 'start':
      case 'correct':
      case 'why':
        return { ok: true, card: null, quietUntil: null };
    }
  }

  /** After enough declines in a session, the app goes quiet for a while (pattern 30). */
  private async quietUntil(userId: string): Promise<string | null> {
    const { snapshot } = await this.rules.current();
    const signals = await this.signals.load(userId);
    if ((signals.declinesThisSession ?? 0) < snapshot.thresholds.declinesBeforeQuiet) return null;
    return new Date(Date.now() + snapshot.thresholds.quietPeriodMinutes * 60_000).toISOString();
  }

  async adapt(userId: string, id: string, req: AdaptRequest): Promise<CardDto> {
    const rec = await this.recs.stored(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.adaptation.createMany({
        data: req.adaptations.map((a) => ({
          userId,
          recommendationId: id,
          kind: a.kind,
          detailCode: a.detailCode,
        })),
      });
      await tx.recommendationAction.create({
        data: { recommendationId: id, userId, action: 'adapt' },
      });
      if (req.save)
        await tx.savedAdaptation.createMany({
          data: req.adaptations.map((a) => ({ userId, kind: a.kind, detailCode: a.detailCode })),
          skipDuplicates: true,
        });
    });
    const kinds = [...new Set(req.adaptations.map((a) => a.kind))];
    const next = await this.recs.run(
      { ...rec.trace.input, adaptations: kinds },
      { userId, checkInId: rec.checkInId, taskId: rec.taskId, parentId: id },
    );
    return next.card;
  }

  async why(userId: string, id: string): Promise<Why> {
    const rec = await this.recs.stored(userId, id);
    const snapshot = await this.rules.byVersionOrCurrent(rec.trace.result.snapshotVersion);
    const r = rec.trace.result;
    const names = new Map(snapshot.patterns.map((p) => [p.id, p.suggestion]));
    return {
      reasons: [
        { code: 'state', text: `You picked ${r.state.name}: ${r.state.meaning}` },
        ...r.patterns.map((p) => ({
          code: `pattern_${String(p)}`,
          text: `NUCCESS suggests ${names.get(p) ?? 'this for your state'}.`,
        })),
        ...(r.drivers.length
          ? [{ code: 'drivers', text: `What usually gets you going: ${r.drivers.join(', ')}` }]
          : []),
      ],
      modifiers: r.band.modifiers.map((m) => ({ rule: m.rule, text: m.reason })),
      gates: r.gates
        .filter((g) => g.effect !== 'allowed')
        .map((g) => ({ rule: g.rule, effect: g.effect, text: GATE_TEXT[g.effect] ?? g.detail })),
      versions: { engine: r.engineVersion, snapshot: r.snapshotVersion },
    };
  }
}
