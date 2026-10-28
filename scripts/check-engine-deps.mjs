// Fails CI if @figcit/engine gains a runtime dependency (rules 2.2).
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(
  readFileSync(new URL('../packages/engine/package.json', import.meta.url), 'utf8'),
);
const fields = ['dependencies', 'peerDependencies', 'optionalDependencies'];
const found = fields.flatMap((field) =>
  Object.keys(pkg[field] ?? {}).map((name) => `${field}: ${name}`),
);

if (found.length > 0) {
  console.error(
    `@figcit/engine must have no runtime dependencies. Found:\n  ${found.join('\n  ')}`,
  );
  process.exit(1);
}
console.log('@figcit/engine has no runtime dependencies.');
