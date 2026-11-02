# 0005: Exceptions to the engineering rules that engine v2 needs

- **Status:** Accepted (2 Nov 2026), on the engine v2 branch. ENGINEERING_RULES §15 asks for an ADR before merge.
- **Decided by:** the Owner's rulings recorded in `docs/engine-v2/DECISION_LOG.md` (E-10, E-23, E-57). This record lists them in one place, with their costs.
- **Scope:** `packages/engine-v2`, the rule store (`apps/api/src/modules/rulesets`) and the decision records (`apps/api/src/modules/decisions`). The v1 engine is unchanged and keeps its own rules until it is removed (T-17).

## Context

Engine v2 runs the rules workbook as data, stored row by row in a versioned rule store (`docs/engine-v2/DESIGN.md`). A few engineering rules were written for v1, which compiled one snapshot and was tested against the workbook's example tabs. Where v2 can't follow such a rule, §15 needs a written exception that names the rule, says why, states the cost and says when to revisit.

No safety or privacy rule (§0.1, §0.2, §10, the first two bullets of §11.1) is excepted. Those have no exceptions.

## Decision

| Rule | What engine v2 does instead | Why | Cost | Revisit |
|---|---|---|---|---|
| §13 Engine fixtures: "every scenario row in Tabs 0, 0b, 6d, 9 and 10 passes" | The example tabs are stored as read-only reference and never run. The tests are written from the rule tabs. The publish checks (8 fixed rules on a 3,468-input sweep) and the explorer's all-flows set (pairwise at every threshold edge) stand in for a regression oracle | The Owner's ruling (E-10, ADR 0004 §1 as amended): the rules decide, and the examples disagree with them in places | No example-based oracle. A behaviour change shows up only through the publish checks, the explorer and the daily replay | When the Owner wants the examples back |
| §5.3 "JSONB only for the trace, snapshot, card payloads and event properties" | Rule records keep the workbook's columns and the engine's columns as JSONB. Versions keep their table frames, import report and checks as JSONB. An explorer run keeps its request and result as JSONB | The rule set is the snapshot, split into rows so one row can be edited at a time (E-12). These are read whole and never filtered or joined on | None measured: the engine loads a whole version at once, and explorer results are kept 7 days | If row-level queries are needed |
| §13 Engine properties "with `fast-check`" | The properties (re-run identical, Red never task-first, risk always the support screen, no Advanced tool in Amber or Red, Red keeps "Get support now", at most two alternatives with no repeats) run over 3,000 seeded random valid inputs from the explorer's own generator (`test/properties.test.ts`) | The generator already draws every input fact at the values the rules tell apart, and the seed makes a failure repeatable. It avoids a new dependency for the same check | No shrinking of a failing input to a minimal one | If a property failure is hard to read |
| §13 Engine coverage "100% lines and branches" | 95% lines, 90% branches, 95% functions and statements (the same thresholds as v1's configuration). Measured 2 Nov 2026: 97.9% lines, 90.2% branches | Most uncovered branches are defensive (an unknown band, a missing catalogue value) on paths the format check already refuses | A rare defensive path may be untested | Before launch, with the remaining branch tests |

These rules are **met**, not excepted. They are listed because earlier drafts thought they wouldn't be:

- **§1.3, a recommendation including its trace is under 4 KB.** A decision record keeps the input, the card and the light trace (the rules that fired). The full trace is rebuilt by replay when staff open the record (E-21, E-57). It is tested to stay under 4 KB.
- **§1.1, the engine budget (p50 < 0.5 ms, p95 < 2 ms, p99 < 5 ms).** `test/budget.test.ts` measures it over the all-flows set: p50 0.31 ms, p95 0.97 ms, p99 3.9 ms on the 2-core development host.
- **§6, CPU-heavy work leaves the event loop.** The explorer (up to 30,000 inputs, about 15 s) runs as a pg-boss job in the worker, not in the API request (E-57).

## Consequences

- A reviewer checks a v2 change against this table instead of the rules above.
- Each row is revisited at the time it gives, or before launch at the latest (`docs/engine-v2/TODO.md`).
- A new exception is added here, never only in a pull request.
