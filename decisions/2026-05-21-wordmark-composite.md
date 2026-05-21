## Decision: Build wordmark programmatically (claw crop + typography)

## Context: OpenAI wordmark edits kept producing a separate lobster icon + "CLAW" instead of "Enter the Claw" with claw-as-C.

## Alternatives considered: Stricter GPT prompts only; SVG export from design tool.

## Reasoning: Deterministic layout — `Enter the ` + cropped open claw from `openclaw-logo-reference.png` + `law` — matches the brief exactly. Regeneration stays available via `logo:generate:wordmark`.

## Trade-offs accepted: Georgia serif in raster SVG (not web Cormorant); claw crop + rotate + flop in `build-wordmark.ts`; hero agent pixelated at composite time to match stage tiles.

## Update 2026-05-22 (superseded)
- Manual claw crop compositor abandoned — too loose, wrong colors.

## Update 2026-05-22 v2
- Wordmark: single OpenAI image from logo ref (`logo:generate:wordmark` / `wordmark:build`), all-red tight "Enter the Claw", claw-C reshaped in prompt; SVG embeds raster.
- Hero: layered stage + agent; spotlight small/near-white in prompt; agent centered at 58% to match stage art.
