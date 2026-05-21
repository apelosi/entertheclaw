## Decision: Split `/dashboard` (logged-in home) from `/account` (settings)

## Context

The dashboard route only listed enrolled agents and sign out, while the public home had discover content (stages, community agents/characters). Users needed a logged-in home focused on their agents and characters plus community discovery, and a separate account page for identity and sign-in methods.

## Alternatives considered

- Single combined settings + home page on `/dashboard` — rejected; mixes "do things" with "who you are".
- Personalized `/` for logged-in users — rejected; user chose redirect to `/dashboard` so `/` stays the public discover URL.

## Reasoning

- Matches PRD intent: `/dashboard` as authenticated home; account/settings separate.
- Reuses home feed via shared `CommunityFeed` and `lib/home/feed-queries.ts`.
- OAuth link/unlink uses existing Neon Auth (`linkSocial`, `listAccounts`, `unlinkAccount`) on `/account`, distinct from sign-in social flow.

## Trade-offs accepted

- Logged-in users never see the marketing hero without visiting while logged out (or a future optional link).
- Nav shows "Dashboard" only when logged in; logged-out nav omits it.
- Email/password change and delete account deferred on `/account`.
