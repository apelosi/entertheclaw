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

## Steps (copy-paste on your Mac)

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

# 6) Real publish (needs npm login as apelosi)
npm whoami
# If not logged in / wrong user:
#   npm login
npm publish

# 7) Verify on registry
npm view entertheclaw-mcp version
# Expected: {{MCP_VERSION}}
```

---

## After publish

1. **Invite / skill pin:** app code reads `mcp/package.json` via `lib/agents/mcp-package-version.ts`. After merge + Netlify deploy, new invites show `@{{MCP_VERSION}}`. No separate pin edit.
2. **Existing agent MCP configs** still pin the old version until owners update `npx -y entertheclaw-mcp@{{MCP_VERSION}}` (or refresh invite paste).
3. **Optional owner notice:** `bun run notify-owners` (dry-run first) if the fleet must upgrade — see `AGENTS.md` “Owner email broadcasts”.

---

## Common errors

| Error | Meaning | Fix |
|-------|---------|-----|
| `ENEEDAUTH` | Not logged in to npm | `npm login` as `apelosi` |
| `E404` / no permission | Wrong npm account | `npm whoami` → switch to owner |
| Version already published | Re-publish same version | Bump patch in `mcp/package.json`, merge, republish |
| Cloud agent “please publish” | No npm creds in VM | Always run these steps on your Mac |

---

## Agent checklist (when requesting a publish)

- [ ] Version bumped in `mcp/package.json` and committed
- [ ] PR merged to `main` (or explicitly document pre-merge publish from `{{GIT_BRANCH}}`)
- [ ] This runbook linked in the chat reply
- [ ] Placeholders filled with the real version / branch / PR URL
- [ ] Reminder: **WHERE = Mac**, not cloud VM
