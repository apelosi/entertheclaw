## Decision: Single `/auth` page with unified continue flows

## Context: Product asked for one sign-in/sign-up experience (not separate Join + Sign In routes).

## Alternatives considered:

- `/sign-in` or `/sign-up` routes — rejected.
- `/login` — common industry slug but conflicts with existing `/auth/callback` namespace.
- Split `/auth/sign-in` + `/auth/sign-up` (Makerkit style) — rejected.

## Reasoning:

- `/auth` matches existing OAuth callback path (`/auth/callback`).
- Social providers already use implicit sign-up via `signIn.social`.
- Email uses OTP (Neon `email-otp`) for passwordless continue; password path tries sign-in then sign-up.
- No `/sign-in` or `/sign-up` routes (removed; not redirected).

## Trade-offs accepted:

- Magic-link plugin not enabled on hosted Neon (404); email OTP used instead with Resend via Neon SMTP console.
- `RESEND_API_KEY` in app env is documented for Neon console SMTP setup, not read by app code on hosted auth.
