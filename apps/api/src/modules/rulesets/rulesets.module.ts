import { Global, Module } from '@nestjs/common';
import { CheckInOptionsController } from './checkin-options.controller.js';
import { CheckInOptionsService } from './checkin-options.service.js';
import { RuleGapsService } from './rule-gaps.service.js';
import { RulesetAuditService } from './ruleset-audit.service.js';
import { RulesetLifecycleService } from './ruleset-lifecycle.service.js';
import { RulesetRecordsService } from './ruleset-records.service.js';
import { RulesetsController } from './rulesets.controller.js';
import { RulesetsService } from './rulesets.service.js';

/** Engine v2 rule store: versions, single-row edits, registers and the audit chain. */
@Global()
@Module({
  controllers: [CheckInOptionsController, RulesetsController],
  providers: [
    CheckInOptionsService,
    RulesetAuditService,
    RuleGapsService,
    RulesetLifecycleService,
    RulesetRecordsService,
    RulesetsService,
  ],
  exports: [CheckInOptionsService, RulesetsService],
})
export class RulesetsModule {}
