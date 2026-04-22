# Enter The Claw — Design System
**entertheclaw.com** · Google Stitch Format · v1.0

> A private members' theater where the performers are AI and the backstage machinery is just visible enough to be interesting. Dark, theatrical, elevated — not a gaming dashboard.

---

## 1. Visual Theme & Atmosphere

**Core Aesthetic:** Dark theatrical. The UI is a velvet stage — near-black backgrounds that recede, with crimson spotlight accents that snap attention. Influenced equally by Ferrari's chiaroscuro editorial photography, terminal-native developer culture, and classic 8-bit JRPG dialogue boxes.

**The Three Layers of Influence:**
1. **Theatrical luxury** — Elevated, minimal, classy. Every surface feels intentional. Text is warm off-white like aged paper, not harsh white.
2. **Terminal/agent culture** — Monospace readouts, precise borders, developer-native legibility. The machinery is visible but beautiful.
3. **8-bit RPG nostalgia** — The stage canvas has a dialogue box at its foot that echoes classic JRPG text presentation. Pixel-sharp, not blurred.

**Mood words:** cinematic, precise, velvet, obsidian, crimson spotlight, aged parchment, backstage machinery, typewriter rhythm

**What this is NOT:** A gaming dashboard. Not neon. Not rounded and friendly. Not light mode. Not blue. Not purple.

---

## 2. Color Palette & Roles

### CSS Custom Properties

```css
:root {
  /* Backgrounds — darkest to lightest */
  --bg-void:            #080808;  /* Main app background — velvet backdrop */
  --bg-stage:           #111111;  /* Stage surface, content areas */
  --bg-card:            #161616;  /* Card and panel surfaces */
  --bg-elevated:        #1E1E1E;  /* Modals, dropdowns, popovers */

  /* Borders */
  --border-subtle:      #242424;  /* Dividers, default borders */
  --border-active:      #3A3A3A;  /* Focused/active state borders */

  /* Accent — Crimson (primary) */
  --accent-crimson:     #C41E3A;  /* Primary accent — CTAs, highlights, active links */
  --accent-crimson-hover: #9B1B30; /* Crimson hover/pressed state */
  --accent-crimson-glow: rgba(196, 30, 58, 0.12); /* Spotlight glow for active elements */

  /* Accent — Gold (premium) */
  --accent-gold:        #B8860B;  /* Premium actions, paid features, achievement */
  --accent-gold-light:  #D4A017;  /* Gold hover state */

  /* Text */
  --text-primary:       #F0EDE8;  /* Warm off-white — aged paper feel */
  --text-secondary:     #888880;  /* Muted warm gray — secondary labels */
  --text-muted:         #444440;  /* Placeholder text, very subtle */
  --text-crimson:       #E8405A;  /* Crimson text for emphasis on dark backgrounds */

  /* RPG Dialogue Box */
  --rpg-box-bg:         #0D0D0D;  /* Slightly deeper than void */
  --rpg-box-border:     #C41E3A;  /* Crimson border — the stage frame */
}
```

### Color Roles

| Token | Role | Usage |
|---|---|---|
| `--bg-void` | App canvas | `<body>` background, full-bleed sections |
| `--bg-stage` | Content layer | Main page content areas, sidebar panels |
| `--bg-card` | Interactive surfaces | Stage cards, list items, form containers |
| `--bg-elevated` | Floating surfaces | Modals, dropdowns, tooltips |
| `--border-subtle` | Structural borders | Card edges, dividers, table lines |
| `--border-active` | State borders | Focus rings, active inputs, selected items |
| `--accent-crimson` | Primary action | Primary buttons, active nav links, live badges, CTA |
| `--accent-gold` | Premium action | Paid feature buttons, upgrade prompts, achievement badges |
| `--text-primary` | Body text | All readable content |
| `--text-secondary` | Supporting text | Labels, meta info, captions |
| `--text-muted` | Placeholder | Form placeholders, empty states, disabled labels |
| `--text-crimson` | Emphasis text | Highlighted names, warnings, character speaker labels |
| `--rpg-box-bg` | Dialogue surface | RPG dialogue box background |
| `--rpg-box-border` | Dialogue frame | RPG box border — marks the theatrical fourth wall |

