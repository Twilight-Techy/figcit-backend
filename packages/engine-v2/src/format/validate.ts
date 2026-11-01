import { valuesOf, type Catalogue, type Issue } from './catalogue.js';
import {
  ACTIONS,
  EFFECTS,
  FACTS,
  LAYERS,
  LIMITS,
  OPS_BY_TYPE,
  ORDERED_DOMAINS,
  ORDERED_OPS,
  SLOTS,
  STAGES,
  UNARY_OPS,
  type Domain,
  type FactSpec,
  type ParamSpec,
} from './registry.js';

/** Wording keys follow the content keys (`admin` content editor). */
export const COPY_KEY = /^[a-z0-9_.]{3,120}$/;
const PROPOSING = new Set(EFFECTS.filter((e) => e.class === 'proposal').map((e) => e.kind));
const FACT_BY_NAME = new Map(FACTS.map((f) => [f.name, f]));
const EFFECT_BY_KIND = new Map(EFFECTS.map((e) => [e.kind, e]));

type Obj = Readonly<Record<string, unknown>>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Collects issues while walking one row's engine columns. */
class Checker {
  readonly issues: Issue[] = [];
  private nodes = 0;
  constructor(private readonly catalogue: Catalogue) {}

  fail(path: string, message: string): void {
    this.issues.push({ path, message });
  }

  /** Only these keys, with `required` among them. */
  keys(value: Obj, path: string, allowed: readonly string[], required: readonly string[]): void {
    for (const k of Object.keys(value))
      if (!allowed.includes(k)) this.fail(`${path}/${k}`, 'not allowed here');
    for (const k of required) if (!(k in value)) this.fail(`${path}/${k}`, 'missing');
  }

  inDomain(value: unknown, domain: Domain, path: string): void {
    const values = valuesOf(this.catalogue, domain);
    if (typeof value !== 'string') this.fail(path, `expected a ${domain} code`);
    else if (values.length === 0) this.fail(path, `the catalogue has no ${domain} values yet`);
    else if (!values.some((v) => v.code === value))
      this.fail(path, `"${value}" is not a ${domain} in the catalogue`);
  }

  list(value: unknown, domain: Domain, path: string, min: number): void {
    if (!Array.isArray(value)) {
      this.fail(path, `expected a list of ${domain} codes`);
      return;
    }
    if (value.length < min || value.length > LIMITS.listValues)
      this.fail(path, `give ${String(min)} to ${String(LIMITS.listValues)} values`);
    if (new Set(value).size !== value.length) this.fail(path, 'a value is repeated');
    value.forEach((v, i) => {
      this.inDomain(v, domain, `${path}/${String(i)}`);
    });
  }

  text(value: unknown, path: string): void {
    if (typeof value !== 'string' || value.trim() === '' || value.length > LIMITS.text)
      this.fail(path, `expected text of 1-${String(LIMITS.text)} characters`);
  }

  // ---- conditions ----

  condition(value: unknown, path: string, depth: number): void {
    this.nodes += 1;
    if (this.nodes === LIMITS.nodes + 1)
      this.fail(path, `a condition may have at most ${String(LIMITS.nodes)} parts`);
    if (depth > LIMITS.depth) {
      this.fail(path, `conditions nest at most ${String(LIMITS.depth)} deep`);
      return;
    }
    if (!isObj(value)) {
      this.fail(path, 'expected a condition');
      return;
    }
    if ('all' in value || 'any' in value) {
      this.group(value, path, depth);
      return;
    }
    if ('not' in value) {
      this.keys(value, path, ['not'], ['not']);
      this.condition(value['not'], `${path}/not`, depth + 1);
      return;
    }
    this.comparison(value, path);
  }

  private group(value: Obj, path: string, depth: number): void {
    const op = 'all' in value ? 'all' : 'any';
    this.keys(value, path, [op], [op]);
    const children = value[op];
    if (!Array.isArray(children) || children.length === 0 || children.length > LIMITS.children) {
      this.fail(`${path}/${op}`, `expected 1-${String(LIMITS.children)} conditions`);
      return;
    }
    children.forEach((c, i) => {
      this.condition(c, `${path}/${op}/${String(i)}`, depth + 1);
    });
  }

