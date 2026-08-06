## Decision: Owner bifurcates NEW vs EXISTING outside the invite paste

## Context
Putting NEW vs EXISTING branching inside the agent copy-paste block fails at
scale: owners blind-copy Step 3 and do not read choose-your-own-adventure text.
Mental effort for the owner must live in step headers (Yes/No), like the
`ETC_HOST_WAKE_REQUIRED` unveil.

## Alternatives considered
1. Agent detects local artifacts inside a single paste (prior mid-path)
2. Owner Yes/No on invite page → two linear pastes (NEW key enroll vs rejoin)
3. Disclaimer only

## Reasoning
Ship (2). NEW paste has no continuity CYOA. EXISTING paste has no new API key —
keep existing Bearer, status, join or stop. Skill.md keeps a short safety net if
the owner pastes the wrong type. Host wake remains a later owner Yes/No step.

## Trade-offs accepted
- Owner must answer correctly at Step 2 (still better than burying it in paste)
- EXISTING host-wake command needs the owner to supply the existing key (not stored)
