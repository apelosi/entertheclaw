## Decision: OpenClaw brand assets via gpt-image-1 (Recraft fallback)

## Context: Recraft 8-bit assets did not match OpenClaw reference; hero agent had white box background.

## Alternatives considered: Recraft-only; manual ChatGPT upload only; SVG re-export.

## Reasoning: Primary path uses OpenAI `gpt-image-1` with `background: transparent` and optional `images.edit` from `public/brand/openclaw-reference.png`. Hero stays 8-bit stage (Recraft) + separate character PNG composited with alpha. When `OPENAI_API_KEY` is unset, scripts use Recraft Illustration + `whiteToAlpha` fallback.

## Trade-offs accepted: Recraft fallback when keys missing. Cartoon lobster on 8-bit stage is intentional.

## Update 2026-05-21 (v3)

- Removed "cartoon" from prompts (distorted mascot style).
- Reference images: `public/brand/openclaw-logo-reference.png`, `public/brand/openclaw-wordmark-reference.png` (user-provided OpenClaw assets).
- OpenAI `gpt-image-1` `images.edit` with `input_fidelity: high` and correct reference per asset; Gemini `editImage` + `SubjectReferenceImage` as fallback.

## ChatGPT prompts (attach `public/brand/openclaw-reference.png` each time)

### A) logo-mark (1024×1024, transparent)

```
Match the attached OpenClaw lobster mascot. App icon / logo mark: a cartoon bright red lobster with thick black outlines and white highlight shine, antennae, confident smirk, segmented body. Pose: theatrically reciting Shakespeare — one large open claw raised in a dramatic soliloquy gesture, other claw at chest, actor stance. No text, no words, no speech bubbles, no captions. Transparent background (alpha), not white, not a checkerboard. Centered, readable at 32px. No robot, no pixel art, no generic crab silhouette, no emblem circle border.
```

### B) logo-wordmark (1536×1024, transparent)

```
Match the attached OpenClaw claw style. Horizontal wordmark on transparent background. Text must read exactly: "Enter the Claw" (title case). Chunky bold sans-serif for "Enter the " and "law" in near-black. The letter C in "Claw" is entirely replaced by an OpenClaw-style cartoon lobster open claw (bright red #C41E3A, thick black outline) shaped like the letter C; pincers form the C curve and connect naturally to "law". Single integrated typographic lockup — NOT a separate lobster icon beside the text, NOT a vertical separator. No stage, no scenery, no photorealism.
```

### C) hero-agent (1024×1024, transparent)

```
Match the attached OpenClaw lobster mascot exactly, but larger and more detailed than an app icon — same bright red cartoon lobster, thick black outlines, white highlights, antennae, smirk, segmented body, large open claws. Full-body theatrical Shakespeare performance pose: one claw raised dramatically delivering a soliloquy, other claw at chest, subtle actor posture. No text, no words, no captions. Transparent background only — no white box, no stage, no curtains, no spotlight, no pixel art robot.
```

### D) hero-stage (Recraft / separate; empty spotlight)

```
8-bit pixel art theatrical stage interior, wide 2:1 composition, retro RPG style. Pixelated red velvet curtains, wooden stage floor, deep shadows. Single crimson spotlight cone on center stage — EMPTY, no characters, no animals, no robots. Left third darker and simpler for text overlay. Palette: near-black #080808, crimson #C41E3A. No text, no logos.
```

## CLI

```bash
# Add OPENAI_API_KEY to .env.local for GPT images
bun run brand:generate:openai
# Or stepwise:
bun run logo:generate:mark
bun run logo:generate:wordmark
bun run hero:generate:stage
bun run hero:generate:agent
bun run hero:composite
bun run favicon:generate
```
