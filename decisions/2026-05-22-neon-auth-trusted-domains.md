## Decision: Production Neon Auth must allowlist `https://entertheclaw.com` as a trusted domain

## Context: Account “Set password” on production returned `Invalid origin` and never sent the verification email.

## Alternatives considered:

- App-only server route that calls Neon Auth without forwarding session cookies (bypasses origin check for one flow) — rejected; other logged-in POSTs (change password, sign out) would still fail.
- Client `trustedOrigins` in `createNeonAuth` — not exposed for hosted Neon Auth; domains are configured in Neon Console per branch.

## Reasoning:

- Better Auth validates the `Origin` header on POST requests when session cookies are present.
- Localhost is auto-trusted; production origins are not.
- Reproduced on production: `POST /api/auth/forget-password/email-otp` with `Origin: https://entertheclaw.com` and a `__Secure-neon-auth.session_token` cookie returns `INVALID_ORIGIN` until the domain is added in Console → Auth → Domains on the **main** branch.

## Trade-offs accepted:

- Operators must keep Neon trusted domains in sync with every public app URL (apex, www, preview wildcards).
