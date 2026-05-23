## Decision: `next dev` uses relative `distDir` under `~/Library/Caches/entertheclaw-next`

## Context: Repeated `Cannot find module './8548.js'` / missing vendor-chunks on iCloud Drive despite `.nosync` on `.next`.

## Alternatives considered: Symlink `.next` → cache (rejected: breaks `node_modules` resolution); `.nosync` only (insufficient); move repo off iCloud (best long-term, not always practical).

## Reasoning: Next accepts a **relative** `distDir` outside the repo tree (`../../../../../Caches/entertheclaw-next` from this clone). Dev output no longer lives on Drive, so iCloud cannot evict webpack chunks mid-compile. `next build` keeps default `.next` for deploy parity.

## Trade-offs accepted: Path is clone-location-specific (recomputed via `path.relative`); opt-out via `ENTERTHECLAW_LOCAL_NEXT_CACHE=0`; stale cache cleared with `bun run dev:clean`.
