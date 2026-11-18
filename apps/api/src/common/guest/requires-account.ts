import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const REQUIRES_ACCOUNT = 'figcit:requires-account';

/**
 * Marks a route, or a whole controller, that a guest space cannot use: it answers 403
 * `account_required` (docs/GUEST_SPACE.md). The check is in AccountGuard, which reads the account as
 * it is now, so a guest who has just made an account is let through at once.
 */
export const RequiresAccount = (): CustomDecorator => SetMetadata(REQUIRES_ACCOUNT, true);
