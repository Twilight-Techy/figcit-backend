// Fails CI if @figcit/engine or @figcit/engine-v2 gains a runtime dependency (rules 2.2).
import { readFileSync } from 'node:fs';

const fields = ['dependencies', 'peerDependencies', 'optionalDependencies'];
let failed = false;

for (const dir of ['engine', 'engine-v2']) {
  const pkg = JSON.parse(
    readFileSync(new URL(`../packages/${dir}/package.json`, import.meta.url), 'utf8'),
  );
  const found = fields.flatMap((field) =>
    Object.keys(pkg[field] ?? {}).map((name) => `${field}: ${name}`),
  );
  if (found.length > 0) {
    failed = true;
    console.error(`${pkg.name} must have no runtime dependencies. Found:\n  ${found.join('\n  ')}`);
  } else {
    console.log(`${pkg.name} has no runtime dependencies.`);
  }
}
if (failed) process.exit(1);
