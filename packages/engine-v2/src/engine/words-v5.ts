import type { Catalogue, CatalogueValue } from '../format/catalogue.js';
import type { Card, EngineInput } from './types.js';

// Rules Engine v5.0: the card's words (RT-1 to RT-4, TK-2, TK-3), put together from the copy table
// the way Tab 20's stories show them. Pure: the card, what the person entered, the copy and the
// catalogue in; three strings out. Checked against Tab 20 (test/v5-stories.test.ts).

export interface CardTask {
  readonly title: string;
  /** Its chip's code (Tab 10); no chip is `usual` (TK-1). */
  readonly chip: string;
}

export interface CardWordsV5 {
  readonly headline: string;
  /** "Why this": who you are now, then at most two more sentences, then the headline (RT-4). */
  readonly reason: string;
  /** How the tasks were sorted (TK-2), or that they wait (Red, no-words); null with no task. */
  readonly taskLine: string | null;
}

export interface WordsSources {
  readonly copy: ReadonlyMap<string, string>;
  readonly catalogue: Catalogue;
  /** The tasks in the order the card shows them (`taskOrder`). */
  readonly tasks: readonly CardTask[];
}

/** TK-2's line names the first two kinds of task (Tab 20). */
const MAX_CHIPS = 2;
/** The chip a Red card names: it can't wait (TK-3). */
const CANT_WAIT = 'can_t_wait';

/** RT-4 names two body signs at most (Tab 20). */
const MAX_BODY = 2;
/** Tab 3's sense groups. */
const OVERLOAD = 'overload';
const BODY_NEEDS = 'body_needs';

/** RT-4: at most three sentences before the body needs line (Tab 20). */
const MAX_SENTENCES = 3;

const fill = (text: string, values: Readonly<Record<string, string>>): string =>
  text.replace(/\{([\w ]+)\}/g, (all, name: string) => values[name] ?? all);

class Words {
  constructor(
    private readonly card: Card,
    private readonly input: EngineInput,
    private readonly src: WordsSources,
  ) {}

  private say(key: string, values: Readonly<Record<string, string>> = {}): string {
    return fill(this.src.copy.get(key) ?? '', values);
  }
  private values(domain: Parameters<Catalogue['get']>[0]): readonly CatalogueValue[] {
    return this.src.catalogue.get(domain) ?? [];
  }
  private list(fact: string): readonly string[] {
    const v = this.input[fact];
    return Array.isArray(v) ? (v as string[]) : [];
  }

  headline(): string {
    const p = this.card.pattern ?? '';
    const decides = this.card.feeling;
    if (['4', '48'].includes(p) && decides?.group === 'low') return this.say('card.headline.low');
    if (['2', '54'].includes(p) && ['clear_headed', 'empowered'].includes(decides?.code ?? ''))
      return this.say('card.p55.headline');
    // Pattern 60: "Today fits {plain chip words}." (RW-2).
    return fill(this.say(`card.p${p}.headline`), { 'plain chip words': this.chipWords() });
  }

  /** The first group's kinds of task in plain words: "the usual things and something new". */
  private chipWords(): string {
    const first = this.card.taskOrder?.first ?? [];
    const plain = new Map(this.values('task_chip').map((v) => [v.code, v.note ?? v.label]));
    return [...new Set(this.src.tasks.map((t) => t.chip))]
      .filter((c) => first.includes(c))
      .slice(0, MAX_CHIPS)
      .map((c) => plain.get(c) ?? c)
      .join(' and ');
  }

  /** "You're in Storm Mode, feeling angry (strong) and anxious with tension" (RT-4). */
  private who(): string {
    const e = this.input['state.energy'];
    const m = this.input['state.mood'];
    const cell =
      typeof e === 'number' && typeof m === 'number'
        ? this.values('cell').find((v) => v.code.toUpperCase() === `E${String(e)}M${String(m)}`)
        : undefined;
    let out = this.say('reason.state', { state: cell?.label ?? this.say('state.not_sure') });
    const d = this.card.feeling;
    if (d) {
      const strength = this.values('intensity_band').find(
        (b) => d.level !== null && d.level >= (b.from ?? 0) && d.level <= (b.to ?? 0),
      );
      out += `, ${this.say('reason.feeling', {
        feeling: this.say(`feeling.${d.code}`),
        strength: this.say(`strength.${strength?.code ?? ''}`),
      })}`;
      const felt = Object.keys((this.input['family.intensity'] as object | undefined) ?? {});
      for (const other of felt.filter((f) => f !== d.code))
        out += ` ${this.say('reason.and', { feeling: this.say(`feeling.${other}`) })}`;
    }
    const body = this.list('body.signs')
      .slice(0, MAX_BODY)
      .map((s) => this.say(`body.${s}`));
    if (body.length > 0) out += ` ${this.say('reason.with', { body: body.join(' and ') })}`;
    return `${out}.`;
  }

