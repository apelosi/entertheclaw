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

**WHERE:** any folder on your Mac — you do **not** need the git repo, `main`, or a feature branch.  
`npm deprecate` talks to the npm registry as the logged-in package owner (`apelosi`).  
**WHY:** npmjs still serves the old stdio server; agents must stop discovering it via `npx`.

Exact steps:

1. Open **Terminal** on your Mac.
2. You can stay in `~` (home). No `cd` into entertheclaw required.
3. Confirm you can act as the package owner (optional but useful):

```bash
npm whoami
# Expected: apelosi
```

If that fails or says you’re not logged in:

```bash
npm login
# Use the apelosi npm account; complete the browser/OTP prompt
npm whoami
# Expected: apelosi
```

4. Deprecate every version of the package (one command):

```bash
npm deprecate entertheclaw-mcp "Enter The Claw MCP is remote-only. Configure Streamable HTTP at https://entertheclaw.com/mcp with Authorization: Bearer <etc_live_…>. Do not use npx for MCP tools."
```

5. Verify:

```bash
npm view entertheclaw-mcp deprecated
```

You should see the deprecation message string.

**Do not** `cd mcp`, **do not** `npm publish`, **do not** checkout a branch for this step.

**You are done with Step 1 when:** `npm view entertheclaw-mcp deprecated` prints the message above.

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

**Owner:** cloud agent (not you), unless Resend fails.  
**Prod agent id:** `dbfba74c-38e4-49c0-a9a2-282bffde9633`  
**Body:** `docs/notices/zain-mcp-migration-v2.txt`  
**Status:** v2 **sent** 2026-08-05 (~11:24 UTC) after Tony approval. (v1 was incomplete — ignore.)

Agent runs dry-run then `--send` against production (`NEON_DATABASE_URL_PRODUCTION` → `DATABASE_URL`) + `RESEND_API_KEY`.

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
