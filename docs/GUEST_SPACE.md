# Guest space

An adult can use NUCCESS without an account. A **guest space** is a real account with no email and no password, kept for 30 days at most and then erased. The owner approved the design on 18 Nov 2026. This page is the backend's side: what it does, its API, the lifecycle, the limits against abuse, the settings and the deploy steps.

## Decisions

1. **A real user row.** `email` and `password_hash` are null, `nickname` is "Guest", `age_band` is adult, `age_confirmed_at` and `terms_accepted_at` are set (so `detailsDone` is true), the plan is free, there is a data key, `is_guest` is true and `guest_expires_at` is 30 days after it was made. The 30 days are a hard cap: never extended, never sliding.
2. **Same account on linking.** Confirming an email clears `is_guest` and `guest_expires_at` on the same user: same id, same data key, nothing copied.
3. **Adults only.** The age is asked first by the app. Under 16: no user is made. 16 or 17: the normal sign-up through an institution, never a guest space. 18 and over: the notice page, then `POST /v1/auth/guest`. The body must say `ageBand: "18_plus"` and `acceptTerms: true`.
4. **Consents.** `wellbeing_data` is granted at creation (the notice page says that continuing accepts the Terms and Privacy). Personalisation, analytics and research are written as off; research is never asked here.
5. **No country.** `region` is the default `GB`, so Help and SOS show the generic UK lines. An optional "Where in the UK?" setting is phase 2.
6. **What needs an account** (403 `account_required`, "Create an account to use this."): billing checkout, fake-complete and cancel; joining an institution and asking it for support; creating a share link; Express assist (every mode); every `/ai` route; speech uploads and transcriptions; file uploads. Everything else works: Help, check-ins, tools, tasks, Focus, Adapt, Dump text, reminders by push and inbox, progress up to 30 days, data export, the support plan and trusted contacts, delete.
7. **What a guest may keep** (403 `guest_limit`): 20 open tasks, 50 dumps and 50 items in one dump (an account may have 200). The numbers are in `apps/api/src/common/guest/constants.ts`, and every path goes through one helper, `GuestCaps` (`common/guest/guest-caps.service.ts`): `POST /tasks`, a task typed into `POST /check-ins` (`demand.title`; the legacy check-in is refused whole at the cap, nothing stored), sync pushes (`task:create`, `dump:create`: each operation on its own, so a batch applies what fits and rejects the rest with `error: "guest_limit"`, and a rejection is final), turning a dump item into a task, **reopening** a finished or dropped task (it counts as open again), `POST /dumps` and `POST /dumps/:id/items`. A dump with more than 50 lines is refused, not cut short. The count and the insert run in one transaction under a per-user, per-kind advisory lock, so parallel requests cannot all see room. Finishing a task makes room. Steps are bounded by their own schema and add nothing to count. A guest cannot clear the name "Guest" (a `PATCH /me` with a null nickname keeps it; it can be renamed).
8. **Erase.** `DELETE /v1/me` for a guest is an immediate `eraseNow` (204, no grace period, the data key is destroyed) and clears the refresh cookie. Decision records and safety events keep `userId` null as for any erase (E-05, E-52). A guest space is never restored by a sign-in link.

## API

