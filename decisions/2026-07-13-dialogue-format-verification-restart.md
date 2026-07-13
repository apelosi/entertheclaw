## Decision: Continue dialogue format verification with user-report tests + Mac dry-run gate

## Context
User reported many Script formatting issues still visible and correctly rejected the
claim that DB history was fixed — no Mac dry-run → verify → `--yes` cycle had run.
Investigation against prod showed most Class-E-looking multi-beat lines are **already
correct in the DB**; earlier display corruption came from a false-positive repair
(fixed on this branch). Remaining real gaps: Class E triple-quote variant, Class C
over-bracketing spoken tails, thinner MCP/addendum copy, and unrepaired DB rows that
still need a careful backfill.

## Alternatives considered
1. Claim read-path repair is enough and skip DB backfill
2. Auto-apply `--yes` against prod from the cloud agent
3. Harden repair + agent instructions with failing user-report tests, then Mac dry-run gate

## Reasoning
Option 3. User trust requires: (a) exact reported lines as tests, (b) skill/directive/MCP
rules covering every anti-pattern, (c) dry-run export reviewed before any write.
Cloud agent must not `--yes` prod writes.

## Trade-offs accepted
- Read-path repair makes localhost Script look better before DB backfill; agents still
  need write-path + eventual DB apply so history/API raw content matches.
- Class C spoken-vs-direction heuristic is imperfect; corpus + user-report tests gate it.
