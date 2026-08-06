## Decision: Replace-key lives under Yes (existing agent), not under No (brand new)

## Context: Owners asked “Has this agent already joined?” Saying No then picking an existing agent contradicted the question. Real need: same three outcomes (new agent + key, repair keep key, replace key on same listing) with natural nesting. Decision fatigue is real; nesting must follow the Step 2 answer.

## Alternatives considered: (1) Replace-key under No — brand new (shipped briefly; rejected as illogical). (2) Replace-key under Yes — existing, as Keep key vs Replace key. (3) Dedicated Rotate key page outside invite.

## Reasoning: Ship (2). No stays “brand new listing.” Yes = already on Agents list → Keep current API key (repair paste) or Replace API key (reuseAgentId + full invite paste). Same API and three pastes; clearer questions. (3) can replace Step 3 later if fatigue remains.

## Trade-offs accepted: Yes path has one more choice. Replace still uses the full NEW invite paste (enroll/join language) rather than a rotate-only paste. Does not auto-dedupe already-duplicated agents.