  private comparison(value: Obj, path: string): void {
    this.keys(value, path, ['fact', 'key', 'op', 'value'], ['fact', 'op']);
    const spec = FACT_BY_NAME.get(String(value['fact']));
    if (!spec) {
      this.fail(`${path}/fact`, `unknown fact "${String(value['fact'])}"`);
      return;
    }
    if (spec.keyedBy) this.inDomain(value['key'], spec.keyedBy, `${path}/key`);
    else if ('key' in value) this.fail(`${path}/key`, `${spec.name} takes no key`);
    const op = String(value['op']);
    if (!opsFor(spec).includes(op)) {
      this.fail(`${path}/op`, `${spec.name} allows ${opsFor(spec).join(', ')}`);
      return;
    }
    if (UNARY_OPS.includes(op)) {
      if ('value' in value) this.fail(`${path}/value`, `${op} takes no value`);
      return;
    }
    if (!('value' in value)) {
      this.fail(`${path}/value`, 'missing');
      return;
    }
    this.value(spec, op, value['value'], `${path}/value`);
  }

  private value(spec: FactSpec, op: string, value: unknown, path: string): void {
    const listOp = ['in', 'not_in', 'contains_any', 'contains_all'].includes(op);
    if ((spec.type === 'enum' || spec.type === 'set') && spec.domain) {
      if (listOp) this.list(value, spec.domain, path, 1);
      else this.inDomain(value, spec.domain, path);
    } else if (spec.type === 'boolean') {
      if (typeof value !== 'boolean') this.fail(path, 'expected true or false');
    } else if (spec.type === 'intensity' && isObj(value)) {
      this.keys(value, path, ['band'], ['band']);
      this.inDomain(value['band'], 'intensity_band', `${path}/band`);
    } else {
      const [min, max] =
        spec.type === 'intensity' ? [0, 10] : [spec.min ?? -Infinity, spec.max ?? Infinity];
      if (typeof value !== 'number' || value < min || value > max)
        this.fail(path, `expected a number from ${String(min)} to ${String(max)}`);
    }
  }

  // ---- effects ----

  effect(value: unknown, path: string): void {
    if (!isObj(value)) {
      this.fail(path, 'expected an effect');
      return;
    }
    const spec = EFFECT_BY_KIND.get(String(value['kind']));
    if (!spec) {
      this.fail(`${path}/kind`, `unknown effect "${String(value['kind'])}"`);
      return;
    }
    const params = Object.keys(spec.params);
    const required = params.filter((p) => !(spec.optional ?? []).includes(p));
    this.keys(value, path, ['kind', ...params], required);
    for (const p of params) if (p in value) this.param(spec.params[p], value[p], `${path}/${p}`);
  }

  private param(spec: ParamSpec | undefined, value: unknown, path: string): void {
    if (!spec) {
      this.fail(path, 'unknown parameter');
      return;
    }
    const problem = this.paramProblem(spec, value, path);
    if (problem !== null) this.fail(path, problem);
  }

  /** The problem with a parameter value, or null; domain and target checks report their own. */
  private paramProblem(spec: ParamSpec, value: unknown, path: string): string | null {
    switch (spec.type) {
      case 'enum':
        this.inDomain(value, spec.domain, path);
        return null;
      case 'enum_list':
        this.list(value, spec.domain, path, spec.min);
        return null;
      case 'target':
        this.target(value, path);
        return null;
      case 'int':
        if (value === null && spec.nullable) return null;
        return isInt(value) && value >= spec.min && value <= spec.max
          ? null
          : `expected a whole number from ${String(spec.min)} to ${String(spec.max)}`;
      case 'slot':
        return (SLOTS as readonly unknown[]).includes(value)
          ? null
          : `expected one of ${SLOTS.join(', ')}`;
      case 'key':
        return typeof value === 'string' && COPY_KEY.test(value)
          ? null
          : 'expected a wording key like card.reset.title';
    }
  }

  private target(value: unknown, path: string): void {
    if (!isObj(value) || Object.keys(value).length !== 1) {
      this.fail(path, 'expected one of { pathway }, { tool } or { action }');
      return;
    }
    if ('pathway' in value) {
      this.inDomain(value['pathway'], 'pathway', `${path}/pathway`);
      return;
    }
    if ('tool' in value) {
      this.inDomain(value['tool'], 'tool', `${path}/tool`);
      return;
    }
    if ('action' in value) {
      if (!(ACTIONS as readonly unknown[]).includes(value['action']))
        this.fail(`${path}/action`, `expected one of ${ACTIONS.join(', ')}`);
      return;
    }
    this.fail(path, 'expected one of { pathway }, { tool } or { action }');
  }

