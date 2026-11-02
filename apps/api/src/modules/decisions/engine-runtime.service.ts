import { Injectable } from '@nestjs/common';
import {
  catalogueOf,
  compile,
  copyOf,
  type CompiledRuleset,
  type WorkbookCell,
} from '@figcit/engine-v2';
import type { RulesetVersion } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotConfigured, NotFound } from '../../common/errors/errors.js';

/** A version the engine can run. `hash` is null only for an open draft (simulation). */
export interface Runnable {
  readonly id: string;
  readonly label: string;
  readonly hash: string | null;
  readonly status: RulesetVersion['status'];
  readonly ruleset: CompiledRuleset;
  /** The version's card wording (x-copy, E-53). */
  readonly copy: ReadonlyMap<string, string>;
  /** Rule ID → Tab 7 pattern number, for the card's `patterns`. */
  readonly patternOf: ReadonlyMap<string, number>;
  /** Rule ID → "tab · reference", to name the rules that fired. */
  readonly refOf: ReadonlyMap<string, string>;
  /** Rows (record IDs) marked `safety` (E-21, E-25): the safety impact set reads these. */
  readonly safetyRows: ReadonlySet<string>;
  /** "tab|reference" → the row's record ID, for picking a rule by its workbook reference. */
  readonly rowByRef: ReadonlyMap<string, string>;
}

/** Versions that can no longer change, so their compiled form is kept. */
const FROZEN: readonly RulesetVersion['status'][] = ['published', 'retired'];
const CHECK_MS = 30_000;

/**
 * Compiled rule set versions for the engine (M5). A frozen version never changes, so it is
 * compiled once and kept; the published one is re-looked-up every 30 s, so a publish reaches every
 * instance without a restart. Drafts are compiled on each call (simulation of work in progress).
 */
@Injectable()
export class EngineRuntimeService {
  private readonly compiled = new Map<string, Runnable>();
  private published: { at: number; id: string | null } | undefined;

  constructor(private readonly prisma: PrismaService) {}

  /** The published version, compiled. */
  async current(): Promise<Runnable> {
    if (!this.published || Date.now() - this.published.at > CHECK_MS) {
      const v = await this.prisma.rulesetVersion.findFirst({
        where: { status: 'published' },
        select: { id: true },
      });
      this.published = { at: Date.now(), id: v?.id ?? null };
    }
    if (this.published.id === null)
      throw new NotConfigured('No engine v2 rule set is published yet.');
    return this.byId(this.published.id);
  }

  /** A version by label (simulation, exploring a draft before it is published). */
  async byLabel(label: string): Promise<Runnable> {
    const v = await this.prisma.rulesetVersion.findUnique({
      where: { label },
      select: { id: true },
    });
    if (!v) throw new NotFound('rule set version');
    return this.byId(v.id);
  }

  /** A version by ID (replay: the version a record was made with). */
  async byId(id: string): Promise<Runnable> {
    const kept = this.compiled.get(id);
    if (kept) return kept;
    const v = await this.prisma.rulesetVersion.findUnique({
      where: { id },
      select: { id: true, label: true, hash: true, status: true },
    });
    if (!v) throw new NotFound('rule set version');
    const rows = await this.prisma.rulesetRecord.findMany({
      where: { versionId: id, status: 'active' },
      orderBy: { order: 'asc' },
      select: {
        recordId: true,
        tab: true,
        sourceRef: true,
        order: true,
        status: true,
        mapping: true,
        engine: true,
        role: true,
        frame: true,
        columns: true,
        safety: true,
      },
    });
    const live = rows.map((r) => ({ ...r, columns: r.columns as unknown as WorkbookCell[] }));
    const { catalogue } = catalogueOf(live);
    const ruleset = compile(
      rows.map((r) => ({ ...r, id: r.recordId })),
      catalogue,
    );
    const patternOf = new Map(
      ruleset.rules.flatMap((r) => {
        const n = /^patterns · (\d+)$/.exec(r.ref)?.[1];
        return n ? [[r.id, Number(n)] as const] : [];
      }),
    );
    const refOf = new Map(ruleset.rules.map((r) => [r.id, r.ref]));
    const runnable: Runnable = {
      ...v,
      ruleset,
      copy: copyOf(live),
      patternOf,
      refOf,
      safetyRows: new Set(rows.filter((r) => r.safety).map((r) => r.recordId)),
      rowByRef: new Map(rows.map((r) => [`${r.tab}|${r.sourceRef}`, r.recordId])),
    };
    // A draft or a version in review can still change; a frozen one is kept (its hash proves it).
    if (FROZEN.includes(v.status)) this.compiled.set(id, runnable);
    return runnable;
  }
}
