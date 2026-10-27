// Text normalisation for phrase matching: lower case, accents and apostrophes removed, common
// character swaps undone, everything else non-alphanumeric becomes a single space.
// O(n) in text length.

const SWAPS: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

function isLetter(ch: string | undefined): boolean {
  return ch !== undefined && ch >= 'a' && ch <= 'z';
}

export function normalise(text: string): string {
  const lower = text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’`]/g, '');
  const out: string[] = [];
  let lastSpace = true;
  for (let i = 0; i < lower.length; i += 1) {
    let ch = lower[i] ?? '';
    const swap = SWAPS[ch];
    // Only undo swaps inside words ("k1ll" → "kill"), never in plain numbers ("116 123").
    if (swap !== undefined && (isLetter(lower[i - 1]) || isLetter(lower[i + 1]))) ch = swap;
    const keep = (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
    if (keep) {
      out.push(ch);
      lastSpace = false;
    } else if (!lastSpace) {
      out.push(' ');
      lastSpace = true;
    }
  }
  return out.join('').trim();
}
