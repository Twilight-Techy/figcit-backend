import { valuesOf, type Catalogue } from '../format/catalogue.js';
import { LAYERS } from '../format/registry.js';
import type { Target } from '../format/types.js';
import type { Material, Origin, Proposal } from './apply.js';
import { because } from './conditions.js';
import type { RunState } from './state.js';
import type { Card, CardItem, ProposalFate } from './types.js';

/** Tab 7 non-negotiable: one primary and a small number of alternatives. */
export const MAX_ALTERNATIVES = 2;

const LAYER_RANK = new Map<string, number>(LAYERS.map((l, i) => [l.key, i]));
/** A row with no layer only sets requirements; in a clash it ranks below every layer (E-51). */
const rankOf = (o: Origin): number =>
  o.rule.layer === null ? LAYERS.length : (LAYER_RANK.get(o.rule.layer) ?? LAYERS.length);
const keyOf = (t: Target): string =>
  'pathway' in t ? `p:${t.pathway}` : 'tool' in t ? `t:${t.tool}` : `a:${t.action}`;

/** Proposals of one target in one slot, merged: the best-ranked one stands for all (E-50). */
interface Group {
  readonly best: Proposal;
  readonly copy: string | null;
  readonly members: readonly Proposal[];
  readonly demoted: boolean;
}

const byRank = (a: Group, b: Group): number =>
  rankOf(a.best) - rankOf(b.best) ||
  Number(a.demoted) - Number(b.demoted) ||
  b.best.salience - a.best.salience ||
  a.best.rule.seq - b.best.rule.seq;

/** Groups of one target merged (an alternative and a primary that lost): best rank, first wording. */
function merge(groups: readonly Group[]): Group[] {
  const by = new Map<string, Group[]>();
  for (const g of groups)
    by.set(keyOf(g.best.target), [...(by.get(keyOf(g.best.target)) ?? []), g]);
  return [...by.values()]
    .map((same): Group => {
      const sorted = [...same].sort(byRank);
      const first = sorted[0] as Group;
      return {
        best: first.best,
        members: sorted.flatMap((g) => g.members),
        copy: sorted.find((g) => g.copy !== null)?.copy ?? null,
        demoted: sorted.every((g) => g.demoted),
      };
    })
    .sort(byRank);
}

/** Builds the card from what the rules asked (DESIGN §4.4); records each proposal's fate. */
export class CardBuilder {
  readonly fates: ProposalFate[] = [];
  readonly notes: string[] = [];
  private readonly placed: { item: CardItem; slot: string }[] = [];
  private readonly toolPathway = new Map<string, string>();
  private readonly toolsByPathway = new Map<string, string[]>();
  /**
   * v5.0 (LBL-1): each tool's approved words, Tab 17's user_label and user_description; the card
   * carries them so nothing else can be shown. Null for v3.3 rule sets, whose cards stay as they were.
   */
  private readonly toolWords: ReadonlyMap<
    string,
    { label: string; description: string | null }
  > | null;

  constructor(
    private readonly m: Material,
    private readonly state: RunState,
    private readonly catalogue: Catalogue,
  ) {
    for (const t of valuesOf(catalogue, 'tool')) {
      if (t.group === null) continue;
      this.toolPathway.set(t.code, t.group);
      this.toolsByPathway.set(t.group, [...(this.toolsByPathway.get(t.group) ?? []), t.code]);
    }
    this.toolWords =
      valuesOf(catalogue, 'feeling_group').length > 0
        ? new Map(
            valuesOf(catalogue, 'tool').map((t) => [
              t.code,
              { label: t.label, description: t.note ?? null },
            ]),
          )
        : null;
  }

  /** A v5.0 tool button with its approved words; anything else unchanged. */
  private worded(item: CardItem): CardItem {
    const words = item.tool === null ? undefined : this.toolWords?.get(item.tool);
    return words ? { ...item, label: words.label, description: words.description } : item;
  }

