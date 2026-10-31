// Licence allow-list for shipped (production) dependencies (ENGINEERING_RULES §16).
// An "A OR B" expression passes if either side is allowed. Exceptions name a package, not a
// licence, so a new package under an unlisted licence still fails until someone reviews it.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ALLOWED = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
  '0BSD',
  'MIT-0',
]);
const exceptions = JSON.parse(
  readFileSync(new URL('../licences.exceptions.json', import.meta.url)),
);
const list = JSON.parse(
  execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], { encoding: 'utf8' }),
);
const ok = (expr) =>
  expr
    .replace(/[()]/g, '')
    .split(/\s+OR\s+/)
    .some((part) => ALLOWED.has(part.trim()));

const bad = [];
for (const [licence, pkgs] of Object.entries(list)) {
  if (ok(licence)) continue;
  for (const p of pkgs)
    if (exceptions[p.name]?.licence !== licence) bad.push(`${p.name} (${licence})`);
}
if (bad.length) {
  process.stderr.write(`Licences outside the allow-list:\n  ${bad.join('\n  ')}\n`);
  process.exit(1);
}
process.stdout.write(`Licences OK (${String(Object.values(list).flat().length)} packages).\n`);
