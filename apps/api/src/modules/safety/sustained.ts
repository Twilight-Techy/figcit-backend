// SF-2: Very Constrained sustained 7+ days, or 14+ days with no improvement. Raises a gentle,
// fixed-wording prompt towards support; never changes the band (Tab 10, Tab 11 row 13).

export interface BandPoint {
  readonly at: Date;
  readonly band: string;
}

const DAY = 86_400_000;
const MIN_POINTS = 3;
const IMPROVED = new Set(['conditional', 'available']);

export function sustainedFlag(
  points: readonly BandPoint[],
  now: Date,
  days: { red: number; noImprovement: number },
): 'sustained_red' | 'no_improvement' | null {
  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const within = (n: number) => sorted.filter((p) => p.at.getTime() >= now.getTime() - n * DAY);
  const red = within(days.red);
  const first = red[0];
  if (
    red.length >= MIN_POINTS &&
    first &&
    now.getTime() - first.at.getTime() >= (days.red - 1) * DAY &&
    red.every((p) => p.band === 'very_constrained')
  )
    return 'sustained_red';
  const long = within(days.noImprovement);
  const start = long[0];
  if (
    long.length >= MIN_POINTS * 2 &&
    start &&
    now.getTime() - start.at.getTime() >= (days.noImprovement - 1) * DAY &&
    !long.some((p) => IMPROVED.has(p.band))
  )
    return 'no_improvement';
  return null;
}
