// The guest space's numbers, in one place (docs/GUEST_SPACE.md). A guest space is a real account
// with no email, kept for GUEST_DAYS at most and then erased.

/** How long a guest space lasts. A hard cap: never extended, never sliding. */
export const GUEST_DAYS = 30;
export const GUEST_MS = GUEST_DAYS * 86_400_000;

/** The name every guest space has. A guest cannot clear or change it. */
export const GUEST_NICKNAME = 'Guest';
