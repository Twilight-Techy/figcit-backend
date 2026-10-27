// Aho–Corasick multi-phrase matcher (rules §4: linear time, no regular expressions built from
// input). Built once per snapshot. Matches only on whole-word boundaries of normalised text.

interface Node {
  readonly next: Map<string, number>;
  fail: number;
  /** Indexes of phrases ending here (including via fail links, merged at build). */
  out: number[];
}

export interface PhraseMatch {
  readonly phrase: number;
  readonly start: number;
  readonly end: number;
}

const ROOT = 0;

export class PhraseMatcher {
  private readonly nodes: Node[] = [{ next: new Map(), fail: ROOT, out: [] }];
  private readonly lengths: number[] = [];

  constructor(phrases: readonly string[]) {
    for (const [index, phrase] of phrases.entries()) this.add(phrase, index);
    this.build();
  }

  private node(state: number): Node {
    const node = this.nodes[state];
    if (!node) throw new RangeError(`no state ${String(state)}`);
    return node;
  }

  private add(phrase: string, index: number): void {
    let state = ROOT;
    for (const ch of phrase) {
      const node = this.node(state);
      let next = node.next.get(ch);
      if (next === undefined) {
        next = this.nodes.length;
        this.nodes.push({ next: new Map(), fail: ROOT, out: [] });
        node.next.set(ch, next);
      }
      state = next;
    }
    this.node(state).out.push(index);
    this.lengths[index] = phrase.length;
  }

  /** Follows fail links from `state` until a node with an edge for `ch` (or the root). */
  private step(state: number, ch: string): number {
    let s = state;
    while (s !== ROOT && !this.node(s).next.has(ch)) s = this.node(s).fail;
    return this.node(s).next.get(ch) ?? ROOT;
  }

  /** Breadth-first fail links. O(total phrase length × alphabet), once per snapshot. */
  private build(): void {
    const queue = [...this.node(ROOT).next.values()];
    for (let head = 0; head < queue.length; head += 1) {
      const state = queue[head] ?? ROOT;
      const node = this.node(state);
      for (const [ch, child] of node.next) {
        queue.push(child);
        const target = state === ROOT ? ROOT : this.step(node.fail, ch);
        const childNode = this.node(child);
        childNode.fail = target === child ? ROOT : target;
        childNode.out = [...childNode.out, ...this.node(childNode.fail).out];
      }
    }
  }

  private wholeWord(text: string, start: number, end: number): boolean {
    const before = text[start - 1];
    const after = text[end];
    return (before === undefined || before === ' ') && (after === undefined || after === ' ');
  }

  /** All whole-word matches in `text` (already normalised). O(text length + matches). */
  match(text: string): PhraseMatch[] {
    const found: PhraseMatch[] = [];
    let state = ROOT;
    for (let i = 0; i < text.length; i += 1) {
      state = this.step(state, text[i] ?? '');
      for (const phrase of this.node(state).out) {
        const start = i - (this.lengths[phrase] ?? 0) + 1;
        if (this.wholeWord(text, start, i + 1)) found.push({ phrase, start, end: i + 1 });
      }
    }
    return found;
  }
}
