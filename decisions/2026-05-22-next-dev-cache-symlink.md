## Decision: Keep `.next` inside the repo (do not symlink to `~/.cache`)

## Context: Repeated iCloud-related chunk/CSS 404s; considered moving dev output off iCloud.

## Alternatives considered: Symlink `.next` → `~/.cache/entertheclaw/.next`; custom `distDir` outside project; move repo off iCloud.

## Reasoning: Symlinking or building into `~/.cache` breaks Next/webpack server bundle resolution (`MODULE_NOT_FOUND` for `next-server`, `react/jsx-runtime`) because requires are emitted relative to the cache path, not the project `node_modules`.

## Trade-offs accepted: Continue `.nosync` + `dev:clean` when corrupted; long-term fix is a non–iCloud Drive clone for daily dev if errors persist.
