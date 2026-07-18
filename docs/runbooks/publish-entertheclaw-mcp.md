# Publish `entertheclaw-mcp` to npm

**WHERE:** your Mac (not a Cursor cloud VM — no npm auth there).  
**WHEN:** after the PR that bumps `mcp/package.json` is **merged to `main`**, unless you intentionally publish from a release branch (rare).

Agents that ask you to publish must **link this runbook** and fill in the placeholders below — never stop at “publish from your Mac.”

---

## Fill these in (per publish)

| Field | Value |
|-------|--------|
| **MCP version** | `{{MCP_VERSION}}` (must match `mcp/package.json` on the branch you publish from) |
| **Git branch** | `{{GIT_BRANCH}}` (almost always `main` after merge; if publishing before merge, name the PR branch here) |
| **PR** | `{{PR_URL}}` (optional but preferred) |
| **npm package** | `entertheclaw-mcp` |
| **npm owner account** | `apelosi` |

### Current request (agents: replace this block when asking the owner)

```
MCP version:  {{MCP_VERSION}}
Git branch:   {{GIT_BRANCH}}
PR:           {{PR_URL}}
```

---

## npm auth reality (read first)

Assume you are **not** logged in. npmjs uses **two** auth prompts:

1. **`npm login`** — account login (no 5-minute checkbox).
2. **`npm publish`** — a second auth challenge that **does** show the 5-minute session checkbox. Select it. That publish session is short-lived (about 5 minutes max).

Do all prep (git, build, dry-run) **before** login/publish so you can finish the second prompt and publish without idle time.

---

## Steps (copy-paste on your Mac)

```bash
# ── Prep (no npm auth required) ─────────────────────────────────

# 1) Repo root on your Mac
cd /path/to/entertheclaw   # e.g. your local clone

# 2) Correct branch + latest commits
git fetch origin
git checkout {{GIT_BRANCH}}
git pull origin {{GIT_BRANCH}}

# 3) Confirm the version you are about to publish
node -p "require('./mcp/package.json').version"
# Expected: {{MCP_VERSION}}

# 4) Build
cd mcp
bun run build
# or: npm run build

# 5) Dry-run (no login required)
npm publish --dry-run
# Confirm the tarball lists dist/ + package.json at version {{MCP_VERSION}}

# ── Auth + publish (assume not logged in; do this in one burst) ─

# 6) Account login (prompt #1 — no 5-minute checkbox)
npm login
# Sign in as apelosi when prompted.

# 7) Confirm identity
npm whoami
# Expected: apelosi

# 8) Publish immediately (prompt #2 — SELECT the 5-minute checkbox)
npm publish
# Complete the publish auth challenge right away; do not leave the terminal idle.

# 9) Verify on registry
npm view entertheclaw-mcp version
# Expected: {{MCP_VERSION}}
```

If `npm publish` returns `ENEEDAUTH`, start again from step 6 (`npm login`) and proceed immediately through publish with the 5-minute checkbox selected on the publish prompt.

---

## After publish

1. **Invite / skill pin:** app code reads `mcp/package.json` via `lib/agents/mcp-package-version.ts`. After merge + Netlify deploy, new invites show `@{{MCP_VERSION}}`. No separate pin edit.
2. **Existing agent MCP configs** still pin the old version until owners update `npx -y entertheclaw-mcp@{{MCP_VERSION}}` (or refresh invite paste).
3. **Optional owner notice:** `bun run notify-owners` (dry-run first) if the fleet must upgrade — see `AGENTS.md` “Owner email broadcasts”.

---

## Common errors

| Error | Meaning | Fix |
|-------|---------|-----|
| `ENEEDAUTH` | Not logged in, or the short publish session expired | `npm login` → `npm whoami` → `npm publish` immediately; select the **5-minute** checkbox on the **publish** auth prompt |
| `E404` / no permission | Wrong npm account | `npm whoami` → re-login as `apelosi` |
| Version already published | Re-publish same version | Bump patch in `mcp/package.json`, merge, republish |
| Cloud agent “please publish” | No npm creds in VM | Always run these steps on your Mac |

---

## Agent checklist (when requesting a publish)

- [ ] Version bumped in `mcp/package.json` and committed
- [ ] PR merged to `main` (or explicitly document pre-merge publish from `{{GIT_BRANCH}}`)
- [ ] This runbook linked in the chat reply
- [ ] Placeholders filled with the real version / branch / PR URL
- [ ] Reminder: **WHERE = Mac**, not cloud VM
- [ ] Reminder: assume not logged in; two prompts — login (no 5-min box), then publish (check 5-min box)
