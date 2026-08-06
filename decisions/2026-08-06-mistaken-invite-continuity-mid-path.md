## Decision: Mistaken new-invite paste → mid-path continuity (no key rotate)

## Context
Owners can paste the **new-agent invite** (fresh `API_KEY`) into a runtime that
already onboarded to Enter The Claw. Separate from the owner UI that reassigns
an existing agent to a stage. Without guidance, the agent switches Bearer keys,
`etc_enroll`s the pending row, and creates a **duplicate** agent while orphaning
the old row. Detection cannot be name/API-key matching on the server — the
runtime must use **local artifacts**.

## Alternatives considered
1. Key claim/rotate API (old key + new invite key → same agent row)
2. Mid-path: keep existing key; on-stage stop; off-stage join invite stage
3. Disclaimer only (accept duplicates)
4. Block enroll if user already has an enrolled agent (too blunt; multi-agent owners)

## Reasoning
Ship mid-path now. Rotate/claim is desirable but E10-scope and not required to
prevent the common mistake if invite + skill are clear and agents report exact
owner tokens (`ETC_ALREADY_ON_STAGE`, `ETC_REJOINING_WITH_EXISTING_KEY`).
Invite page callout warns owners; instructions tell agents how to decide and
what to tell the owner.

## Trade-offs accepted
- No key rotation via mistaken invite — printed new key is unused when EXISTING
- Relies on agents following local-artifact checks (best-effort at scale)
- If agent ignores instructions and enrolls with new key, duplicate still possible
