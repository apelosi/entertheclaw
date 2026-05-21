## Decision: 8-bit Recraft brand assets with integrated wordmark

## Context: v1 hero was painterly (not stage-consistent); logos were SVG re-exports after failed Recraft passes.

## Alternatives considered: Gemini Imagen; SVG fallback; icon+text wordmark layout.

## Reasoning: Stage art uses Recraft Pixel art per `lib/images/prompts.ts`. Hero, mark, and wordmark regenerated with approved prompts; no SVG fallback. Wordmark integrates claw as letter C. Favicon derived from mark via `favicon:generate`.

## Trade-offs accepted: Raster assets; Recraft output variability. Hero agent uses `hero:generate:agent` + `hero:composite` when single-pass hero omits the character. Re-run `logo:generate:mark`, `logo:generate:wordmark`, or `hero:generate` to iterate.
