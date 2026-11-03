import { Injectable } from '@nestjs/common';
import type { CaseContext, CheckInCase } from '@figcit/engine-v2';
import { BadInput } from '../../common/errors/errors.js';
import { CheckInOptionsService } from '../rulesets/checkin-options.service.js';
import { SafetyService } from '../safety/safety.service.js';
import { signalFacts } from './decision-facts.js';
import type { caseSchema } from './decisions.schemas.js';
import type { Runnable } from './engine-runtime.service.js';
import type { z } from 'zod';

/** A check-in the explorer made, as the Simulator takes it. */
export const caseDto = (c: CheckInCase): z.infer<typeof caseSchema> => ({
  checkIn: c.checkIn as unknown as Record<string, unknown>,
  account: c.account,
  signals: { ...c.signals },
  declined: [...c.declined],
});

/**
 * What the explorer's check-ins need from the server (E-61): the version's options, a signed-in
 * new user's signals as the server sends them (`signalFacts` of an empty history), and words the
 * risk check matches.
 */
@Injectable()
export class CaseContextService {
  constructor(
    private readonly options: CheckInOptionsService,
    private readonly safety: SafetyService,
  ) {}

  async of(engine: Runnable): Promise<CaseContext> {
    const offered = await this.options.ofVersion(engine.id);
    if (!offered)
      throw new BadInput(`${engine.label} has no check-in options to make check-ins from.`);
    const newUser = Object.fromEntries(
      Object.entries(signalFacts({ plan: 'free' }, engine.ruleset.catalogue)).filter(
        ([fact]) => fact !== 'signals.plan',
      ),
    );
    const riskText = await this.safety.sampleRiskWords();
    return {
      options: offered.options,
      newUser: { ...newUser, 'signals.days_very_constrained': 0 },
      ...(riskText ? { riskText } : {}),
    };
  }
}
