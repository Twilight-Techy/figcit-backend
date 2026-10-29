// Deterministic request/response examples from a route's JSON Schema (issue #6), so the contract
// carries an example for every route and the PWA's mocks start from it. Everything is made up:
// fixed ids, a fixed clock and example.test addresses, never real data.

type Schema = Readonly<Record<string, unknown>>;

const FIXED = {
  uuid: '00000000-0000-4000-8000-000000000001',
  'date-time': '2026-01-15T09:30:00.000Z',
  date: '2026-01-15',
  time: '09:30:00',
  email: 'sam@example.test',
  uri: 'https://example.test/item',
  url: 'https://example.test/item',
  duration: 'PT10M',
  ipv4: '192.0.2.1',
} as const;

// Tried in order for strings with a `pattern`; the first that matches is used.
const PATTERN_CANDIDATES = [
  'example',
  'example_item',
  'example.item',
  'sample',
  '123456',
  'E2M3',
  '2026-01',
  '+44 20 7946 0000',
  'FREQ=DAILY',
  'abc',
  'a',
  '1',
] as const;

const SENSITIVE = /password|secret|token|key/i;

const asSchema = (v: unknown): Schema | undefined =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Schema) : undefined;

function stringExample(s: Schema, name: string): string {
  const format = s['format'];
  if (typeof format === 'string' && format in FIXED) return FIXED[format as keyof typeof FIXED];
  const pattern = s['pattern'];
  if (typeof pattern === 'string') {
    const re = new RegExp(pattern);
    return PATTERN_CANDIDATES.find((c) => re.test(c)) ?? 'example';
  }
  const min = typeof s['minLength'] === 'number' ? s['minLength'] : 0;
  const max = typeof s['maxLength'] === 'number' ? s['maxLength'] : Infinity;
  // Credentials get an obvious placeholder, so no example reads as a real secret to a scanner.
  const base = SENSITIVE.test(name) ? `<example-${name}>` : name ? `Example ${name}` : 'Example';
  return base.padEnd(min, '.').slice(0, Math.max(min, Math.min(max, base.length)));
}

// zod's int() adds the safe-integer range as bounds; a bound that wide says nothing useful.
const bound = (v: unknown): number | undefined =>
  typeof v === 'number' && Math.abs(v) < Number.MAX_SAFE_INTEGER ? v : undefined;

function numberExample(s: Schema, integer: boolean): number {
  const step = integer ? 1 : 0.5;
  const min = bound(s['minimum']);
  const xmin = bound(s['exclusiveMinimum']);
  const max = bound(s['maximum']);
  const xmax = bound(s['exclusiveMaximum']);
  const lo = min ?? (xmin === undefined ? undefined : xmin + step);
  const hi = max ?? (xmax === undefined ? undefined : xmax - step);
  const n = lo ?? (hi === undefined ? 1 : Math.min(hi, 1));
  return integer ? Math.ceil(n) : n;
}

function objectExample(s: Schema, depth: number): Record<string, unknown> {
  const props = asSchema(s['properties']) ?? {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const sub = asSchema(value);
    if (sub) out[key] = exampleFor(sub, key, depth + 1);
  }
  return out;
}

function variant(s: Schema): Schema | undefined {
  const options = (s['anyOf'] ?? s['oneOf']) as unknown[] | undefined;
  if (!Array.isArray(options)) return undefined;
  const schemas = options.map(asSchema).filter((x): x is Schema => x !== undefined);
  // Prefer a real value over null, so the example shows the shape.
  return schemas.find((x) => x['type'] !== 'null') ?? schemas[0];
}

const NONE = Symbol('none');

/** A value the schema states outright: a const, default, example or the first enum member. */
function stated(s: Schema): unknown {
  if ('const' in s) return s['const'];
  if (s['default'] !== undefined) return s['default'];
  const examples = s['examples'];
  if (Array.isArray(examples) && examples.length) return examples[0];
  if (Array.isArray(s['enum']) && s['enum'].length) return s['enum'][0];
  return NONE;
}

function byType(s: Schema, name: string, depth: number): unknown {
  const type = Array.isArray(s['type'])
    ? (s['type'] as unknown[]).find((t) => t !== 'null')
    : s['type'];
  switch (type) {
    case 'object':
      return objectExample(s, depth);
    case 'array': {
      const items = asSchema(s['items']) ?? {};
      const count = Math.max(1, typeof s['minItems'] === 'number' ? s['minItems'] : 1);
      return Array.from({ length: count }, () => exampleFor(items, name, depth + 1));
    }
    case 'string':
      return stringExample(s, name);
    case 'integer':
      return numberExample(s, true);
    case 'number':
      return numberExample(s, false);
    case 'boolean':
      return true;
    case 'null':
      return null;
    default:
      return asSchema(s['properties']) ? objectExample(s, depth) : null;
  }
}

/** An example value for a JSON Schema (as produced by `z.toJSONSchema`). */
export function exampleFor(s: Schema, name = '', depth = 0): unknown {
  const value = stated(s);
  if (value !== NONE) return value;
  const alt = variant(s);
  if (alt) return exampleFor(alt, name, depth);
  if (Array.isArray(s['allOf'])) {
    return Object.assign(
      {},
      ...s['allOf'].map((x) => exampleFor(asSchema(x) ?? {}, name, depth) as object),
    ) as unknown;
  }
  return depth > 8 ? null : byType(s, name, depth);
}
