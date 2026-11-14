import type { RuleRecordDraft, TabKey } from '../ruleset/types.js';
import { cellText, type CatalogueColumn } from './catalogue.js';
import type { Domain } from './registry.js';

// The catalogue as Rules Engine v5.0 gives it (docs/engine-v2/V5.md): states, colours, the 20
// emotions and their groups, the slider levels, body signs, urgent signs and senses, card patterns.

export interface SeedRow {
  readonly domain: Domain;
  readonly cells: Partial<Record<CatalogueColumn, string>>;
  readonly mapping: 'exact' | 'interpreted';
}

type Slug = (label: string) => string;

const rows = (records: readonly RuleRecordDraft[], tab: TabKey, section?: string) =>
  records.filter(
    (r) =>
      r.tab === tab &&
      r.role === 'rule' &&
      r.frame !== null &&
      (section === undefined || (r.section ?? '').startsWith(section)),
  );
const text = (r: RuleRecordDraft, header: string): string =>
  cellText(r.columns, header).replace(/\s+/g, ' ').trim();
const source = (r: RuleRecordDraft): string => `${r.tab} · ${r.sourceRef}`;

/** Band order as v3.3 has it (0 = Very Constrained ... 3 = Available); Recovery is a light only. */
const BAND_ORDER: Readonly<Record<string, number>> = {
  very_constrained: 0,
  constrained: 1,
  conditional: 2,
  available: 3,
};

/**
 * FE-3's tie order, lower first: "Shutdown > Charged > Low", and Something else skipped "is treated
 * as Low" (SE-1). Settled never wins a tie against an unpleasant emotion ("a tie goes to the
 * unpleasant one"). Read from the text, so `interpreted`.
 */
const GROUP_ORDER: Readonly<Record<string, number>> = {
  shutdown: 1,
  charged: 2,
  low: 3,
  unsorted: 3,
  settled: 9,
};

function states(records: readonly RuleRecordDraft[]): SeedRow[] {
  return rows(records, 'capacity')
    .filter((r) => /^E[1-4]M[1-4]$/.test(r.sourceRef))
    .map((r) => ({
      domain: 'cell',
      mapping: 'exact',
      cells: { Code: r.sourceRef, Label: text(r, 'State name'), Source: source(r) },
    }));
}

function colours(records: readonly RuleRecordDraft[], slug: Slug): SeedRow[] {
  return rows(records, 'colours').flatMap((r): SeedRow[] => {
    const band = slug(r.sourceRef);
    const light = slug(text(r, 'Colour shown').split('·')[0] ?? '');
    const out: SeedRow[] = [];
    if (band in BAND_ORDER)
      out.push({
        domain: 'band',
        mapping: 'exact',
        cells: {
          Code: band,
          Label: r.sourceRef,
          Order: String(BAND_ORDER[band]),
          Source: source(r),
        },
      });
    if (light !== '')
      out.push({
        domain: 'light',
        mapping: 'exact',
        cells: { Code: light, Label: text(r, 'Colour shown'), Group: band, Source: source(r) },
      });
    return out;
  });
}

function emotions(records: readonly RuleRecordDraft[], slug: Slug): SeedRow[] {
  return rows(records, 'feelings', 'The 20 emotions').map((r) => ({
    domain: 'family',
    mapping: 'exact',
    cells: {
      Code: slug(text(r, 'Emotion')),
      Label: text(r, 'Emotion'),
      Group: slug(text(r, 'Group')),
      Source: source(r),
      Note: r.sourceRef,
    },
  }));
}

function feelingGroups(records: readonly RuleRecordDraft[], slug: Slug): SeedRow[] {
  return rows(records, 'feelings', 'Groups').map((r) => {
    const code = slug(r.sourceRef);
    return {
      domain: 'feeling_group',
      mapping: 'interpreted',
      cells: {
        Code: code,
        Label: r.sourceRef,
        Order: String(GROUP_ORDER[code] ?? 9),
        Source: source(r),
        Note: 'Order is the FE-3 tie order (lower wins), read from FE-3 and SE-1',
      },
    };
  });
}

