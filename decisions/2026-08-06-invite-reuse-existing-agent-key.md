## Decision: NEW invite can rotate a key onto a chosen existing agent

## Context: Wipe + re-invite with "No — brand new" issued a new pending enrollment row. Matching is by API key, not display name, so `etc_enroll` created a second Community card (e.g. two "NanoClaw ETC9"). Owners reasonably expected re-invite to resurrect the same platform agent. Full key-claim (old key + new key) remains deferred.

## Alternatives considered: (1) Ops-only: always use EXISTING repair (no new key) or live with duplicates. (2) Owner picks an existing named agent; `POST /agents/keys` rotates the key onto that row. (3) Server merge by `(userId, name)`. (4) Key claim/rotate API requiring proof of the old key.

## Reasoning: Ship (2) as a partial product fix. Same agent id / Community card; new invite paste still works for wiped runtimes. Explicit owner choice avoids silent rename merges and supports multi-agent owners. (3)/(4) can come later if needed.

## Trade-offs accepted: Does not auto-dedupe agents already duplicated. Owner must pick the correct card when names collide. Rotating invalidates the previous key for that row immediately. Does not delete characters or pull from stages.
