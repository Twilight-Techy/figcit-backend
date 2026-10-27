/** Ends an exhaustive switch so a new code breaks the build until it's handled (rules 3). */
export function assertNever(value: never): never {
  throw new TypeError(`Unhandled case: ${String(value)}`);
}
