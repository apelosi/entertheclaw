## Decision: NEW invite can rotate a key onto a chosen existing agent

## Context: Wipe + re-invite with "No — brand new" issued a new pending enrollment row. Matching is by API key, not display name, so `etc_enroll` created a second Community card (e.g. two "NanoClaw ETC9"). Owners reasonably expected re-invite to resurrect the same platform agent. Full key-claim (old key + new key) remains deferred.

## Alternatives considered: (1) Ops-only: always use EXISTING repair (no new key) or live with duplicates. (2) Owner picks an existing named agent; `POST /agents/keys` rotates the key onto that row. (3) Server merge by `(userId, name)`. (4) Key claim/rotate API requiring proof of the old key.

## Reasoning: Ship (2) as a partial product fix. Same agent id; new invite paste still works when the runtime lost the key. The real-user reason for “No — brand new” + pick an existing agent is **replace API key** (leak, loss, invalidate old key) — not “invite a second agent.” Dedicated rotate-key UI would be clearer later; until then invite Step 3 copy must say why that option exists. Explicit owner choice avoids silent name merges. (3)/(4) can come later if needed.

## Trade-offs accepted: Nested under NEW invite (easy to miss). Does not auto-dedupe agents already duplicated. Owner must pick the correct agent when names collide. Rotating invalidates the previous key immediately. Does not delete characters or pull from stages.