  /**
   * The senses ticked, by Tab 3's groups: overload is said before the place, a body need after
   * the headline; under-stimulation is in the buttons only.
   */
  private senses(): { around: string[]; needs: string[] } {
    const groups = new Map(this.values('sensitivity_flag').map((v) => [v.code, v.group]));
    const ticked = this.list('sensitivity.flags');
    const words = (group: string): string[] =>
      ticked
        .filter((s) => groups.get(s) === group)
        .map((s) => this.say(`sense.${s}`))
        .filter(Boolean);
    return { around: words(OVERLOAD), needs: this.card.noWords ? [] : words(BODY_NEEDS) };
  }

  /** Where you are: discreet, open to audio with headphones, or silent in an exam. */
  private place(): string | null {
    const setting = this.input['context.setting'];
    if (typeof setting !== 'string' || setting === 'home') return null;
    if (setting === 'exam_interview_or_assessment') return this.say('reason.silent');
    const place = this.say(`place.${setting}`);
    if (place === '') return null;
    return this.list('context.supports').includes('headphones_or_earbuds')
      ? this.say('reason.audio', { place })
      : this.say('reason.discreet', { place });
  }

  reason(headline: string): string {
    if (this.card.kind === 'urgent_screen') return this.say('reason.urgent');
    const { around, needs } = this.senses();
    // Only when the colour went down (Blue is a recovery, not a drop).
    const lowered = this.card.lowered === true && this.card.light !== 'blue';
    const change = !lowered
      ? null
      : this.card.noWords
        ? this.say('reason.switched_off')
        : this.say('reason.stronger', { colour: this.say(`colour.${this.card.light ?? ''}`) });
    const sentences = [this.who(), change, around[0] ?? null, this.place(), headline].filter(
      (s): s is string => s !== null && s !== '',
    );
    return [...sentences.slice(0, MAX_SENTENCES), ...needs.slice(0, 1)].join(' ');
  }

  taskLine(): string | null {
    const { tasks } = this.src;
    if (tasks.length === 0 || this.card.kind === 'urgent_screen') return null;
    if (this.card.light === 'red' || this.card.noWords) {
      const wait = tasks
        .filter((t) => t.chip === CANT_WAIT && this.card.light === 'red')
        .map((t) => this.say('tasks.red_cant_wait', { task: t.title }));
      return [this.say('tasks.red'), ...wait].join(' ');
    }
    const words = this.chipWords();
    const line = words !== '' ? [this.say('tasks.line', { chips: words })] : [];
    const top = tasks[0];
    if (this.card.light === 'amber' && top) line.push(this.say('tasks.small', { task: top.title }));
    return line.length > 0 ? line.join(' ') : null;
  }
}

/**
 * The tasks in the card's order (TK-2): those whose chip is in `taskOrder.first`, by that order
 * (ties as entered), then the rest as entered, which wait (`later`). O(n log n).
 */
export function orderTasks<T extends CardTask>(
  card: Pick<Card, 'taskOrder'>,
  tasks: readonly T[],
): { first: T[]; later: T[] } {
  const order = card.taskOrder?.first ?? [];
  const first = tasks
    .map((t, i) => ({ t, i }))
    .filter((x) => order.includes(x.t.chip))
    .sort((a, b) => order.indexOf(a.t.chip) - order.indexOf(b.t.chip) || a.i - b.i)
    .map((x) => x.t);
  return { first, later: tasks.filter((t) => !order.includes(t.chip)) };
}

/** The card's headline, reason and task line, for a v5.0 card (`pattern` set). */
export function cardWordsV5(card: Card, input: EngineInput, sources: WordsSources): CardWordsV5 {
  const w = new Words(card, input, sources);
  const headline = w.headline();
  return { headline, reason: w.reason(headline), taskLine: w.taskLine() };
}
