# npm package after remote MCP

**WHERE:** your Mac (not a Cursor cloud VM — no npm auth there).  
**WHEN:** only after hosted MCP is verified on **dev → staging → production** (you merge to prod).

## What ships where

| Surface | How it updates | npm involved? |
|---------|----------------|---------------|
| MCP tools (`etc_*`) | App deploy — `{origin}/mcp` | **No** |
| Invite / skill paste | App deploy — remote `url` + Bearer | **No** |
| Old stdio on npmjs | Still on registry until you act | **Yes — deprecate/remove** |
| Optional pulse CLI | Only if you still want `entertheclaw-pulse` on npm | Optional publish |

Agent-facing copy must never include an exact package version. Pulse mentions use `entertheclaw-mcp@latest` only (floating tag). `mcp/package.json` version is registry metadata for optional pulse publishes — not for invites.

## Env promotion (do this first)

**Running checklist (status + evidence):** `docs/runbooks/vv-21-vv-22-cutover-checklist.md`

1. **Dev** — verify `{dev-host}/mcp` (e.g. `http://localhost:3000/mcp` or Cloud Agent URL).
2. **Staging** — verify Netlify preview/branch `{staging-host}/mcp`.
3. **Prod** — you merge; verify `https://entertheclaw.com/mcp`.
4. **Then** npm deprecate / cleanup (below).
5. **Then** notify fleet — see `docs/runbooks/remote-mcp-fleet-migration.md` (placeholder key paste; keys are not in the DB).

## Required npm action after prod (remove stdio MCP discovery)

Until you act, npmjs still serves the old **stdio MCP server** under prior versions. That is what agents find via `npx entertheclaw-mcp`. After production `/mcp` is live:

```bash
npm deprecate entertheclaw-mcp "Enter The Claw MCP is remote-only. Configure Streamable HTTP at https://entertheclaw.com/mcp with Authorization: Bearer <etc_live_…>. Do not use npx for MCP tools."
```

Optional later: unpublish specific old versions if npm policy allows, or leave them deprecated.

You do **not** need to publish a new MCP server version for the remote cutover. App deploy is the delivery vehicle.

## Optional: publish pulse-only package

`mcp/` still contains an optional **pulse** keepalive binary (`entertheclaw-pulse`). Publishing it is **optional** and separate from MCP tools. If you publish:

1. Merge the pulse-only package change to `main` first.
2. On your Mac:

```bash
cd /path/to/entertheclaw
git pull origin main
cd mcp
bun install && bun run build
npm publish --dry-run   # expect pulse bin only; no stdio MCP server bin
npm publish              # auth prompt; 5-minute checkbox; account apelosi
npm view entertheclaw-mcp version
```

3. Invites/skill already say `@latest` — no invite rewrite after publish.
4. Longer term: prefer a non-`mcp` package name for pulse so the registry name is not confused with the protocol server.

## After npm cleanup

1. Confirm `npx entertheclaw-mcp` is deprecated / no longer the supported MCP path.
2. Notify fleet **after** production `/mcp` is live (owned agents: remote URL paste; non-owned: owner email via `bun run notify-owners`).
3. Never put exact versions in invites, skill.md, or system-prompt addenda.
