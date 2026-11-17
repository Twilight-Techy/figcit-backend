// No em dashes in what FigCit says (owner, 17 Nov 2026). The rules workbook is the source document
// and keeps its punctuation; its words are cleaned where the API hands them to the app. Only
// FigCit's own words: never anything a person typed.

/** "Rest first — then this" reads "Rest first. Then this"; a dash at either end just goes. */
export function noEmDash(text: string): string {
  if (!text.includes('—')) return text;
  return text
    .replace(/^\s*—\s*|\s*—\s*$/g, '')
    .replace(/\s*—\s*(\S)/g, (_, next: string) => `. ${next.toUpperCase()}`)
    .replace(/([.?!])\. /g, '$1 ');
}

/** Every string in a structure of FigCit's own words (codes never hold a dash). */
export function noEmDashes<T>(value: T): T {
  if (typeof value === 'string') return noEmDash(value) as T;
  if (Array.isArray(value)) return value.map((v: unknown) => noEmDashes(v)) as T;
  if (value instanceof Map)
    return new Map([...value].map(([k, v]: [unknown, unknown]) => [k, noEmDashes(v)])) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]: [string, unknown]) => [k, noEmDashes(v)]),
    ) as T;
  return value;
}
