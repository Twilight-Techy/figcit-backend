import { describe, expect, it } from 'vitest';
import { orderTasks, type OrderableTask } from '../src/index.js';
import { snapshot } from './helpers.js';

const task = (id: string, over: Partial<OrderableTask> = {}): OrderableTask => ({
  id,
  timeline: 'T6',
  drivers: [],
  stepsLeft: 0,
  puttingOff: false,
  skipCount: 0,
  ...over,
});

describe('orderTasks', () => {
  const tasks = [
    task('hard', { timeline: 'T2', drivers: ['challenge', 'novelty'], traits: ['multi_step'] }),
    task('routine', { timeline: 'T3', drivers: ['routine'], traits: ['done_before'] }),
    task('now', { timeline: 'T0' }),
    task('later', { timeline: 'T1', planSlot: 'not_today' }),
  ];

  it('puts what is due now first on a Green day', () => {
    const order = orderTasks(tasks, 'green', snapshot);
    expect(order[0]?.id).toBe('now');
    expect(order[0]?.whyNow).toBe('due_now');
    expect(order.at(-1)?.id).toBe('later');
    expect(order.find((o) => o.id === 'hard')?.onlyIfMust).toBe(false);
  });

  it('prefers familiar work over heavy work under strain', () => {
    const order = orderTasks(tasks, 'red', snapshot).map((o) => o.id);
    expect(order.indexOf('routine')).toBeLessThan(order.indexOf('hard'));
    expect(orderTasks(tasks, 'red', snapshot).find((o) => o.id === 'hard')?.onlyIfMust).toBe(true);
  });

  it('is stable and explains every task', () => {
    const same = [task('a'), task('b'), task('c')];
    expect(orderTasks(same, 'yellow', snapshot).map((o) => o.id)).toEqual(['a', 'b', 'c']);
    for (const o of orderTasks(tasks, 'amber', snapshot))
      expect(o.whyNowText.length).toBeGreaterThan(5);
  });

  it('offers overdue work as a small step', () => {
    expect(orderTasks([task('x', { timeline: 'TX' })], 'green', snapshot)[0]?.whyNow).toBe(
      'overdue_small_step',
    );
  });
});
