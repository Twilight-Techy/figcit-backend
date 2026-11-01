// Publishes the engine v2 rule set from the workbook when none with check-in options is published
// (DECISION_LOG E-40): import into a draft, submit, publish, through the real services so the rule
// store audit log records it. The seed acts as the system (no user). Idempotent.
import 'reflect-metadata';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DbModule } from '../../src/common/db/db.module.js';
import { CheckInOptionsService } from '../../src/modules/rulesets/checkin-options.service.js';
import type { Actor } from '../../src/modules/rulesets/ruleset-audit.service.js';
import { RulesetLifecycleService } from '../../src/modules/rulesets/ruleset-lifecycle.service.js';
import { RulesetsModule } from '../../src/modules/rulesets/rulesets.module.js';
import { RulesetsService } from '../../src/modules/rulesets/rulesets.service.js';

const WORKBOOK = resolve(import.meta.dirname, '../../../../docs/specs/rules-engine-v3.3');
const SYSTEM: Actor = { id: null, role: 'system' };

@Module({ imports: [DbModule, RulesetsModule] })
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- a Nest module is a decorated empty class
class SeedRulesetModule {}

export async function seedRuleset(): Promise<string> {
  const app = await NestFactory.createApplicationContext(SeedRulesetModule, { logger: ['error'] });
  try {
    const current = await app.get(CheckInOptionsService).current();
    if (current) return current.dto.version;
    const files: Record<string, string> = {};
    for (const name of await readdir(WORKBOOK))
      if (name.endsWith('.csv')) files[name] = await readFile(resolve(WORKBOOK, name), 'utf8');
    const rulesets = app.get(RulesetsService);
    const open = (await rulesets.list()).filter(
      (v) => v.status === 'draft' || v.status === 'in_review',
    );
    const lifecycle = app.get(RulesetLifecycleService);
    for (const v of open) await lifecycle.discard(SYSTEM, v.label, 'Replaced by the seed');
    const { version } = await rulesets.importWorkbook(
      SYSTEM,
      files,
      '3.3',
      'Workbook v3.3, by the seed',
    );
    await lifecycle.submit(SYSTEM, version.label);
    await lifecycle.publish(SYSTEM, version.label);
    return version.label;
  } finally {
    await app.close();
  }
}
