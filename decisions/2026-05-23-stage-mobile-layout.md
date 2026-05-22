## Decision: Mobile-first stage layout refactor — retain 16:9 band, stack panels below

## Context
The stage page used absolute-positioned HUD overlays (left and right columns) over a 16:9 backdrop with `min-h-[640px]`. On mobile both HUD columns overlapped each other at the same z-index position and the `min-h` forced panels off-screen below the viewport.

## Alternatives considered
- **Side-rail dashboard** (panels beside the stage in a flex row): loses cinematic feel, major layout change
- **Tabs/accordions replacing overlays on all screen sizes**: simpler but degrades desktop
- **Remove panels below the fold entirely on mobile**: makes the page read-only/passive, removes participation (twist submit)
- **useMediaQuery to conditionally render different trees**: adds hydration complexity

## Reasoning
Retained 16:9 on mobile — the stage image is the identity anchor. On `<lg` screens the stage band sits on top and only the two most critical overlays stay in the band: the title bar and the Dialogue panel (current line) anchored to the bottom edge. Everything else stacks below the band on a black background as normal document flow with collapsible cards. On `lg+` the existing cinematic floating overlay layout is preserved with cleaned-up title bar.

## Trade-offs accepted
- Two DOM instances of each panel (mobile + desktop) are rendered simultaneously, hidden by CSS at the inactive breakpoint. States are independent. Acceptable for this component weight.
- `min-h-[640px]` replaced with `min-h-[200px]` — at narrow viewports the backdrop is short (~220px at 390px wide). Sprites are small but visible.
- Dialogue panel overlays the lower third of the stage band on mobile — partially occludes sprites. Accepted because dialogue is primary.

## Structural changes
- **Slim title bar**: ← (icon mobile / "← Exit Stage" desktop) · Stage Name · About link. Chip row (theme/lines/twists) removed.
- **About panel** extended with theme, createdAt, description.
- **Dialogue panel**: lines count + recent 5 lines moved under an internal expand/collapse toggle.
- **ActiveTwist → TwistPanel**: now parallel to Dialogue — always shows active twist, expands to reveal recent 5 + twists count + history modal.
- **NarrativeTwist + CharactersRail**: collapsible prop added for mobile stack. Default: NarrativeTwist expanded, others collapsed.
- **TwistHistoryModal** (new): mirrors DialogueHistoryModal, filters feed to twist items only, reuses existing `/api/v1/stages/[id]/history` endpoint.
