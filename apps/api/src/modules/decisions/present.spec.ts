import { describe, expect, it } from 'vitest';
import type { Card } from '@figcit/engine-v2';
import { lowerFirst, present, type CardIds, type Presentation } from './present.js';

describe('a label inside a sentence', () => {
  it('starts lower case, but keeps an acronym and the word I as written', () => {
    expect(lowerFirst('Start the reset')).toBe('start the reset');
    expect(lowerFirst('AI body double')).toBe('AI body double');
    expect(lowerFirst("I'll try the task anyway")).toBe("I'll try the task anyway");
    expect(lowerFirst('Ignore it')).toBe('ignore it');
    expect(lowerFirst('')).toBe('');
  });
});

describe("a card's practice limits", () => {
  const v2 = (practice: Card['practice'], kind: Card['kind'] = 'card'): Card => ({
    kind,
    band: null,
    light: 'green',
    primary: null,
    alternatives: [],
    queued: [],
    visible: [],
    prompts: [],
    reminder: null,
    supportVisible: false,
    drivers: [],
    stepCap: null,
    minutesCap: null,
    practice,
    because: [],
  });
  const shown = { icon: '', label: '', hex: '' };
  const p: Presentation = {
    copy: new Map(),
    lights: { green: shown, yellow: shown, amber: shown, red: shown, blue: shown },
    state: { cellId: 'E3M3', name: '', icon: '', meaning: '', confirmed: true },
    routes: [],
    said: [],
    taskTitle: null,
    version: '',
    patterns: [],
    timeline: null,
    rejected: [],
  };
  const ids: CardIds = {
    id: '00000000-0000-4000-8000-000000000001',
    checkInId: '00000000-0000-4000-8000-000000000002',
    createdAt: new Date('2026-11-04T09:00:00.000Z'),
    taskId: null,
    origin: 'online',
  };

  it('carries what the engine decided, unchanged', () => {
    const limits = [
      { modes: ['eyes_open'], maxMinutes: null, tools: ['stillness', 'settle_5'] },
      { modes: ['silent', 'eyes_open', 'headphones'], maxMinutes: 3, tools: null },
    ];
    expect(present(v2(limits), p, ids).card.practiceLimits).toEqual(limits);
  });

  it('is empty when the engine sets no limit', () => {
    expect(present(v2([]), p, ids).card.practiceLimits).toEqual([]);
    expect(present(v2([], 'support_screen'), p, ids).card.practiceLimits).toEqual([]);
  });
});
