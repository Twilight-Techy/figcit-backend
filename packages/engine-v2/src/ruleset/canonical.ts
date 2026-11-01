/** Values that canonical JSON can hold. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue | undefined };

/**
 * Canonical JSON (RFC 8785, the JSON Canonicalization Scheme): object keys sorted by UTF-16 code
 * units, no whitespace, numbers and strings serialised as ECMAScript does. Two equal values always
 * give the same text, so its SHA-256 identifies a rule set version (engine-v2 DESIGN §3.5).
 * Keys whose value is `undefined` are left out, as `JSON.stringify` does. O(n log n) in the keys.
 */
export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: ${String(value)} is not JSON`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value as readonly JsonValue[];
    return `[${items.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as { readonly [key: string]: JsonValue | undefined };
    const parts: string[] = [];
    // Default sort compares UTF-16 code units, which is what RFC 8785 asks for.
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item !== undefined) parts.push(`${JSON.stringify(key)}:${canonicalJson(item)}`);
    }
    return `{${parts.join(',')}}`;
  }
  throw new TypeError(`canonicalJson: ${typeof value} is not JSON`);
}
