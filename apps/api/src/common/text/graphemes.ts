// Characters as a person sees them (grapheme clusters): "é", "👋🏽" and "تُ" each count as one.
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}