  resetCount(): void {
    this.nodes = 0;
  }
}

/** Operators a fact allows (ordered enums also compare). */
export function opsFor(spec: FactSpec): readonly string[] {
  const base = OPS_BY_TYPE[spec.type];
  return spec.type === 'enum' && spec.domain && ORDERED_DOMAINS.includes(spec.domain)
    ? [...base, ...ORDERED_OPS]
    : base;
}

function checkRules(c: Checker, rules: unknown): boolean {
  if (!Array.isArray(rules) || rules.length === 0 || rules.length > LIMITS.rulesPerRow) {
    c.fail('/rules', `expected 1-${String(LIMITS.rulesPerRow)} rules`);
    return false;
  }
  let proposes = false;
  rules.forEach((rule, i) => {
    const at = `/rules/${String(i)}`;
    if (!isObj(rule)) {
      c.fail(at, 'expected a rule');
      return;
    }
    c.keys(rule, at, ['stage', 'when', 'then', 'note'], ['when', 'then']);
    if ('stage' in rule && !STAGES.some((st) => st.key === rule['stage']))
      c.fail(`${at}/stage`, `expected one of ${STAGES.map((st) => st.key).join(', ')}`);
    c.resetCount();
    if (rule['when'] !== null && 'when' in rule) c.condition(rule['when'], `${at}/when`, 1);
    const then = rule['then'];
    if (!Array.isArray(then) || then.length === 0 || then.length > LIMITS.effectsPerRule)
      c.fail(`${at}/then`, `expected 1-${String(LIMITS.effectsPerRule)} effects`);
    else
      then.forEach((e, j) => {
        c.effect(e, `${at}/then/${String(j)}`);
        if (isObj(e) && PROPOSING.has(String(e['kind']))) proposes = true;
      });
    if ('note' in rule) c.text(rule['note'], `${at}/note`);
  });
  return proposes;
}

/**
 * Checks a row's engine columns (DESIGN §4) against the format and the version's catalogue.
 * Returns every problem; an empty list means the engine can run it. O(size of the columns).
 */
export function validateEngine(engine: unknown, catalogue: Catalogue): Issue[] {
  const c = new Checker(catalogue);
  if (!isObj(engine)) return [{ path: '', message: 'expected the engine columns' }];
  c.keys(engine, '', ['stage', 'layer', 'rules', 'interpretation'], ['stage', 'rules']);
  if (!STAGES.some((s) => s.key === engine['stage']))
    c.fail('/stage', `expected one of ${STAGES.map((s) => s.key).join(', ')}`);
  if ('layer' in engine && !LAYERS.some((l) => l.key === engine['layer']))
    c.fail('/layer', `expected one of ${LAYERS.map((l) => l.key).join(', ')}`);
  const proposes = checkRules(c, engine['rules']);
  if (proposes && !('layer' in engine)) c.fail('/layer', 'a row that proposes needs a layer');
  if ('interpretation' in engine) c.text(engine['interpretation'], '/interpretation');
  return c.issues;
}

/** Mapping statuses whose rows carry engine columns. */
export const MAPPED = ['exact', 'interpreted'] as const;

/**
 * Checks a row's mapping status against its engine columns: `exact` and `interpreted` rows must
 * carry valid columns (`interpreted` with its interpretation); other statuses carry none.
 */
export function validateMapping(mapping: string, engine: unknown, catalogue: Catalogue): Issue[] {
  const mapped = (MAPPED as readonly string[]).includes(mapping);
  if (!mapped)
    return engine === null || engine === undefined
      ? []
      : [{ path: '', message: `a ${mapping} row has no engine columns` }];
  if (engine === null || engine === undefined)
    return [{ path: '', message: `an ${mapping} row needs engine columns` }];
  const issues = validateEngine(engine, catalogue);
  if (mapping === 'interpreted' && !(isObj(engine) && 'interpretation' in engine))
    issues.push({ path: '/interpretation', message: 'say how the text was read' });
  return issues;
}
