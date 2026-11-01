import type { JsonValue } from '../ruleset/canonical.js';
import { valuesOf, type Catalogue } from './catalogue.js';
import {
  ACTIONS,
  EFFECTS,
  FACTS,
  LAYERS,
  LIMITS,
  SLOTS,
  STAGES,
  UNARY_OPS,
  type Domain,
  type EffectSpec,
  type FactSpec,
  type ParamSpec,
} from './registry.js';
import { COPY_KEY, opsFor } from './validate.js';

type Schema = { readonly [key: string]: JsonValue };

const LIST_OPS = ['in', 'not_in', 'contains_any', 'contains_all'];
const ref = (name: string): Schema => ({ $ref: `#/$defs/${name}` });
const closed = (properties: Schema, required: readonly string[], extra: Schema = {}): Schema => ({
  type: 'object',
  properties,
  required: [...required],
  additionalProperties: false,
  ...extra,
});

/** A code of the domain; a domain with no values yet accepts nothing (and says why). */
function codeOf(catalogue: Catalogue, domain: Domain): Schema {
  const codes = valuesOf(catalogue, domain).map((v) => v.code);
  return codes.length > 0
    ? { type: 'string', enum: codes }
    : { not: {}, description: `The catalogue has no ${domain} values yet` };
}

const listOf = (item: Schema, min: number): Schema => ({
  type: 'array',
  items: item,
  minItems: min,
  maxItems: LIMITS.listValues,
  uniqueItems: true,
});

function scalarValue(catalogue: Catalogue, spec: FactSpec): Schema {
  if (spec.type === 'boolean') return { type: 'boolean' };
  if (spec.type === 'intensity')
    return {
      oneOf: [
        { type: 'number', minimum: 0, maximum: 10 },
        closed({ band: codeOf(catalogue, 'intensity_band') }, ['band']),
      ],
    };
  if (spec.domain) return codeOf(catalogue, spec.domain);
  return {
    type: 'number',
    ...(spec.min === undefined ? {} : { minimum: spec.min }),
    ...(spec.max === undefined ? {} : { maximum: spec.max }),
  };
}

/** One fact's comparisons, split by the shape of their value. */
function comparison(catalogue: Catalogue, spec: FactSpec): Schema {
  const ops = opsFor(spec);
  const head: Schema = {
    fact: { const: spec.name },
    ...(spec.keyedBy ? { key: codeOf(catalogue, spec.keyedBy) } : {}),
  };
  const required = spec.keyedBy ? ['fact', 'key', 'op'] : ['fact', 'op'];
  const unary = ops.filter((o) => UNARY_OPS.includes(o));
  const lists = ops.filter((o) => LIST_OPS.includes(o));
  const single = ops.filter((o) => !UNARY_OPS.includes(o) && !LIST_OPS.includes(o));
  const shapes: Schema[] = [];
  if (unary.length > 0) shapes.push(closed({ ...head, op: { enum: unary } }, required));
  if (lists.length > 0 && spec.domain)
    shapes.push(
      closed({ ...head, op: { enum: lists }, value: listOf(codeOf(catalogue, spec.domain), 1) }, [
        ...required,
        'value',
      ]),
    );
  if (single.length > 0)
    shapes.push(
      closed({ ...head, op: { enum: single }, value: scalarValue(catalogue, spec) }, [
        ...required,
        'value',
      ]),
    );
  return { description: spec.description, oneOf: shapes };
}

function paramSchema(catalogue: Catalogue, spec: ParamSpec): Schema {
  switch (spec.type) {
    case 'enum':
      return codeOf(catalogue, spec.domain);
    case 'enum_list':
      return listOf(codeOf(catalogue, spec.domain), spec.min);
    case 'int':
      return spec.nullable
        ? { type: ['integer', 'null'], minimum: spec.min, maximum: spec.max }
        : { type: 'integer', minimum: spec.min, maximum: spec.max };
    case 'slot':
      return ref('slot');
    case 'target':
      return ref('target');
    case 'key':
      return { type: 'string', pattern: COPY_KEY.source };
  }
}

function effectSchema(catalogue: Catalogue, spec: EffectSpec): Schema {
  const params: Record<string, JsonValue> = {};
  for (const [name, p] of Object.entries(spec.params)) params[name] = paramSchema(catalogue, p);
  const required = Object.keys(spec.params).filter((p) => !(spec.optional ?? []).includes(p));
  return closed({ kind: { const: spec.kind }, ...params }, ['kind', ...required], {
    description: `${spec.description} (${spec.class})`,
  });
}

const text: Schema = { type: 'string', minLength: 1, maxLength: LIMITS.text };

/**
 * JSON Schema (2020-12) of a row's engine columns for one version's catalogue: every fact with
 * the operators and values it allows, every effect with its parameters. The staff app builds its
 * forms from it (E-36). Two rules it cannot state are checked on save: a row that proposes needs a
 * `layer`, and conditions stay within the size limits.
 */
export function engineJsonSchema(catalogue: Catalogue): Schema {
  const group = (op: 'all' | 'any'): Schema =>
    closed(
      { [op]: { type: 'array', items: ref('condition'), minItems: 1, maxItems: LIMITS.children } },
      [op],
    );
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Engine columns of a rule row',
    ...closed(
      {
        stage: { enum: STAGES.map((s) => s.key) },
        layer: { enum: LAYERS.map((l) => l.key) },
        rules: { type: 'array', items: ref('rule'), minItems: 1, maxItems: LIMITS.rulesPerRow },
        interpretation: text,
      },
      ['stage', 'rules'],
    ),
    $defs: {
      rule: closed(
        {
          when: { oneOf: [{ type: 'null' }, ref('condition')] },
          then: {
            type: 'array',
            items: ref('effect'),
            minItems: 1,
            maxItems: LIMITS.effectsPerRule,
          },
          note: text,
        },
        ['when', 'then'],
      ),
      condition: {
        oneOf: [ref('all'), ref('any'), ref('not'), ...FACTS.map((f) => ref(`fact:${f.name}`))],
      },
      all: group('all'),
      any: group('any'),
      not: closed({ not: ref('condition') }, ['not']),
      ...Object.fromEntries(FACTS.map((f) => [`fact:${f.name}`, comparison(catalogue, f)])),
      effect: { oneOf: EFFECTS.map((e) => ref(`effect:${e.kind}`)) },
      ...Object.fromEntries(EFFECTS.map((e) => [`effect:${e.kind}`, effectSchema(catalogue, e)])),
      slot: { enum: [...SLOTS] },
      target: {
        oneOf: [
          closed({ pathway: codeOf(catalogue, 'pathway') }, ['pathway']),
          closed({ tool: codeOf(catalogue, 'tool') }, ['tool']),
          closed({ action: { enum: [...ACTIONS] } }, ['action']),
        ],
      },
    },
  };
}
