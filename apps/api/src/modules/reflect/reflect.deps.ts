import { Injectable } from '@nestjs/common';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { RecommendationService } from '../recommendation/recommendation.service.js';
import { RulesService } from '../rules/rules.service.js';
import { SafetyService } from '../safety/safety.service.js';

/** Grouped collaborators, so ReflectService stays within the parameter limit (rules §3). */
@Injectable()
export class ReflectDeps {
  constructor(
    readonly recs: RecommendationService,
    readonly rules: RulesService,
    readonly safety: SafetyService,
    readonly entitlements: EntitlementsService,
  ) {}
}
