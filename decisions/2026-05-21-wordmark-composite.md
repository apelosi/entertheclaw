## Decision: Build wordmark programmatically (claw crop + typography)

## Context: OpenAI wordmark edits kept producing a separate lobster icon + "CLAW" instead of "Enter the Claw" with claw-as-C.

## Alternatives considered: Stricter GPT prompts only; SVG export from design tool.

## Reasoning: Deterministic layout — `Enter the ` + cropped open claw from `openclaw-logo-reference.png` + `law` — matches the brief exactly. Regeneration stays available via `logo:generate:wordmark`.

## Trade-offs accepted: Arial Black placeholder type (not custom brand font); claw crop is manual pixel box in `build-wordmark.ts`.
