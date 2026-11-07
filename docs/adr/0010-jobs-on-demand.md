# 0010: Jobs run on demand, so an idle database can sleep

**Status:** Accepted, 7 November 2026, by Twilight-Techy. Issue #127.

## Context

Production uses Neon because it scales to zero when idle. pg-boss works against that: it polls every queue about every 2 seconds, runs a supervisor and a cron checker, and `reminders.tick` ran every minute. The database never slept, and the free plan's 100 CU-hours would have run out after about 16 days.

## Decision

With `JOBS_ON_DEMAND=true`, the API and the worker share one process and nothing polls:

- **Queued jobs** (speech, exports, explorer runs) go through pg-boss as before, for retries and history, but are fetched as soon as they're sent. A restart picks up whatever was left.
- **Nightly jobs** run from an in-memory clock in London time, which never touches the database.
- **Reminders** wake the database only when one is due. The next time comes from `reminders.next_run_at`, and creating or changing a reminder brings it forward.
- **pg-boss tidying** runs once a night, at 03:05.

Without the setting, local development, CI and any host with a separate worker keep the polling worker.

## Consequences

- An idle API makes no database queries, so Neon can suspend after its 5 minutes. The first request after that waits for the database to wake.
- **One process only.** A job sent by another process isn't noticed until a restart, so this mode can't run with `figcit worker` or more than one instance. Going back to polling is one setting, once a paid database makes it affordable.
- **A nightly job is skipped if the process is down at that minute.** It runs again the next night.
- A long job shares the API's event loop. Staff explorer runs are the heaviest.
