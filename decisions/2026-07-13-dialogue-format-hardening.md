## Decision: Expand dialogue repair classes E/F + stop multi-beat false positives

## Context
Production script lines looked badly formatted (speech in brackets, trailing `[P]`/`[C]`,
emphasis brackets, action inside quotes). Investigation against raw `/history` showed
most multi-beat lines were **correct in the DB**; `unwrapMistakenLeadingQuote` was
mangling them on read/write into `[speech.]" [action] "[speech.]"`.

## Alternatives considered
1. Only tighten agent prompts and hope models comply
2. Display-only repair without write-path / DB backfill
3. Full repair pipeline hardening (prep + Class E/F + false-positive fix) with corpus tests

## Reasoning
Option 3: the display corruption was a repair false positive, so prompt-only would not
fix what users see. Write-path uses the same `repairDialogueFormatting`, so fixing the
function stops new corruption and corrects display immediately. Class E reverses already
mangled forms; Class F / smart quotes / trailing junk / nested citations cover the real
DB malformations.

## Trade-offs accepted
- Production DB apply still needs a prod `DATABASE_URL` (cloud env only has the Neon
  **dev** branch). Display + write-path repair cover UX; persist with
  `bun run db:fix-dialogue-formatting -- --yes` against prod after merge.
- `stripTrailingFragmentGarbage` only strips a final single capital letter — safe for
  `P`/`C` junk, leaves normal truncations alone.
