# Build decisions

Decisions taken during the end-to-end build under the owner's grant of full ownership (`BRIEF.md`). CONFLICTS items resolved here use the item's recommendation unless stated.

| # | Decision | Why |
| --- | --- | --- |
| B-01 | All build work goes on branch `claude/intelligent-ride-vnjnew` in both repos, committed in small steps that name the issue numbers they cover, instead of one PR per issue. | One agent building everything; per-issue PRs would need human approvals the brief says not to wait for. The owner can merge the branch when ready. |
| B-02 | The workflow's "one issue per session" and lane limits don't apply to this build; everything else in the docs does. | The brief says to build across both repos regardless of assignment. |
| B-03 | `events` and `ai_calls` are ordinary tables with time indexes for now; monthly partitioning (rules §5.3) is deferred until volume needs it, because Prisma migrations don't manage partitioned tables. Retention jobs delete by `at`. | Keeps migrations generated and drift-free; the retention job gives the same growth control. |
| B-04 | Field encryption uses one data key per user, wrapped by the master key (the wrapped key's header carries the master-key version). Deleting the user's key crypto-shreds everything they wrote. Ciphertext is bound to the owner's id as AES-GCM associated data. | Meets §9.3 envelope encryption with one key fetch per request and makes account deletion provable. |
| B-05 | In non-production, the repo `.env` overrides inherited environment variables. | The build container inherits a `DATABASE_URL` for an unrelated Neon database; local work must never touch it. |
| B-06 | Codes from the workbook (emotions, sensations, contexts, needs, tools) are stored as short text validated against the published snapshot, not as database enums; structural sets (pathways, lights, timeline codes, statuses) are Postgres enums. | Workbook data changes without a migration (§5.3 "rules as data"); structural sets are part of the engine's code. |
