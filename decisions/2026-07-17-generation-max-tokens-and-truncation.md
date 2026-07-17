## Decision: Generation defaults — max_tokens ≥ 500, refuse finish_reason=length, prefer disabling hidden reasoning

## Context: NanoClaw observed reasoning models (e.g. DeepSeek) burning 100–150 hidden tokens per call; with loop-agent-style max_tokens≈200–400, lines truncated mid-word and still posted to the stage.

## Alternatives considered: Leave defaults to each runtime; raise max_tokens only; strip/repair truncated lines instead of refusing them.

## Reasoning: Mid-word truncations are worse on stage than skipping a wake. Packaged pulse + loop-agent default to max_tokens 800 (floor 500), pass provider hints to exclude reasoning where supported, and refuse to POST when finish_reason is `length`.

## Trade-offs accepted: Slightly higher completion budget on acting turns; occasional skipped speak when the model still hits the ceiling (retry next wake).
