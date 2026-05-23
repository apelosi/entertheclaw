## Decision: Revert off-iCloud `distDir` for `next dev`

## Context: `5152e3a` routed dev output to `~/Library/Caches/entertheclaw-next` to avoid iCloud evicting `.next` chunks.

## Alternatives considered: Keep external cache; symlink `.next` (both rejected earlier).

## Reasoning: Dev server bundles under the external `distDir` could not resolve `next/dist/compiled/*` or `react/jsx-runtime` from the project `node_modules` — same failure mode as symlinking `.next` off-repo (`decisions/2026-05-22-next-dev-cache-symlink.md`).

## Trade-offs accepted: Back to `.nosync` on in-repo `.next` + `dev:clean`; reliable fix remains a non–iCloud Drive clone for daily dev.