  build(): Card {
    if (this.m.stop !== null) return this.supportScreen();
    const primary = this.primary();
    // The queue is the plan after the primary, so it is filled before the options beside it.
    const queued = this.queued(primary.item);
    const alternatives = this.offer(primary.item, this.alternatives(primary.losers));
    const worded = (i: CardItem): CardItem => this.worded(i);
    return {
      kind: 'card',
      band: (this.state.fact('band.final') as string | undefined) ?? null,
      light: (this.state.fact('light') as string | undefined) ?? null,
      primary: primary.item ? worded(primary.item) : null,
      alternatives: alternatives.map(worded),
      queued: queued.map(worded),
      visible: this.visible().map(worded),
      prompts: [...new Set(this.m.copyUses.filter((c) => c.slot === 'visible').map((c) => c.key))],
      reminder: this.reminder(),
      supportVisible: this.m.support !== null,
      drivers: this.drivers(),
      stepCap: this.stepCap(),
      minutesCap: this.m.minutesCaps.length > 0 ? Math.min(...this.m.minutesCaps) : null,
      practice: this.m.practice,
      because: primary.rule ? because(primary.rule.when, this.state, this.catalogue) : [],
      // Only when set, so cards made before v5.0 replay unchanged.
      ...this.v5Frame(),
      ...(this.state.noWords ? { noWords: true as const } : {}),
    };
  }

  /** The best-ranked rule's value: layer first, then run order. */
  private static best<T extends Origin>(list: readonly T[]): T | undefined {
    return [...list].sort((a, b) => rankOf(a) - rankOf(b) || a.rule.seq - b.rule.seq)[0];
  }

  /** v5.0's pattern and no-task suggestion, when rules set them. */
  private v5Frame(): Pick<Card, 'pattern' | 'suggestion' | 'taskOrder'> {
    const pattern = CardBuilder.best(this.m.patterns)?.pattern;
    const suggestion = CardBuilder.best(this.m.suggestions)?.copy;
    const order = CardBuilder.best(this.m.taskOrders);
    return {
      ...(pattern === undefined ? {} : { pattern }),
      ...(suggestion === undefined ? {} : { suggestion }),
      ...(order ? { taskOrder: { first: order.first, later: order.later } } : {}),
    };
  }

  private supportScreen(): Card {
    this.m.proposals.forEach((p) => {
      this.fate(p, 'blocked', this.m.stop ?? undefined);
    });
    const item = this.actionItem({ action: 'get_support_now' }, this.m.stop ?? '');
    return {
      kind: this.m.urgent === null ? 'support_screen' : 'urgent_screen',
      ...this.v5Frame(),
      band: null,
      light: null,
      primary: null,
      alternatives: [],
      queued: [],
      visible: [item],
      prompts: [],
      reminder: null,
      supportVisible: true,
      drivers: [],
      stepCap: null,
      minutesCap: null,
      practice: [],
      because: [],
    };
  }

  // ---- slots ----

  private primary(): { item: CardItem | null; rule: Origin['rule'] | null; losers: Group[] } {
    for (const must of [...this.m.musts.filter((r) => r.slot === 'primary')].sort(
      (a, b) => rankOf(a) - rankOf(b) || a.rule.seq - b.rule.seq,
    )) {
      const blocker = this.blocker(must.target, 'primary', rankOf(must));
      if (blocker) {
        this.notes.push(
          `${must.rule.ref} requires ${keyOf(must.target)} first, but ${blocker} forbids it from a higher layer`,
        );
        continue;
      }
      const groups = this.groups('primary');
      // A required pathway takes the best proposal within it (pattern 16's tap-only Breathe).
      const within = groups.filter((g) => this.within(g.best.target, must.target));
      const adopted = within.find((g) => this.blocker(g.best.target, 'primary', -1) === null);
      const target = adopted?.best.target ?? must.target;
      const item = this.resolve(target, 'primary', must.rule.id);
      if (item === null) continue;
      this.place(item, 'primary');
      within.forEach((g) => {
        this.groupFate(g, 'merged', must.rule.id, 'primary');
      });
      const losers = groups
        .filter((g) => !within.includes(g))
        .map((g) => ({ ...g, demoted: true }));
      const copy = adopted?.copy ?? this.copyFor(must.target);
      return { item: { ...item, copy }, rule: must.rule, losers };
    }
    const losers: Group[] = [];
    let chosen: { item: CardItem; rule: Origin['rule'] } | null = null;
    for (const g of this.groups('primary')) {
      if (chosen) {
        // A primary that lost is offered as an alternative instead (E-51); its fate is decided there.
        losers.push({ ...g, demoted: true });
        continue;
      }
      const item = this.take(g, 'primary');
      if (item) chosen = { item, rule: g.best.rule };
    }
    return { item: chosen?.item ?? null, rule: chosen?.rule ?? null, losers };
  }

