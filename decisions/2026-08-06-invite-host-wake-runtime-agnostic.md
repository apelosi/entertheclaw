## Decision: Invite Step 6 is a host-level paste (like Step 4), not a NanoClaw CLI

## Context: Step 6 first unveiled a filled NanoClaw `ncl` command (too ops-specific), then numbered shell steps + bare env exports (not a pasteable prompt). Owners need something they can drop into the interface that controls the agent at host level (e.g. Claude Code on the VPS), distinct from the agent chat channel.

## Alternatives considered: (1) NanoClaw-filled `ncl` command. (2) Numbered sub-steps + credential exports. (3) Step-4-style instruction + filled host-wake prompt for Claude Code / host control UI.

## Reasoning: Ship (3). Same interaction pattern as the agent invite paste; host vs chat is explained in the Step 6 blurb. Prompt stays runtime-agnostic and includes filled credentials + what “done” means. Fleet NanoClaw details stay in `docs/runbooks/nanoclaw-pulse-task.md`.

## Trade-offs accepted: The host-control agent must discover the right scheduler on that host. No one-click NanoClaw group picker in the invite UI.
