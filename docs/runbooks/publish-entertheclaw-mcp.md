# Publish `entertheclaw-mcp` (pulse CLI) to npm

**WHERE:** your Mac (not a Cursor cloud VM — no npm auth there).  
**WHEN:** after the PR that bumps `mcp/package.json` is **merged to `main`**, unless you intentionally publish from a release branch (rare).

This package is **pulse-only**. Hosted MCP deploys with the Next.js app at `{origin}/mcp` — **no npm publish is required for MCP tool changes**.

Agents that ask you to publish must **link this runbook** and fill in the placeholders below — never stop at “publish from your Mac.”

---

## Fill these in (per publish)

| Field | Value |
|-------|--------|
| **Package version** | `{{MCP_VERSION}}` (must match `mcp/package.json` on the branch you publish from) |
| **Git branch** | `{{GIT_BRANCH}}` (almost always `main` after merge) |
| **PR** | `{{PR_URL}}` (optional but preferred) |
| **npm package** | `entertheclaw-mcp` (bin: `entertheclaw-pulse` only) |
| **npm owner account** | `apelosi` |

### Current request (agents: replace this block when asking the owner)

```
Pulse package version:  {{MCP_VERSION}}
Git branch:             {{GIT_BRANCH}}
PR:                     {{PR_URL}}
```

---

## npm auth reality (read first)

Assume you are **not** logged in. You do **not** need a separate `npm login` / `npm whoami` — `npm publish` itself prompts for auth (including the 5-minute session checkbox). Select that checkbox. The publish session is short-lived (about 5 minutes max).

Do all prep (git, build, dry-run) **before** `npm publish` so you can finish the auth prompt and publish without idle time.

---

## Steps (copy-paste on your Mac)

```bash
# ── Prep (no npm auth required) ─────────────────────────────────

cd /path/to/entertheclaw
git fetch origin
git checkout {{GIT_BRANCH}}
git pull origin {{GIT_BRANCH}}

node -p "require('./mcp/package.json').version"
# Expected: {{MCP_VERSION}}

cd mcp
bun install
bun run build

npm publish --dry-run
# Confirm the tarball lists dist/pulse.js + package.json at version {{MCP_VERSION}}
# There should be NO entertheclaw-mcp stdio bin — pulse only.

# ── Publish (auth happens here) ─────────────────────────────────

npm publish
# Select the 5-minute checkbox; sign in as apelosi.

npm view entertheclaw-mcp version
# Expected: {{MCP_VERSION}}
```

---

## After publish

1. **Hosted MCP** already updates on Netlify deploy of the app — invite paste uses `{origin}/mcp`, not this package.
2. **Pulse CLI** pin in invites/skill comes from `lib/agents/mcp-package-version.ts` → `mcp/package.json`. After merge + deploy, new invites show `@{{MCP_VERSION}}` for pulse only.
3. **Optional owner notice:** `bun run notify-owners` (dry-run first) if the fleet must switch MCP config to remote URL — see `AGENTS.md` “Owner email broadcasts”.

---

## Common errors

| Error | Meaning | Fix |
|-------|---------|-----|
| `ENEEDAUTH` | Auth failed or session expired | `npm publish` again; select the **5-minute** checkbox |
| Version already published | Re-publish same version | Bump patch in `mcp/package.json`, merge, republish |
| Cloud agent “please publish” | No npm creds in VM | Always run these steps on your Mac |
