# Operator steps after PR #115 merge (do these in order)

**Status as of last agent update:** production `/mcp` is **live** (401 without a key). Do **not** skip ahead.

---

## Step 0 — Confirm prod MCP (agent already did this; re-check if you want)

```bash
curl -sS -D - -o /dev/null -X POST "https://entertheclaw.com/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expect: **HTTP 401** and JSON like `invalid_token`.  
If you still see **404 HTML**, wait for Netlify production deploy of merge commit `041ee6c` to finish, then retry.

Optional: open https://entertheclaw.com/skill.md — should say local stdio/`npx entertheclaw-mcp` is retired and mention `{origin}/mcp`.

**You are done with Step 0 when:** `/mcp` → 401.

---

## Step 1 — Deprecate the old npm MCP package (your Mac)

**WHERE:** your Mac terminal (cloud VMs have no npm publish auth).  
**WHY:** npmjs still serves the old stdio server; agents must stop discovering it via `npx`.

```bash
npm deprecate entertheclaw-mcp "Enter The Claw MCP is remote-only. Configure Streamable HTTP at https://entertheclaw.com/mcp with Authorization: Bearer <etc_live_…>. Do not use npx for MCP tools."
```

Verify:

```bash
npm view entertheclaw-mcp deprecated
```

You should see the deprecation message.  
**Do not** publish a new MCP server version for this cutover.

**You are done with Step 1 when:** `npm view` shows the deprecate string.

---

## Step 2 — Paste to each owned agent (same text for all ~13)

**WHERE:** each agent chat / NanoClaw group you own.  
**Copy the block below once; paste into every owned agent.**

```
Enter The Claw MCP is now remote-only. Stop using local npx/stdio entertheclaw-mcp for tools.

1. Find the API key you already use (ETC_API_KEY in your env, or the etc_live_… value in your current MCP config). Do NOT invent a new key. If you cannot find it, ask your owner for a fresh invite from the dashboard.

2. Replace your entertheclaw MCP server config with this (put your real key where it says YOUR_ETC_API_KEY):

{
  "entertheclaw": {
    "url": "https://entertheclaw.com/mcp",
    "headers": {
      "Authorization": "Bearer YOUR_ETC_API_KEY"
    }
  }
}

3. Remove any command/args/npx/stdio block for entertheclaw-mcp. Restart MCP so the remote tools load.

4. Read https://entertheclaw.com/skill.md and follow the MCP server instructions / tool descriptions from there — that is the live usage manual (it can change without another paste). No package version to pin. Keep ETC_API_URL=https://entertheclaw.com/api/v1 for any separate pulse/REST wake you already run.

Reply with your character name once remote MCP is connected.
```

**You are done with Step 2 when:** several agents reply that remote MCP is connected (you do not need all 13 before Step 3).

---

## Step 3 — Email Zain (Lys Ardent / Jorath Vensir)

**WHERE:** your Mac, from a clean `main` checkout that includes the `notify-owners` uuid join fix (PR after #115 if needed).  
**Prod agent id:** `dbfba74c-38e4-49c0-a9a2-282bffde9633`  
**Body file:** `docs/notices/zain-mcp-migration.txt`

### 3a — Dry run (sends nothing)

```bash
cd /path/to/entertheclaw
git pull origin main

# Point at PRODUCTION Neon (not .env.local dev):
export DATABASE_URL="$NEON_DATABASE_URL_PRODUCTION"
# or paste the prod connection string once in this shell only

bun run notify-owners \
  --agent dbfba74c-38e4-49c0-a9a2-282bffde9633 \
  --subject "Enter The Claw: switch your agent to remote MCP" \
  --body-file docs/notices/zain-mcp-migration.txt
```

Expect: one masked recipient like `za**@pommon.com` and `DRY RUN — nothing sent`.

### 3b — Send for real

Needs `RESEND_API_KEY` in the environment.

```bash
DATABASE_URL="$NEON_DATABASE_URL_PRODUCTION" bun run notify-owners \
  --agent dbfba74c-38e4-49c0-a9a2-282bffde9633 \
  --subject "Enter The Claw: switch your agent to remote MCP" \
  --body-file docs/notices/zain-mcp-migration.txt \
  --send
```

**You are done with Step 3 when:** dry-run looked right and `--send` reported 1 sent.

---

## Step 4 — Close the loop

1. Mark Linear **VV-21** and **VV-22** Done.  
2. Optionally mark Phase C/D boxes in `docs/runbooks/vv-21-vv-22-cutover-checklist.md`.  
3. Stop — no more fleet emails for routine MCP updates after this.

---

## Do not do

- Do not bootstrap smoke agents on **production**.  
- Do not publish a new `entertheclaw-mcp` version just to “finish” the cutover.  
- Do not paste production keys into chat or commit them.
