// The guest space's numbers, in one place (docs/GUEST_SPACE.md). A guest space is a real account
// with no email, kept for GUEST_DAYS at most and then erased.

/** How long a guest space lasts. A hard cap: never extended, never sliding. */
export const GUEST_DAYS = 30;
export const GUEST_MS = GUEST_DAYS * 86_400_000;

/** The name every guest space has. A guest cannot clear or change it. */
export const GUEST_NICKNAME = 'Guest';

/** What a guest may keep. Past these a guest gets 403 `guest_limit`: an account has no such limit. */
export const GUEST_MAX_OPEN_TASKS = 20;
export const GUEST_MAX_DUMPS = 50;

/** Days left at which a guest is told, in the inbox, how long the space has left. */
export const GUEST_NOTICE_DAYS = [7, 3, 1] as const;
