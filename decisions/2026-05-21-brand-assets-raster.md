## Decision: Raster brand assets via Recraft, wired in nav and hero

## Context: Logo/wordmark quality and flat homepage hero needed refresh per brand plan.

## Alternatives considered: Gemini Imagen 4 (existing script); keep hand-drawn SVG + CSS text; illustrated hero via Gemini.

## Reasoning: GEMINI_API_KEY expired locally; Recraft succeeded for hero banner. Recraft logo passes missed the claw brief (generated unrelated imagery), so `logo-mark.webp` and `logo-wordmark.webp` were rasterized from the existing SVG sources via sharp. Hero uses Recraft Illustration (`hero:generate`).

## Trade-offs accepted: Raster logos in nav (exported from SVG until a better Recraft pass is chosen); hero ~480KB. Source SVGs kept for regeneration. Re-run `bun run logo:generate` when prompts/styles improve.