  private alternatives(losers: readonly Group[]): CardItem[] {
    const out: CardItem[] = [];
    for (const g of merge([...this.groups('alternative'), ...losers])) {
      if (out.length >= Math.min(MAX_ALTERNATIVES, ...this.m.alternativeLimits)) {
        this.groupFate(g, 'over_limit');
        continue;
      }
      const item = this.take(g, 'alternative');
      if (item) out.push(item);
    }
    return out;
  }

  private queued(primary: CardItem | null): CardItem[] {
    const out: CardItem[] = [];
    for (const g of this.groups('queued')) {
      if (primary && keyOf(g.best.target) === keyOf(primary.target)) {
        this.groupFate(g, 'duplicate', primary.from);
        continue;
      }
      const item = this.take(g, 'queued');
      if (item) out.push(item);
    }
    return out;
  }

  private visible(): CardItem[] {
    const out: CardItem[] = [];
    if (this.m.support !== null)
      out.push(this.actionItem({ action: 'get_support_now' }, this.m.support));
    const musts = this.m.musts.filter((r) => r.slot === 'visible');
    for (const must of musts) {
      const blocker = this.blocker(must.target, 'visible', rankOf(must));
      if (blocker) {
        this.notes.push(
          `${must.rule.ref} requires ${keyOf(must.target)}, but ${blocker} forbids it from a higher layer`,
        );
        continue;
      }
      if (!out.some((i) => keyOf(i.target) === keyOf(must.target)))
        out.push({
          ...this.actionItem(must.target, must.rule.id),
          copy: this.copyFor(must.target),
        });
    }
    for (const g of this.groups('visible')) {
      if (out.some((i) => keyOf(i.target) === keyOf(g.best.target))) {
        this.groupFate(
          g,
          'merged',
          out.find((i) => keyOf(i.target) === keyOf(g.best.target))?.from,
        );
        continue;
      }
      const item = this.take(g, 'visible');
      if (item) out.push(item);
    }
    return out;
  }

  // ---- proposals ----

  private groups(slot: string): Group[] {
    const by = new Map<string, Proposal[]>();
    for (const p of this.m.proposals.filter((x) => x.slot === slot))
      by.set(keyOf(p.target), [...(by.get(keyOf(p.target)) ?? []), p]);
    return [...by.values()]
      .map((members): Group => {
        const sorted = [...members].sort(
          (a, b) => rankOf(a) - rankOf(b) || b.salience - a.salience || a.rule.seq - b.rule.seq,
        );
        const best = sorted[0] as Proposal;
        return {
          best,
          members: sorted,
          copy: sorted.find((p) => p.copy !== null)?.copy ?? null,
          demoted: false,
        };
      })
      .sort(byRank);
  }

  /** Places a group's target in a slot if every requirement allows it; records the fate. */
  private take(g: Group, slot: string): CardItem | null {
    const blocker = this.blocker(g.best.target, slot, -1);
    if (blocker) {
      this.groupFate(g, 'blocked', blocker);
      return null;
    }
    const item = this.resolve(g.best.target, slot, g.best.rule.id);
    if (item === null) {
      this.groupFate(g, 'no_tool');
      return null;
    }
    if (this.isPlaced(item, slot)) {
      this.groupFate(g, 'duplicate');
      return null;
    }
    this.place(item, slot);
    this.fate(g.best, 'used', undefined, slot);
    g.members.slice(1).forEach((p) => {
      this.fate(p, 'merged', g.best.rule.id, slot);
    });
    return { ...item, copy: g.copy };
  }

  /** The forbid that keeps a target out of a slot, if one outranks `rank` (-1: any forbid). */
  private blocker(target: Target, slot: string, rank: number): string | null {
    const pathway =
      'pathway' in target
        ? target.pathway
        : 'tool' in target
          ? this.toolPathway.get(target.tool)
          : undefined;
    const hit = this.m.forbids.find((f) => {
      if (f.slot !== null && f.slot !== slot) return false;
      if (rank >= 0 && rankOf(f) >= rank) return false;
      if ('pathway' in f.target) return f.target.pathway === pathway && !('action' in target);
      return keyOf(f.target) === keyOf(target);
    });
    return hit ? hit.rule.id : null;
  }

  // ---- tools ----

  /** v5.0 CX-R: what a tool is shown as here (the best-ranked swap), else the target itself. */
  private swapped(target: Target): Target {
    if (!('tool' in target)) return target;
    const swaps = this.m.swaps.filter((s) => s.from === target.tool);
    return swaps.length > 0
      ? ([...swaps].sort((a, b) => rankOf(a) - rankOf(b) || a.rule.seq - b.rule.seq)[0]?.to ??
          target)
      : target;
  }

