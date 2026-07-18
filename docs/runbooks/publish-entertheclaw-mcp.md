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

npmjs auth sessions are **very short-lived**. By default they expire in **under 5 minutes**. You can opt in to a **5-minute** session via a checkbox at login — that is the maximum practical window for this account flow.

Implications:

- **Do all non-auth work first** (git pull, version check, build, dry-run).
- **Login (if needed) immediately before `npm publish`** — do not pause between auth and publish.
- Assume you are **not** logged in unless you deliberately authenticated within the last ~5 minutes **with the 5-minute checkbox selected**.

---

## Steps (copy-paste on your Mac)

### A. Prep (no npm auth required)

```bash
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
```

Stop here until you are ready to authenticate and publish in one uninterrupted burst.

### B. Publish — pick one auth path

#### Path 1 — Default: not logged in (use this unless you just logged in)

Use when `npm whoami` fails, says you’re not authenticated, or you have not logged in in the last few minutes.

```bash
cd /path/to/entertheclaw/mcp

# 1) Authenticate as apelosi NOW (browser / device flow).
#    At the npmjs prompt, SELECT the checkbox for the 5-minute session
#    (otherwise the window is even shorter).
npm login

# 2) Immediately confirm identity — do not leave the terminal idle.
npm whoami
# Expected: apelosi

# 3) Publish immediately (same breath as login — session may die in <5 min).
npm publish

# 4) Verify on registry (does not require a live publish session)
npm view entertheclaw-mcp version
# Expected: {{MCP_VERSION}}
```

If `npm publish` returns `ENEEDAUTH` after login, the session already expired — run **Path 1 from `npm login` again** with no delay before `npm publish`.

#### Path 2 — Already logged in (only if you opted into 5 min within the last ~5 minutes)

Use **only** when you just completed `npm login` (or equivalent) **with the 5-minute checkbox selected** and have not waited around since then.

```bash
cd /path/to/entertheclaw/mcp

# 1) Confirm the short-lived session is still alive
npm whoami
# Expected: apelosi
# If this fails or is wrong → abandon Path 2, use Path 1 immediately.

# 2) Publish immediately (no slack — session dies fast)
npm publish

# 3) Verify on registry
npm view entertheclaw-mcp version
# Expected: {{MCP_VERSION}}
```

Do **not** use Path 2 if you’re unsure whether the 5-minute checkbox was selected, or if more than a couple of minutes have passed since login. Prefer Path 1.

---

## After publish

1. **Invite / skill pin:** app code reads `mcp/package.json` via `lib/agents/mcp-package-version.ts`. After merge + Netlify deploy, new invites show `@{{MCP_VERSION}}`. No separate pin edit.
2. **Existing agent MCP configs** still pin the old version until owners update `npx -y entertheclaw-mcp@{{MCP_VERSION}}` (or refresh invite paste).
3. **Optional owner notice:** `bun run notify-owners` (dry-run first) if the fleet must upgrade — see `AGENTS.md` “Owner email broadcasts”.

---

## Common errors

| Error | Meaning | Fix |
|-------|---------|-----|
| `ENEEDAUTH` | Not logged in, or the short npm session already expired | Path 1: `npm login` (check **5-minute** box) → `npm whoami` → `npm publish` with no pause |
| `E404` / no permission | Wrong npm account | `npm whoami` → Path 1 as `apelosi` |
| Version already published | Re-publish same version | Bump patch in `mcp/package.json`, merge, republish |
| Cloud agent “please publish” | No npm creds in VM | Always run these steps on your Mac |
| Login worked, publish failed auth | Session shorter than the gap after login | Re-login with 5-min checkbox, publish immediately |

---

## Agent checklist (when requesting a publish)

- [ ] Version bumped in `mcp/package.json` and committed
- [ ] PR merged to `main` (or explicitly document pre-merge publish from `{{GIT_BRANCH}}`)
- [ ] This runbook linked in the chat reply
- [ ] Placeholders filled with the real version / branch / PR URL
- [ ] Reminder: **WHERE = Mac**, not cloud VM
- [ ] Reminder: prep first, then Path 1 (default) or Path 2 (only if 5-min login is still live)
