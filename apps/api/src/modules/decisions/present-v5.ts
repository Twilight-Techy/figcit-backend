import {
  cardWordsV5,
  orderTasks,
  type Card,
  type CardItem,
  type Catalogue,
  type DroppedAnswer,
  type EngineInput,
} from '@figcit/engine-v2';
import type { CardV5Dto, PreviewV5Dto } from './v5.schemas.js';

// A Rules Engine v5.0 card as the app shows it: every word from the version's copy table and
// catalogue (LBL-1: a tool shows only its user_label and user_description), the reason and task
// line from cardWordsV5, and the tasks in the colour's order (TK-2).

export interface PresentV5Sources {
  readonly copy: ReadonlyMap<string, string>;
  readonly catalogue: Catalogue;
  /** The check-in's tasks with their chip codes (no chip is `usual`), as entered. */
  readonly tasks: readonly { readonly title: string; readonly chip: string }[];
  readonly input: EngineInput;
}

const fill = (text: string, values: Readonly<Record<string, string>>): string =>
  text.replace(/\{(\w+)\}/g, (all, k: string) => values[k] ?? all);

function labelOf(catalogue: Catalogue, domain: 'tool' | 'pathway', code: string): string {
  return (catalogue.get(domain) ?? []).find((v) => v.code === code)?.label ?? code;
}

function itemOf(
  item: CardItem,
  card: Card,
  src: PresentV5Sources,
  top: string | null,
): CardV5Dto['primary'] {
  const plan = item.plan ?? null;
  if (item.tool !== null)
    return {
      kind: 'tool',
      code: item.tool,
      pathway: item.pathway,
      label: item.label ?? labelOf(src.catalogue, 'tool', item.tool),
      description: item.description ?? null,
      plan,
    };
  if ('action' in item.target) {
    const action = item.target.action;
    // TK-4's suggested task says itself; the others are Tab 18's and Tab 20's words.
    const label =
      action === 'suggest_task' && card.suggestion
        ? (src.copy.get(card.suggestion) ?? action)
        : fill(src.copy.get(`action.${action}`) ?? action, { task: top ?? '' });
    return { kind: 'action', code: action, pathway: null, label, description: null, plan: null };
  }
  const pathway = 'pathway' in item.target ? item.target.pathway : (item.pathway ?? '');
  return {
    kind: 'pathway',
    code: pathway,
    pathway,
    label: labelOf(src.catalogue, 'pathway', pathway),
    description: null,
    plan: null,
  };
}

/** The Help menu with each card's words (Tab 7: what the user sees, and its hint). */
export function menuOf(card: Card, catalogue: Catalogue): PreviewV5Dto['menu'] {
  const values = catalogue.get('support_card') ?? [];
  const words = (code: string) => {
    const v = values.find((x) => x.code === code);
    return { code, label: v?.label ?? code, hint: v?.note ?? null };
  };
  return {
    cards: (card.menu?.cards ?? []).map(words),
    more: (card.menu?.more ?? []).map((code) => ({ ...words(code), hint: null })),
  };
}

/** The card the app shows. */
export function presentV5(card: Card, src: PresentV5Sources): CardV5Dto {
  const { first, later } = orderTasks(card, src.tasks);
  const ordered = [...first, ...later];
  const words = cardWordsV5(card, src.input, {
    copy: src.copy,
    catalogue: src.catalogue,
    tasks: ordered,
  });
  const top = ordered[0]?.title ?? null;
  const item = (i: CardItem) => itemOf(i, card, src, top);
  const said = (key: string) => ({ key, text: src.copy.get(key) ?? key });
  return {
    kind: card.kind,
    light: card.light,
    pattern: card.pattern ?? null,
    noWords: card.noWords === true,
    headline: words.headline,
    reason: words.reason,
    taskLine: words.taskLine,
    primary: card.primary ? item(card.primary) : null,
    alternatives: card.alternatives.map(item).filter((i) => i !== null),
    supportVisible: card.supportVisible,
    suggestion: card.suggestion ? said(card.suggestion) : null,
    prompts: card.prompts.map(said),
    tasks:
      src.tasks.length > 0
        ? { first: first.map((t) => t.title), later: later.map((t) => t.title) }
        : null,
    helpSwap: card.helpSwap
      ? { card: card.helpSwap.card, reason: src.copy.get(card.helpSwap.reason) ?? '' }
      : null,
  };
}

/** What the check-in screens show as the person goes: the colour, its sentence, the menu. */
export function previewV5(
  card: Card,
  src: PresentV5Sources,
  dropped: readonly DroppedAnswer[],
): PreviewV5Dto {
  const words = cardWordsV5(card, src.input, {
    copy: src.copy,
    catalogue: src.catalogue,
    tasks: [],
  });
  // The first sentence(s) before the headline: who you are now and why the colour (RT-4).
  const reason = words.reason.endsWith(words.headline)
    ? words.reason.slice(0, -words.headline.length).trim()
    : words.reason;
  return {
    kind: card.kind,
    light: card.light,
    lowered: card.lowered === true,
    noWords: card.noWords === true,
    reason,
    menu: menuOf(card, src.catalogue),
    dropped: [...dropped],
  };
}
