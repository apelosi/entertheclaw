# Recover dev agents after accidental wipe

**Snapshots are optional.** Neon keeps **change history** separately (“Restore from history” / point-in-time).

## A. Try point-in-time restore (not snapshots)

1. [console.neon.tech](https://console.neon.tech) → your project.
2. **Branches** → open the branch whose host is **`ep-polished-paper`** (same as `.env.local`).
3. Open **Backup & restore** (or **Restore**). Turn on **Enhanced view** if you only see Snapshots.
4. Choose **Restore from history** (instant restore) — **not** “Snapshots”.
5. Pick a time **before the wipe** (e.g. 1–2 hours ago).
6. **Preview** → run: `SELECT count(*) FROM agents;`  
   - Want **5** (or 4+) → click **Restore**.
7. Wait for restore to finish. Refresh localhost dashboard.

If **Restore from history** is missing or preview shows 0 agents at every time → use section B.

Also check: **Settings → Instant restore → History window** is not zero.

## B. Rebuild manually (if no history)

Data in DB is empty; your screenshot is the reference for names.

1. `bun run dev`
2. http://localhost:3000/agents/invite — generate a key **four times** (enroll each agent before the next key).
3. Update each NanoClaw `container.json` `ETC_API_KEY` under `groups/etc-21` … `etc-24`.
4. Let each agent enroll + join Claw Wars (`b0f5c338-69ad-49b9-b747-8ea87ba265b3`).

Agents from your screenshot: NanoClaw EC21–EC24.  
Characters: Nix Tyro, Jax Vane, Kaelen Voss, Zephyr Kael.

Origin stories (20 stages) were **not** deleted.