  /** The item a target becomes in a slot: a pathway resolves to its best allowed tool. */
  private resolve(given: Target, slot: string, from: string): CardItem | null {
    const target = this.swapped(given);
    if ('action' in target) return this.actionItem(target, from);
    const pathway =
      'pathway' in target ? target.pathway : (this.toolPathway.get(target.tool) ?? null);
    const candidates = 'tool' in target ? [target.tool] : this.preferred(target.pathway);
    // A pathway takes its next allowed tool not already on the card; a named tool is itself.
    const tool = candidates.find(
      (t) => this.toolAllowed(t, slot) && ('tool' in target || !this.toolPlaced(t)),
    );
    if (tool === undefined) return null;
    const used = this.upgraded(tool, slot);
    return {
      target,
      pathway,
      tool: used,
      advanced: this.inTier(used, 'advanced'),
      copy: null,
      tone: this.toneFor(slot, from),
      from,
    };
  }

  /**
   * A plan that has a tier gets a tool's fuller version of that tier in its place (Movement+ for
   * Move), when the card allows it: in Amber and Red the floor rows keep the free tool (E-62).
   */
  private upgraded(tool: string, slot: string): string {
    const version = this.m.versions.get(tool);
    if (version === undefined || this.toolPlaced(version)) return tool;
    const by = this.m.upgrades.find((u) => this.inTier(version, u.tier));
    if (!by || !this.toolAllowed(version, slot)) return tool;
    this.notes.push(`${by.rule.ref}: ${version} in place of ${tool}`);
    return version;
  }

  /**
   * One tool of an offered tier beside the card's suggestion (Tab 6d: "one labelled Advanced
   * alternative"; E-62), when the card has none of that tier yet. From the pathway of the card's
   * first tool: a tool of a new kind first (Create, Scripts), then a fuller version of a tool not
   * on the card; never the paid version of the tool beside it. It takes a free alternative place,
   * else the place of an action; never a support option's. The one it replaces is noted.
   */
  private offer(primary: CardItem | null, alternatives: CardItem[]): CardItem[] {
    const o = this.m.offers[0];
    const items = [primary, ...alternatives].filter((i): i is CardItem => i !== null);
    if (!o || items.some((i) => i.tool !== null && this.inTier(i.tool, o.tier)))
      return alternatives;
    const anchor = items.find((i) => i.tool !== null && i.pathway !== null);
    if (!anchor?.pathway) return alternatives;
    const versions = new Set(this.m.versions.values());
    const onCard = new Set(items.flatMap((i) => (i.tool ? [this.m.versions.get(i.tool)] : [])));
    const own = (this.toolsByPathway.get(anchor.pathway) ?? []).filter(
      (t) => this.inTier(t, o.tier) && !onCard.has(t),
    );
    // A free place, else the place of an action ("Check in again"): never of a support option,
    // since money never decides whether someone gets support (Tab 6d; E-62).
    const full = alternatives.length >= MAX_ALTERNATIVES;
    const gone = full ? alternatives.filter((a) => 'action' in a.target).slice(-1) : [];
    if (full && gone.length === 0) return alternatives;
    const kept = alternatives.filter((a) => !gone.includes(a));
    for (const g of gone) this.unplace(g);
    const tool = [
      ...own.filter((t) => !versions.has(t)),
      ...own.filter((t) => versions.has(t)),
    ].find((t) => !this.toolPlaced(t) && this.toolAllowed(t, 'alternative'));
    if (tool === undefined) {
      for (const g of gone) this.place(g, 'alternative');
      return alternatives;
    }
    const item: CardItem = {
      target: { tool },
      pathway: anchor.pathway,
      tool,
      advanced: this.inTier(tool, 'advanced'),
      copy: null,
      tone: this.toneFor('alternative', o.rule.id),
      from: o.rule.id,
    };
    this.place(item, 'alternative');
    this.notes.push(
      `${o.rule.ref} offers ${tool}${gone.length ? ` in place of ${gone.map((g) => keyOf(g.target)).join(', ')}` : ''}`,
    );
    return [...kept, item];
  }

  private preferred(pathway: string): string[] {
    const own = this.toolsByPathway.get(pathway) ?? [];
    const prefs = [...this.m.prefers]
      .sort((a, b) => rankOf(a) - rankOf(b) || a.rule.seq - b.rule.seq)
      .flatMap((p) => p.tools)
      .filter((t) => own.includes(t));
    return [...new Set([...prefs, ...own])];
  }

