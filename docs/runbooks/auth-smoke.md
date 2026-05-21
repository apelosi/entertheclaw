# Auth smoke runbook

**Date:** 2026-05-20 (unified `/auth`)  
**Environment:** `bun run dev` on `http://localhost:3000` · Neon **dev** branch (`.env.local`)  
**Neon Auth base:** configured via `NEON_AUTH_BASE_URL`

---

## Summary

| Check | Notes |
| --- | --- |
| `/auth` unified UI | GitHub, Google, Continue with Email (OTP), password fallback |
| Nav single CTA | “Sign in / up” → `/auth` |
| Protected invite | Redirect → `/auth?callbackUrl=%2Fagents%2Finvite` |
| Email OTP send | `POST /api/auth/email-otp/send-verification-otp` `{type:"sign-in"}` |
| Email OTP verify | `POST /api/auth/sign-in/email-otp` |
| Email password (unified) | Try `sign-in/email`, then `sign-up/email` on new-user errors |
| OAuth init | `POST /api/auth/sign-in/social` with `disableRedirect: true` |
| OAuth return | `/auth/callback` (popup + full-page) |
| Logged-in `/` | Home (my agents, characters, discover feed) |
| `/account` | Email, linked providers, connect/disconnect GitHub & Google |
| OAuth link (signed in) | `/account` → Connect → `linkSocial` → return `/account` |

---

## Neon console checklist (Phase 3)

Configure in **Neon console → Auth** (not app code for hosted auth):

- [ ] **Allowed redirect URLs** — `http://localhost:3000/**` and production origin
- [ ] **GitHub** + **Google** OAuth client ID/secret
- [ ] **Custom SMTP (Resend)** for production OTP/magic-link email:
  - Host: `smtp.resend.com`
  - Port: `465` (SSL) or `587` (TLS)
  - Username: `resend`
  - Password: your `RESEND_API_KEY` (same value as in Netlify / `.env.local` for reference)
  - Sender: verified domain in Resend (e.g. `Enter The Claw <auth@yourdomain.com>`)
- [ ] **Email OTP** enabled for sign-in (Better Auth plugin on Neon side)
- [ ] **Account linking** — enable linking for `google`, `github`, and email-password where available (same email across providers)
- [ ] Note email verification policy (`emailVerified` on new sign-ups)

---

## Commands

### Route protection

```bash
curl -I http://localhost:3000/agents/invite
# → 307 location: /auth?callbackUrl=%2Fagents%2Finvite
```

### Email OTP

```bash
curl -X POST http://localhost:3000/api/auth/email-otp/send-verification-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","type":"sign-in"}'
# → {"success":true}

curl -c /tmp/etc-cookies.txt -X POST http://localhost:3000/api/auth/sign-in/email-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","otp":"123456"}'
```

### Email password (API)

```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"YourSecurePass!1","name":"test"}'

curl -c /tmp/etc-cookies.txt -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"YourSecurePass!1","callbackURL":"/"}'
```

### OAuth init

```bash
curl -X POST http://localhost:3000/api/auth/sign-in/social \
  -H 'Content-Type: application/json' \
  -d '{"provider":"github","callbackURL":"/","disableRedirect":true}'
```

---

## Manual browser checks

1. Open `/auth` — single page, no sign-in/sign-up toggle.
2. **Continue with GitHub / Google** — complete OAuth, land on `callbackUrl` or home (`/`).
3. **Continue with Email** — receive OTP, enter code, session + redirect.
4. **Use password instead** — new email creates account; existing email signs in.
5. Nav **Sign in / up** from home when logged out.
6. **Enroll an Agent** when logged out → `/auth?callbackUrl=…/invite`.
7. While signed in, visit `/` → logged-in home (no redirect).
8. Nav avatar → `/account` — email visible, verification badge.
9. **Connect GitHub** (or Google) on `/account` when not linked — OAuth completes, provider shows Connected.
10. **Disconnect** a provider when two+ methods exist — unlink succeeds; last method cannot be disconnected (button disabled).
11. **Sign out** from `/account` or nav — session cleared, `/` shows public home.

---

## Known caveats

| ID | Issue |
| --- | --- |
| E1 | OAuth credentials live in Neon console |
| E2 | `emailVerified` policy may block session until verified |
| E3 | `sign-in/magic-link` returns 404 on hosted Neon — app uses **email OTP** instead |