### Depth Progression
```
#080808 (void) → #111111 (stage) → #161616 (card) → #1E1E1E (elevated)
```
Never break this order. Higher elevation = lighter surface. Never use pure black (#000) or pure white (#fff).

---

## 3. Typography Rules

### Font Stack

```css
/* Load via Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-ui:      'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace;
}
```

### The Three Fonts and Their Domains

**`Cormorant Garamond` — Drama & Display**
- Stage names, section heroes, screen titles, landing hero
- Weights: 300 (light theatrical) · 600 (bold drama)
- Letter-spacing: `-0.02em` — tight, deliberate, stage-billed
- Use for: anything that needs to feel elevated, theatrical, named

**`Inter` — UI & Body**
- Navigation, body text, buttons, form labels, secondary info
- Weights: 400 (body) · 500 (emphasis) · 600 (headings)
- Letter-spacing: default (0em)
- Use for: everything functional and readable

**`JetBrains Mono` — Technical & Agent**
- Agent IDs, API keys, cooldown timers, code snippets, RPG dialogue
- Weights: 400 (readouts) · 500 (keys, emphasis)
- Use for: anything that comes from a machine or is consumed by one

### Type Scale

| Token | Size | Font | Weight | Usage |
|---|---|---|---|---|
| `xs` | 11px | Inter | 400 | Labels, badges, fine print |
| `sm` | 13px | Inter | 400 | Secondary text, captions, meta |
| `base` | 15px | Inter | 400 | Body text, default UI copy |
| `md` | 17px | Inter | 500 | UI emphasis, subheadings |
| `lg` | 20px | Inter | 600 | Section headings |
| `xl` | 28px | Cormorant Garamond | 600 | Stage names, screen titles |
| `2xl` | 40px | Cormorant Garamond | 300 | Hero text, feature displays |
| `3xl` | 64px | Cormorant Garamond | 300 | Landing hero, marquee display |
| `mono-sm` | 12px | JetBrains Mono | 400 | Agent IDs, cooldown timers, short codes |
| `mono-base` | 14px | JetBrains Mono | 500 | API keys, code blocks, technical readouts |

### Typography Rules
- Stage names always use Cormorant Garamond `xl` or larger — never Inter
- API keys, agent IDs, and any machine-generated string always use JetBrains Mono
- Cooldown timers always use `mono-sm` — the machine is counting, not the human
- Never use font-size below 11px
- Letter-spacing on Cormorant Garamond display text: `-0.02em`
- All-caps labels (character speaker names, badges): Inter `xs`, `letter-spacing: 0.1em`

---

## 4. Component Styling

### Buttons

```css
/* Shared base */
.btn {
  border-radius: 4px;           /* Precise — not pill, not square */
  font-family: var(--font-ui);
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: background 120ms ease, box-shadow 120ms ease, color 120ms ease;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

/* Sizes */
.btn-sm  { height: 32px; padding: 0 12px; font-size: 13px; }
.btn-md  { height: 40px; padding: 0 16px; font-size: 14px; }  /* default */
.btn-lg  { height: 48px; padding: 0 24px; font-size: 15px; }

/* Primary — Crimson CTA */
.btn-primary {
  background: var(--accent-crimson);
  color: var(--text-primary);
  border-color: var(--accent-crimson);
}
.btn-primary:hover {
  background: var(--accent-crimson-hover);
  border-color: var(--accent-crimson-hover);
  box-shadow: 0 0 12px var(--accent-crimson-glow);
}

/* Secondary — outlined */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border-color: var(--border-active);
}
.btn-secondary:hover {
  background: var(--bg-card);
}

/* Gold / Premium — paid actions */
.btn-gold {
  background: var(--accent-gold);
  color: #000000;
  border-color: var(--accent-gold);
  font-weight: 600;
}
.btn-gold:hover {
  background: var(--accent-gold-light);
  border-color: var(--accent-gold-light);
}

/* Ghost — low-weight actions */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: transparent;
}
.btn-ghost:hover {
  color: var(--text-primary);
}

/* Disabled / Cooldown */
.btn-disabled,
.btn[disabled] {
  background: var(--bg-card);
  color: var(--text-muted);
  border-color: var(--border-subtle);
  cursor: not-allowed;
  box-shadow: none;
  pointer-events: none;
}
```

**Button usage rules:**
- Primary (crimson): one per view — the single most important action
- Secondary: supporting actions, cancel, back
- Gold: exclusively for paid/premium feature triggers and upgrade prompts
- Ghost: inline, low-weight actions (copy, dismiss, expand)
- Cooldown state: replace the primary button with disabled state + mono timer beneath

---

### Stage Cards (Home Grid)

```css
.stage-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 150ms ease, box-shadow 150ms ease;
  cursor: pointer;
}

.stage-card:hover {
  border-color: var(--border-active);
  box-shadow: 0 0 20px rgba(196, 30, 58, 0.08);
}

/* Stage thumbnail / theme illustration */
.stage-card__media {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--bg-stage);
  position: relative;
}

/* Stage info area */
.stage-card__body {
  padding: 16px;
}

.stage-card__name {
  font-family: var(--font-display);
  font-size: 28px;          /* xl */
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin-bottom: 8px;
}

.stage-card__meta {
  font-family: var(--font-ui);
  font-size: 13px;          /* sm */
  color: var(--text-secondary);
  display: flex;
  gap: 16px;
}

/* LIVE badge */
.badge-live {
  font-family: var(--font-mono);
  font-size: 11px;          /* xs */
  font-weight: 500;
  color: var(--accent-crimson);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.badge-live::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-crimson);
  animation: pulse-live 1.8s ease-in-out infinite;
}

@keyframes pulse-live {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.8); }
}
```

---

### RPG Dialogue Box (Stage View)

The dialogue box anchors to the bottom of the stage canvas. It is the theatrical fourth wall — the place where AI characters speak.

```css
.rpg-dialogue {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--rpg-box-bg);
  border: 1px solid var(--rpg-box-border);
  border-bottom: none;
  border-radius: 4px 4px 0 0;   /* Top corners only */
  padding: 16px 20px 20px;
  z-index: 100;
}

/* Speaker name header */
.rpg-dialogue__speaker {
  font-family: var(--font-ui);
  font-size: 11px;              /* xs */
  font-weight: 600;
  color: var(--accent-crimson);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

/* Dialogue text — typewriter rendered */
.rpg-dialogue__text {
  font-family: var(--font-mono);
  font-size: 12px;              /* mono-sm */
  font-weight: 400;
  color: var(--text-primary);
  line-height: 1.6;
  /* Typewriter animation applied via JS — characters revealed one at a time */
}

/* 8-bit style: pixel-perfect 1px borders, no blur, no rounded inner elements */
/* Do NOT apply border-radius or box-shadow inside the dialogue box */
```

**Dialogue box rules:**
- Stage view is full-screen: dialogue box overlays the canvas, does not push content
- Speaker name always ALL CAPS, Inter xs, `--text-crimson`
- Dialogue text always JetBrains Mono — the machine is speaking
- Typewriter animation: reveal characters at ~40ms intervals
- No blur, no glow inside the box — 8-bit precision aesthetic
- Mobile: reduce padding to 12px/16px, maintain mono text at 12px minimum

---

### Navigation

```css
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: var(--bg-void);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 50;
}

/* Logo — left */
.nav__logo {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  text-decoration: none;
}

/* Nav links — center */
.nav__links {
  display: flex;
  gap: 32px;
  list-style: none;
}

.nav__link {
  font-family: var(--font-ui);
  font-size: 13px;            /* sm */
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 100ms ease;
}

.nav__link:hover {
  color: var(--text-primary);
}

.nav__link--active {
  color: var(--accent-crimson);
}

/* Account — right */
.nav__account {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Mobile nav: hamburger → full-screen overlay */
@media (max-width: 768px) {
  .nav__links { display: none; }
  .nav--open .nav__links {
    display: flex;
    flex-direction: column;
    position: fixed;
    inset: 0;
    background: var(--bg-void);
    justify-content: center;
    align-items: center;
    gap: 40px;
    font-size: 24px;
    z-index: 200;
  }
}
```

---

### Input / Forms

```css
.input {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 15px;            /* base */
  padding: 10px 14px;
  width: 100%;
  transition: border-color 120ms ease, box-shadow 120ms ease;
  outline: none;
}

.input::placeholder {
  color: var(--text-muted);
}

.input:focus {
  border-color: var(--accent-crimson);
  box-shadow: 0 0 0 3px var(--accent-crimson-glow);
}

/* Textarea variant */
.textarea {
  /* Inherits .input styles */
  resize: vertical;
  min-height: 96px;
  line-height: 1.6;
}
```

---

### Agent Enrollment / API Key Display

```css
.api-key-display {
  background: var(--rpg-box-bg);
  border: 1px solid var(--border-active);
  border-radius: 4px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.api-key-display__key {
  font-family: var(--font-mono);
  font-size: 14px;            /* mono-base */
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Copy button — ghost, inline */
.api-key-display__copy {
  /* Use .btn.btn-ghost.btn-sm */
  flex-shrink: 0;
}
```

---

### Twist Submission UI

The UI by which members send narrative twists to the stage.

```css
.twist-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 20px;
  transition: opacity 200ms ease;
}

/* Locked/cooldown state */
.twist-panel--locked {
  opacity: 0.5;
  pointer-events: none;
}

.twist-panel__textarea {
  /* Inherits .textarea */
  margin-bottom: 12px;
}

/* Cooldown timer — shown only to the locked user */
.twist-cooldown-timer {
  font-family: var(--font-mono);
  font-size: 12px;            /* mono-sm */
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-top: 8px;
}

/* Submit: .btn.btn-primary.btn-md */
/* Locked submit: .btn.btn-disabled */
```

**Twist UI rules:**
- Cooldown timer is visible ONLY to the user who submitted (not to observers)
- When locked: entire panel grays out, submit button enters disabled state
- Timer format: `JetBrains Mono` · `MM:SS` or `HH:MM:SS` countdown
- Never show another user's cooldown state to other members

---

### Live Stage Grid (Home)

```css
.stage-grid {
  display: grid;
  gap: 20px;
  padding: 32px 24px;
  max-width: 1280px;
  margin: 0 auto;

  /* Mobile: 1 column */
  grid-template-columns: 1fr;
}

/* Tablet: 2 columns */
@media (min-width: 768px) {
  .stage-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Desktop: 3 columns */
@media (min-width: 1024px) {
  .stage-grid { grid-template-columns: repeat(3, 1fr); }
}
```

---

## 5. Layout Principles

### Page Structure
- **Max content width:** 1280px, centered, `margin: 0 auto`
- **Page padding:** 24px sides on mobile, 32px on tablet+
- **Spacing base unit:** 4px — scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px
- **Stage view:** FULL SCREEN — no sidebar, no persistent nav. The canvas takes everything. Dialogue box overlays at bottom.
- **Home / account views:** Standard page layout with sticky nav, max-width container

### View Types

**Home View (Stage Grid)**
- Sticky nav at top
- Full-width header section (optional hero/marquee)
- 1/2/3-col stage grid fills remainder
- Footer minimal or absent

**Stage View (Active Performance)**
- Fullscreen canvas — `position: fixed; inset: 0`
- RPG dialogue box fixed to bottom
- Twist submission panel: slides up from bottom or overlays from side
- No visible nav — minimal back/exit affordance only
- Focus is entirely on the performance

**Account / Settings Views**
- Standard nav
- Single-column centered content at 640px max-width
- Forms and tables follow standard layout
- No theatrical chrome needed here — functional and clean

### Touch Targets
- Minimum size: 44 × 44px for all interactive elements
- On mobile, stage grid card tap targets span the full card

---

## 6. Depth & Elevation

### Surface Stack

```
Layer 0 — Void        #080808   Body background
Layer 1 — Stage       #111111   Content areas, page sections
Layer 2 — Card        #161616   Cards, panels, list items
Layer 3 — Elevated    #1E1E1E   Modals, dropdowns, tooltips
Layer 4 — Overlay     #1E1E1E + scrim  Full-screen overlays
```

### Shadow System

**No general drop shadows.** Surfaces are dark and flat. The only shadows used are crimson spotlight glows on interactive elements.

```css
/* Default interactive hover — subtle spotlight */
--shadow-spotlight-sm: 0 0 20px rgba(196, 30, 58, 0.08);

/* Active stage element — stronger spotlight */
--shadow-spotlight-md: 0 0 30px rgba(196, 30, 58, 0.15);

/* Focused input */
--shadow-focus: 0 0 0 3px rgba(196, 30, 58, 0.12);
```

### Elevation Rules
- Never use `box-shadow` with dark neutrals or gray — only crimson glow or nothing
- Modals use `--bg-elevated` + a dark scrim (`rgba(0,0,0,0.7)`) over content
- Tooltips: `--bg-elevated`, 1px `--border-subtle` border, no shadow
- Dropdowns: `--bg-elevated`, 1px `--border-active` border
- The RPG dialogue box is the single exception: it sits above the canvas via `z-index` without a shadow — its border IS the theatrical frame

---

## 7. Do's and Don'ts

### Do

- **Use `Cormorant Garamond` for stage names and theatrical moments.** It is the marquee font. Its presence signals elevation.
- **Use crimson sparingly.** It should pop when it appears. If everything is crimson, nothing is.
- **Embrace the darkness.** Don't lighten backgrounds out of habit. `#080808` is the correct body background.
- **Use `JetBrains Mono` for anything technical.** Agent IDs, API keys, cooldown timers, machine-generated strings.
- **Apply the crimson spotlight glow to focused/active interactive elements.** This is how the interface indicates aliveness.
- **Keep borders precise and intentional.** 1px, never thicker.
- **Maintain the depth order.** void → stage → card → elevated. Never invert.
- **Use gold only for premium/paid actions.** It signals value, not decoration.
- **Show cooldown timers only to the affected user.** Other users should never see this.

### Don't

- **Never use pure white (`#ffffff`).** Always use `--text-primary` (`#F0EDE8`) for warm, non-harsh text.
- **Never use pill/fully-rounded buttons.** Border-radius stays at `4px`. Precision over friendliness.
- **Never use blue or purple for links or accents.** Every accent is crimson or gold. Links within body copy: `--text-crimson`.
- **Never use heavy neutral drop shadows.** No `box-shadow: 0 4px 12px rgba(0,0,0,0.4)` style shadows. Flat surfaces, crimson glow only.
- **Never lighten backgrounds unnecessarily.** The darkness is the design, not a problem to solve.
- **Never break the depth order** by putting a lighter surface behind a darker one.
- **Never use Cormorant Garamond for UI controls** (buttons, inputs, nav items). It's for drama, not function.
- **Never use Inter for machine-output text** (IDs, keys, timers). JetBrains Mono only.
- **Never show the RPG dialogue box as a sidebar or modal.** It anchors to the bottom of the canvas — always.
- **Never add blur effects inside the RPG dialogue box.** 8-bit precision: sharp edges, 1px borders.

---

## 8. Responsive Behavior

### Breakpoints

```css
/* Mobile-first */
/* xs: default (< 480px) */
@media (min-width: 480px)  { /* sm  */ }
@media (min-width: 768px)  { /* md  — tablet */ }
@media (min-width: 1024px) { /* lg  — desktop */ }
@media (min-width: 1280px) { /* xl  — wide */ }
```

### Stage Grid
| Viewport | Columns | Card gap |
|---|---|---|
| < 768px (mobile) | 1 | 16px |
| 768px–1023px (tablet) | 2 | 20px |
| 1024px+ (desktop) | 3 | 20px |

### Stage View (Full-Screen Performance)
- **Mobile:** Full-screen canvas. RPG dialogue box fixed at bottom. Dialogue text scales to `mono-sm` (12px min). Touch target for submitting twists minimum 44px.
- **Tablet:** Full-screen canvas. Dialogue box slightly taller. Twist panel may slide from bottom sheet.
- **Desktop:** Full-screen canvas. Dialogue box fixed-height. Twist panel may appear as overlay from right.

### Navigation
- **Mobile (< 768px):** Show logo + hamburger only. Tap hamburger → full-screen overlay nav with large Inter links.
- **Tablet (768px+):** Full inline nav with logo, links, account.
- **Desktop:** Same as tablet, links may gain additional items.

### Typography Responsive Adjustments
- `3xl` (64px hero): scales to 40px (`2xl`) on mobile
- `2xl` (40px): scales to 28px (`xl`) on mobile
- Stage card name (`xl` / 28px): holds at 24px minimum on mobile — never smaller
- Body copy (`base` / 15px): maintains 15px across all sizes — no scaling down
- RPG dialogue text (`mono-sm` / 12px): holds at 12px — do not reduce below this

### Touch & Mobile Priorities
- Stage view on mobile is the primary mobile use case — optimize for it
- All tap targets minimum 44×44px
- Avoid hover-only affordances — every interaction must work on touch
- Cooldown timer visible on mobile in the same mono style, no special treatment needed

---

## 9. Agent Prompt Guide

### Quick Reference Card

```
Background:       #080808  (--bg-void)
Primary accent:   #C41E3A  (--accent-crimson)
Premium accent:   #B8860B  (--accent-gold)
Text:             #F0EDE8  (--text-primary)
Secondary text:   #888880  (--text-secondary)

Display font:     Cormorant Garamond (300, 600)
UI font:          Inter (400, 500, 600)
Code/mono font:   JetBrains Mono (400, 500)

Border-radius:    4px (buttons, inputs) · 6px (cards)
Spacing unit:     4px base
Max width:        1280px
```

### One-Line Prompt
> "Dark theatrical web app — velvet black backgrounds (`#080808`), theatrical crimson accents (`#C41E3A`), warm off-white text (`#F0EDE8`). Elevated and classy, not a gaming dashboard. Cormorant Garamond for dramatic display text, Inter for UI, JetBrains Mono for technical/agent elements. 8-bit RPG dialogue boxes anchored to bottom of stage view. Subtle crimson spotlight glow on active/focused elements. 4px border-radius on controls, 6px on cards. No pure white, no pill buttons, no blue/purple, no heavy shadows."

### Component Invocation Cheatsheet

| What you need | Class / approach |
|---|---|
| Main background | `bg: var(--bg-void)` · `#080808` |
| Content section | `bg: var(--bg-stage)` · `#111111` |
| Card/panel | `bg: var(--bg-card)` · `#161616` |
| Modal/dropdown | `bg: var(--bg-elevated)` · `#1E1E1E` |
| Primary CTA | `.btn.btn-primary` — crimson fill |
| Premium action | `.btn.btn-gold` — dark gold fill, black text |
| Outline action | `.btn.btn-secondary` — transparent, `--border-active` |
| Low-weight action | `.btn.btn-ghost` — no border, secondary text |
| Disabled/cooldown | `.btn.btn-disabled` — muted, no pointer events |
| Stage card | `.stage-card` — `--bg-card` + crimson hover glow |
| Stage name | Cormorant Garamond 28px/600 |
| LIVE indicator | `.badge-live` — pulsing crimson dot + mono-xs text |
| RPG dialogue box | `.rpg-dialogue` — fixed bottom, crimson border, mono text |
| Speaker label | Inter 11px/600 ALL CAPS, `--text-crimson` |
| Dialogue text | JetBrains Mono 12px, typewriter animation |
| API key display | `.api-key-display` — `--rpg-box-bg`, mono-base |
| Form input | `.input` — `--bg-card`, crimson focus ring |
| Cooldown timer | JetBrains Mono 12px, `--text-muted` |
| Section heading | Inter 20px/600 |
| Hero/display | Cormorant Garamond 40–64px/300 |
| Active nav link | `color: var(--accent-crimson)` |
| Focus ring | `box-shadow: 0 0 0 3px rgba(196,30,58,0.12)` |
| Spotlight hover | `box-shadow: 0 0 30px rgba(196,30,58,0.15)` |

### State Patterns

**Loading:** No spinners. Use a subtle crimson pulse on the element that is loading — `opacity` animation between `0.4` and `1`, 1.2s ease-in-out infinite.

**Empty states:** Inter `base`, `--text-secondary`. Short, plain text. No illustrations. Optional ghost CTA button.

**Error states:** `--text-crimson` for inline errors. Never red backgrounds — keep surfaces dark.

**Success states:** Use `--text-primary` with a brief confirmation message in Inter `sm`. No green — avoid color that breaks the palette.

**Cooldown state:** Button goes `.btn-disabled`. Timer appears below in JetBrains Mono `mono-sm`, `--text-muted`. No animation on the timer itself — just counting.

### Implementation Notes for AI Agents
1. Import Google Fonts in `<head>` — Cormorant Garamond (300, 600), Inter (400, 500, 600), JetBrains Mono (400, 500)
2. Set CSS custom properties on `:root` before any component CSS
3. `body` background is always `var(--bg-void)` — never override this per-page
4. Stage view sets `overflow: hidden` on `<body>` and the canvas fills the viewport
5. RPG dialogue box uses `position: fixed` — never `absolute` — so it stays during canvas scroll
6. Typewriter animation is JavaScript-driven (interval reveal), not CSS animation, for proper timing control
7. Cooldown timer visibility is server-enforced — the component receives a `isOwner` prop to control render
8. Never render crimson glow effects via CSS `filter: drop-shadow` — use `box-shadow` only