  private toolAllowed(tool: string, slot: string): boolean {
    if (this.m.excluded.has(tool)) return false;
    if (
      this.m.forbids.some(
        (f) => 'tool' in f.target && f.target.tool === tool && (f.slot === null || f.slot === slot),
      )
    )
      return false;
    if (this.m.tierRequires.some((r) => r.slot === slot && !this.inTier(tool, r.tier)))
      return false;
    return this.m.tierLimits.every((l) => {
      if (!this.inTier(tool, l.tier) || (l.slot !== null && l.slot !== slot)) return true;
      const used = this.placed.filter(
        (p) =>
          p.item.tool !== null &&
          this.inTier(p.item.tool, l.tier) &&
          (l.slot === null || p.slot === l.slot),
      );
      return used.length + 1 <= l.max;
    });
  }

  private inTier(tool: string, tier: string): boolean {
    return this.m.tiers.get(tier)?.has(tool) ?? false;
  }

  // ---- details ----

  private actionItem(target: Target, from: string): CardItem {
    return { target, pathway: null, tool: null, advanced: false, copy: null, tone: [], from };
  }

  private toolPlaced(tool: string): boolean {
    return this.placed.some((p) => p.item.tool === tool);
  }

  /** The target is the required pathway, or one of its tools. */
  private within(target: Target, required: Target): boolean {
    if (!('pathway' in required)) return keyOf(target) === keyOf(required);
    if ('pathway' in target) return target.pathway === required.pathway;
    return 'tool' in target && this.toolPathway.get(target.tool) === required.pathway;
  }

  /** The same tool, or the same target in another slot (a button never shows twice). */
  private isPlaced(item: CardItem, slot: string): boolean {
    return this.placed.some(
      (p) =>
        (p.item.tool !== null && p.item.tool === item.tool) ||
        (keyOf(p.item.target) === keyOf(item.target) && p.slot !== 'visible' && slot !== 'visible'),
    );
  }

  private place(item: CardItem, slot: string): void {
    this.placed.push({ item, slot });
  }

  /** An alternative that gave way to the offered tool leaves the card. */
  private unplace(item: CardItem): void {
    const at = this.placed.findIndex((p) => p.item === item && p.slot === 'alternative');
    if (at >= 0) this.placed.splice(at, 1);
  }

  /** Wording of a required target: the best proposal of the same target that has wording. */
  private copyFor(target: Target): string | null {
    return (
      [...this.m.proposals]
        .filter((p) => keyOf(p.target) === keyOf(target) && p.copy !== null)
        .sort((a, b) => rankOf(a) - rankOf(b) || a.rule.seq - b.rule.seq)[0]?.copy ?? null
    );
  }

  /** Tone keys (copy.use) from the row that put the item there (E-51). */
  private toneFor(slot: string, from: string): string[] {
    const row = from.split('#')[0];
    return this.m.copyUses.filter((c) => c.slot === slot && c.rule.rowId === row).map((c) => c.key);
  }

  private reminder(): Card['reminder'] {
    const best = [...this.m.reminders].sort(
      (a, b) => rankOf(a) - rankOf(b) || a.rule.seq - b.rule.seq,
    )[0];
    return best ? { minutes: best.minutes, copy: best.copy } : null;
  }

  private drivers(): Card['drivers'] {
    const order = valuesOf(this.catalogue, 'driver').map((v) => v.code);
    return [...this.state.drivers.entries()]
      .filter(([code]) => this.m.keepOnly.every((k) => k.drivers.includes(code)))
      .sort(([a, wa], [b, wb]) => wb - wa || order.indexOf(a) - order.indexOf(b))
      .map(([code, weight]) => ({ code, weight }));
  }

  private stepCap(): number | null {
    const caps = this.m.stepCaps.filter((c): c is number => c !== null);
    return caps.length > 0 ? Math.min(...caps) : null;
  }

  private groupFate(g: Group, fate: ProposalFate['fate'], by?: string, slot?: string): void {
    g.members.forEach((p) => {
      this.fate(p, fate, by, slot);
    });
  }

  /** Records a proposal's fate; `slot` is where it ended up when that differs from where it asked. */
  private fate(p: Proposal, fate: ProposalFate['fate'], by?: string, slot?: string): void {
    this.fates.push({
      from: p.rule.id,
      slot: slot ?? p.slot,
      target: p.target,
      fate,
      ...(by ? { by } : {}),
    });
  }
}
