import { Module } from '@nestjs/common';
import { RuleGapsService } from './rule-gaps.service.js';
import { RulesetAuditService } from './ruleset-audit.service.js';
import { RulesetLifecycleService } from './ruleset-lifecycle.service.js';
import { RulesetRecordsService } from './ruleset-records.service.js';
import { RulesetsController } from './rulesets.controller.js';
import { RulesetsService } from './rulesets.service.js';

/** Engine v2 rule store: versions, single-row edits, registers and the audit chain. */
@Module({
  controllers: [RulesetsController],
  providers: [
    RulesetAuditService,
    RuleGapsService,
    RulesetLifecycleService,
    RulesetRecordsService,
    RulesetsService,
  ],
  exports: [RulesetsService],
})
export class RulesetsModule {}