/** "1–3" or "9-10" as an inclusive range. */
function range(value: string): [string, string] {
  const m = /(\d+)\s*[–-]\s*(\d+)/.exec(value);
  return m ? [m[1] ?? '', m[2] ?? ''] : ['', ''];
}

function sliderLevels(records: readonly RuleRecordDraft[], slug: Slug): SeedRow[] {
  return rows(records, 'feelings', 'Slider').map((r, i) => {
    const [from, to] = range(text(r, 'Slider values'));
    return {
      domain: 'intensity_band',
      mapping: 'exact',
      cells: {
        Code: slug(text(r, 'Shown as')),
        Label: text(r, 'Shown as'),
        Order: String(i),
        From: from,
        To: to,
        Source: source(r),
        Note: r.sourceRef,
      },
    };
  });
}

function bodySigns(records: readonly RuleRecordDraft[], slug: Slug): SeedRow[] {
  const signs = rows(records, 'body_senses', 'Body tab');
  const groups = [...new Set(signs.map((r) => text(r, 'Group')))];
  return [
    ...signs.map((r): SeedRow => ({
      domain: 'body_sign',
      mapping: 'exact',
      cells: {
        Code: slug(text(r, 'Body sign')),
        Label: text(r, 'Body sign'),
        Group: slug(text(r, 'Group')),
        Source: source(r),
        Note: r.sourceRef,
      },
    })),
    ...groups.map((g): SeedRow => ({
      domain: 'body_group',
      mapping: 'exact',
      cells: { Code: slug(g), Label: g, Source: 'body_senses · Body tab' },
    })),
  ];
}

function urgent(records: readonly RuleRecordDraft[], slug: Slug): SeedRow[] {
  return [
    ...rows(records, 'body_senses', 'Urgent signs').map((r): SeedRow => ({
      domain: 'urgent_sign',
      mapping: 'exact',
      cells: {
        Code: slug(text(r, 'Urgent sign (always free)')),
        Label: text(r, 'Urgent sign (always free)'),
        Source: source(r),
        Note: r.sourceRef,
      },
    })),
    ...[
      ['sudden_new', 'Yes, it is sudden or new'],
      ['familiar', "No, it's familiar when I'm overwhelmed"],
    ].map(([code, label]): SeedRow => ({
      domain: 'urgent_answer',
      mapping: 'interpreted',
      cells: {
        Code: code ?? '',
        Label: label ?? '',
        Source: 'colour_rules · SF-4',
        Note: 'The two answers SF-4 names',
      },
    })),
  ];
}

function senses(records: readonly RuleRecordDraft[], slug: Slug): SeedRow[] {
  return rows(records, 'body_senses', 'Senses tab').map((r) => ({
    domain: 'sensitivity_flag',
    mapping: 'exact',
    cells: {
      Code: slug(text(r, 'Sense')),
      Label: text(r, 'Sense'),
      Group: slug(text(r, 'Group')),
      Source: source(r),
      Note: r.sourceRef,
    },
  }));
}

function patterns(records: readonly RuleRecordDraft[]): SeedRow[] {
  return rows(records, 'card_patterns').map((r) => ({
    domain: 'pattern',
    mapping: 'exact',
    cells: {
      Code: r.sourceRef,
      Label: `${r.sourceRef} · ${text(r, 'When')}`.slice(0, 160),
      Source: source(r),
    },
  }));
}

/** Whether these records are a v5.0 workbook. */
export const isV5 = (records: readonly RuleRecordDraft[]): boolean =>
  records.some((r) => r.tab === 'capacity');

/** Every catalogue row v5.0 gives, in domain order. */
export function v5SeedRows(records: readonly RuleRecordDraft[], slug: Slug): SeedRow[] {
  return [
    ...states(records),
    ...colours(records, slug),
    ...emotions(records, slug),
    ...feelingGroups(records, slug),
    ...sliderLevels(records, slug),
    ...bodySigns(records, slug),
    ...urgent(records, slug),
    ...senses(records, slug),
    ...patterns(records),
  ];
}
