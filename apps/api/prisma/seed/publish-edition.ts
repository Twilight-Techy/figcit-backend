// Publishes a workbook edition as the system, through the real services (so the rule store's
// audit log records it): `pnpm --filter @figcit/api ruleset:publish 5` for Rules Engine v5.0, or
// `3.3` to go back. Discards any open draft first. For local work, and for the switch to v5.0.
import 'reflect-metadata';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadDotEnv } from '../../src/common/config/dotenv.js';
import { DbModule } from '../../src/common/db/db.module.js';
import type { Actor } from '../../src/modules/rulesets/ruleset-audit.service.js';
import { RulesetLifecycleService } from '../../src/modules/rulesets/ruleset-lifecycle.service.js';
import { RulesetsModule } from '../../src/modules/rulesets/rulesets.module.js';
import { RulesetsService } from '../../src/modules/rulesets/rulesets.service.js';

// Outside production, the repo's .env, as the API reads it (never the shell's DATABASE_URL).
loadDotEnv();
const SYSTEM: Actor = { id: null, role: 'system' };

@Module({ imports: [DbModule, RulesetsModule] })
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- a Nest module is a decorated empty class
class PublishModule {}

const edition = process.argv[2];
if (edition !== '5' && edition !== '3.3') {
  process.stderr.write('Usage: ruleset:publish 5 | 3.3\n');
  process.exit(2);
}
const dir = resolve(import.meta.dirname, `../../../../docs/specs/rules-engine-v${edition}`);
const app = await NestFactory.createApplicationContext(PublishModule, { logger: ['error'] });
try {
  const files: Record<string, string> = {};
  for (const name of await readdir(dir))
    if (name.endsWith('.csv')) files[name] = await readFile(resolve(dir, name), 'utf8');
  const rulesets = app.get(RulesetsService);
  const lifecycle = app.get(RulesetLifecycleService);
  for (const v of (await rulesets.list()).filter(
    (x) => x.status === 'draft' || x.status === 'in_review',
  ))
    await lifecycle.discard(SYSTEM, v.label, `Replaced by workbook ${edition}`);
  const { version } = await rulesets.importWorkbook(
    SYSTEM,
    files,
    edition === '5' ? '5.0' : '3.3',
    `Workbook v${edition === '5' ? '5.0' : '3.3'}, published by ruleset:publish`,
  );
  await lifecycle.submit(SYSTEM, version.label);
  await lifecycle.publish(SYSTEM, version.label);
  process.stdout.write(`rule set ${version.label} published\n`);
} finally {
  await app.close();
}