| Route                                            |                                                                                                                                                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/auth/guest` (public)                   | `{ ageBand: "18_plus", acceptTerms: true, botToken? }` gives 201 and the same session as sign-in, with `user.isGuest: true`. 400 for anything else, 429 over a per-address limit, 503 `guest_unavailable` over the daily cap. |
| `GET /v1/me`                                     | adds `isGuest` and `guestExpiresAt` (ISO, null for an account). The app counts the days left from it, rounding up.                                                                                                            |
| `POST /v1/auth/guest/link/email` (guest session) | `{ email }` gives 202 always, whether or not the address has an account. Mails "Confirm your email" with a link. 403 for an account.                                                                                          |
| `POST /v1/auth/magic-link/verify` `{ token }`    | for that link: attaches the email and returns a normal session (below). 409 `email_has_account` if the address belongs to another account.                                                                                    |
| `DELETE /v1/me`                                  | a guest: 204 at once, no body needed. An account: 202 with the words, as before.                                                                                                                                              |

The OpenAPI file is `openapi/openapi.json`. `Problem.code` lists the codes the app acts on (`x-known-codes`): `account_required`, `guest_limit`, `email_has_account`, `not_entitled`, `rate_limited` and the others.

### Linking an email

1. The guest asks (`link/email`). A magic link is stored with the purpose `link_guest`, bound to the guest's user id, and the mail is sent. Nothing is attached.
2. Opening the link (the existing verify endpoint, token only: a confirmation link has no typed code, and is never the "newest link" a sign-in code is checked against) spends it, then:
   - the address belongs to another account: **409 `email_has_account`**, nothing is attached, the guest space stays as it was and the link is spent;
   - otherwise the same user gets the email, verified, stops being a guest, **has its password cleared if one was somehow there, and every existing session of it is revoked** (one transaction); the person who opened the link gets the one fresh session, as long as any other;
   - opening it again for an address that is already this account's signs in the same account (a mail scanner may open it first); an expired link or an ended guest space is 410.
3. The email is never attached before it is confirmed, so an address cannot be claimed without its mailbox. Two guests confirming the same address: the unique email decides, the second gets 409.

## Lifecycle

- A session of a guest, and its refresh tokens, end no later than `guest_expires_at`. A guest past it cannot refresh or get a new session.
- A daily worker job (`privacy.purge-guests`, 03:10 Europe/London) erases guest spaces with `guest_expires_at <= now` through `eraseNow`, in batches of 100, then writes the expiring notices. A space that fails to erase is logged and tried again the next day.
- **Inbox notices** `guest_expiring` at 7, 3 and 1 days left, one per user and threshold (if days were missed, the smallest threshold reached). Plain and calm ("Your guest space has 3 days left"); they open `/me/guest/`. Never for an account.

## Abuse limits

`POST /v1/auth/guest` is public, so it is limited three ways, all from the table `guest_signups` (one row per guest space made, holding only a keyed hash of the network address, deleted after 2 days; Postgres, so it holds with several API instances), plus the route's own burst limit of 10 a minute:

| Setting                                    | Default                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `GUEST_SIGNUPS_PER_HOUR` per address       | 5                                                                                                                 |
| `GUEST_SIGNUPS_PER_DAY` per address        | 20                                                                                                                |
| `GUEST_DAILY_CAP` in all, per day          | 2000                                                                                                              |
| `TRUST_PROXY_HOPS`                         | 1 (proxies in front of the API: 1 for Heroku, Render or one Caddy or nginx; 2 with a CDN too; 0 trusts no header) |
| `GUEST_BOT_CHALLENGE`                      | off                                                                                                               |
| `GUEST_BOT_VERIFY_URL`, `GUEST_BOT_SECRET` | unset                                                                                                             |

The bot challenge, when on, needs a `botToken` in the body and checks it with any siteverify-style service (Turnstile, hCaptcha, reCAPTCHA): `POST` of `secret`, `response` and `remoteip`, answer `{ success: true }`. On without the URL and secret it answers 501, never waves through. The address every limit sees (this one, the sign-in link, password sign-in, the global limit) is the one the nearest of **our own proxies** saw, set by `TRUST_PROXY_HOPS` (default 1): a value the client writes into `X-Forwarded-For` is never used. Before this setting the API trusted the left-most entry, which the client chooses, so every per-address limit could be skipped by changing that header.

## Deploy

1. Run the migrations (`pnpm --filter @figcit/api db:migrate`): `guest_space` adds the two user columns, an index and `guest_signups`; `link_guest_magic_link` adds the enum value. Both are backward compatible: existing users read `is_guest = false`.
2. The settings above have safe defaults; set them only to change the limits. The worker already runs the new job; nothing else to schedule.
3. Set `TRUST_PROXY_HOPS` to the number of proxies in front of the API. Too high lets a client choose the address the limits see; too low makes every visitor look like the proxy. Check it once with two requests from different networks and a spoofed `X-Forwarded-For`.
4. The front end needs `GET /me` and the session to carry `isGuest`, so deploy the API first.

## Not in this version (phase 2)

Linking a Google account, setting a password after linking, a "Where in the UK?" setting for a guest, and merging a guest space into an account that already exists (today the person signs in to the account and the guest space is left behind to expire).

## Things to know

- A guest can reach AI only through the helpers inside tasks and Dump, which fall back to templates and count against the daily allowance; the `/ai` routes and Express assist refuse a guest. The free Express modes (Draft among them) are assist calls, so a guest cannot use them: the drafts editor itself (create, save, versions) works.
- **Linking signs every other session out.** A guest space's access token carries a guest claim, and the guard checks its session and the space's date on every request, so a token issued before the link, or before the date, stops working at once and not when the 15 minutes end. The consequence for the person: if they open the confirmation link on another device or browser than the one the guest space is in, the guest space there is signed out. The app should say so when it asks for the email ("open the link on this device, or sign in again with your email").
- **Why.** Anyone can ask for a link for any address, so the link used to hand the account to whoever held a session of the guest space (the attacker's) once the address's real owner opened it. Now a guest cannot set a password (`POST /auth/password` is 403 `account_required`), the link clears any password, and the owner's session is the only one left.
