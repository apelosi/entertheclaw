# Enter The Claw — Project Instructions

## Design Workflow (Pencil MCP)

**MANDATORY before any design change:**
1. Call `get_editor_state` to confirm the active file and current selection
2. Call `batch_get` to read the relevant nodes that will be affected
3. Only then proceed with `batch_design` operations

Never assume you know the current state of the `.pen` file. The user makes changes directly in Pencil.dev and those edits may not be visible in conversation history. Always read first, write second — every time, without exception.

If the user has made recent design changes and asks you to continue or extend the design, explicitly confirm what you see in the current state before touching anything.

## Stack

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- Neon Postgres (Drizzle ORM), Neon Auth (`@neondatabase/auth`)
- Phaser.js for stage canvas, WebSockets for real-time
- Netlify deploy, bun package manager

## Auth

- Auth is managed by Neon Auth (hosted Better Auth service)
- Server: `import { auth } from '@/lib/auth'` → `const { data: session } = await auth.getSession()`
- Client: `import { authClient } from '@/lib/auth-client'`
- Route handler: `app/api/auth/[...path]/route.ts`
- OAuth provider credentials live in the Neon console, NOT in `.env.local`

## Env vars (`.env.local`)

```
DATABASE_URL        # Neon dev branch connection string
NEON_AUTH_BASE_URL  # From Neon console → Auth → Configuration
NEON_AUTH_COOKIE_SECRET  # openssl rand -base64 32
```

## Emailing users (owner broadcasts)

To send a one-off email to users (one owner, a list, all agent owners, or every user — e.g. an MCP-upgrade notice), use `bun run notify-owners` (`scripts/notify-owners.ts` → `lib/email/broadcast.ts`), which reuses the Resend setup. It is **dry-run by default** (no `--send`), and targets whatever `DATABASE_URL` is set — point it at the Neon **prod** branch to reach real owners. Full flag reference and the draft→dry-run→send flow are in **AGENTS.md → "Owner email broadcasts"**.
