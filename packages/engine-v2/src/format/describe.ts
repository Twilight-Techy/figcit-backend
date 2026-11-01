import { MAPPING_STATUSES, RULESET_FORMAT } from '../ruleset/store.js';
import { valuesOf, type Catalogue, type CatalogueValue, type Issue } from './catalogue.js';
import { engineJsonSchema } from './json-schema.js';
import {
  ACTIONS,
  DOMAIN_INFO,
  DOMAINS,
  EFFECTS,
  FACTS,
  LAYERS,
  LIMITS,
  ORDERED_DOMAINS,
  SLOTS,
  STAGES,
  type EffectSpec,
  type FactSpec,
} from './registry.js';
import { opsFor } from './validate.js';

export interface DomainDescription {
  readonly domain: string;
  readonly description: string;
  readonly ordered: boolean;
  readonly values: readonly CatalogueValue[];
}

/** Everything a client needs to show, edit and check engine columns for one version (E-36). */
export interface FormatDescription {
  readonly format: number;
  readonly mappingStatuses: readonly string[];
  readonly stages: typeof STAGES;
  readonly layers: typeof LAYERS;
  readonly slots: typeof SLOTS;
  readonly actions: typeof ACTIONS;
  readonly limits: typeof LIMITS;
  readonly facts: readonly (FactSpec & { readonly ops: readonly string[] })[];
  readonly effects: readonly EffectSpec[];
  readonly domains: readonly DomainDescription[];
  /** Catalogue rows that could not be read; they are left out of `domains`. */
  readonly catalogueIssues: readonly Issue[];
  readonly schema: ReturnType<typeof engineJsonSchema>;
}

export function describeFormat(
  catalogue: Catalogue,
  catalogueIssues: readonly Issue[],
): FormatDescription {
  return {
    format: RULESET_FORMAT,
    mappingStatuses: MAPPING_STATUSES,
    stages: STAGES,
    layers: LAYERS,
    slots: SLOTS,
    actions: ACTIONS,
    limits: LIMITS,
    facts: FACTS.map((f) => ({ ...f, ops: opsFor(f) })),
    effects: EFFECTS,
    domains: DOMAINS.map((domain) => ({
      domain,
      description: DOMAIN_INFO[domain],
      ordered: ORDERED_DOMAINS.includes(domain),
      values: valuesOf(catalogue, domain),
    })),
    catalogueIssues,
    schema: engineJsonSchema(catalogue),
  };
}
