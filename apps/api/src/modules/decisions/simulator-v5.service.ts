import { Injectable } from '@nestjs/common';
import { factsFromCheckInV5, run, type EngineInput } from '@figcit/engine-v2';
import { BadInput, NotConfigured } from '../../common/errors/errors.js';
import { CheckInOptionsService } from '../rulesets/checkin-options.service.js';
import { SafetyService } from '../safety/safety.service.js';
import { EngineRuntimeService } from './engine-runtime.service.js';
import { menuOf, presentV5 } from './present-v5.js';
import type { SimulateV5Body, SimulateV5Result } from './v5.schemas.js';

const USUAL = 'usual';

/**
 * The staff Simulator for Rules Engine v5.0 (docs/engine-v2/V5.md): a v5.0 check-in, as the app
 * sends it, through any version, drafts included, with the account it stands for (plan, Life
 * right now, back to work). The same steps as a real decision: the options, the safety check, the
 * engine, the card as the app shows it. Nothing is stored and no safety event is made.
 */
@Injectable()
export class SimulatorV5Service {
  constructor(
    private readonly runtime: EngineRuntimeService,
    private readonly options: CheckInOptionsService,
    private readonly safety: SafetyService,
  ) {}

  async simulate(label: string, body: SimulateV5Body): Promise<SimulateV5Result> {
    const engine = await this.runtime.byLabel(label);
    const offered = await this.options.ofVersion(engine.id);
    if (!offered) throw new NotConfigured(`${label} has no check-in options.`);
    if (offered.options.help.length === 0)
      throw new BadInput(`${label} is not a v5.0 version; use the v3.3 Simulator.`);
    const c = body.checkIn;
    const risk = await this.safety.check([
      c.somethingElse?.text,
      ...(c.tasks ?? []).map((t) => t.title),
    ]);
    const lifeNow = body.lifeNow.filter((l) => l !== 'prefer_not');
    const server: EngineInput = {
      'signals.plan': body.plan,
      'prefs.return_to_work': body.returnToWork,
      'safety.risk': risk !== null,
      ...(lifeNow.length > 0 ? { 'life.now': lifeNow } : {}),
    };
    const { input, dropped } = factsFromCheckInV5(
      { ...c, somethingElseGroup: c.somethingElse?.group },
      offered.options,
      server,
    );
    const result = run(engine.ruleset, input, { trace: 'light' });
    const base = {
      version: { label: engine.label, status: engine.status },
      input: input as Record<string, unknown>,
      dropped: [...dropped],
      risk: { matched: risk !== null },
    };
    if (!result.ok)
      return {
        ...base,
        card: null,
        menu: { cards: [], more: [] },
        fired: [],
        issues: [...result.issues],
      };
    const chips = new Set(offered.options.task_kind.map((o) => o.code));
    const tasks = (c.tasks ?? []).map((t) => ({
      title: t.title,
      chip: t.chip && chips.has(t.chip) ? t.chip : USUAL,
    }));
    const sources = { copy: engine.copy, catalogue: engine.ruleset.catalogue, tasks, input };
    return {
      ...base,
      card: presentV5(result.card, sources),
      menu: menuOf(result.card, engine.ruleset.catalogue),
      fired: result.trace.fired.map(
        (id) => engine.refOf.get(id) ?? engine.refOf.get(id.split('#')[0] ?? id) ?? id,
      ),
      issues: [],
    };
  }
}
