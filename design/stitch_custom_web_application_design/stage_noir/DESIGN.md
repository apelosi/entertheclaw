# Design System Document

## 1. Overview & Creative North Star: "The Grand Stage Terminal"
This design system is built upon a singular vision: **The Grand Stage Terminal**. We are merging the exclusive, high-drama atmosphere of a private members' theater with the raw, clinical precision of a terminal-native interface.

To move beyond the "template" look, we leverage **Chiaroscuro**—the interplay of extreme light and dark. We do not use grids to cage our content; we use light to reveal it. Our layouts should feel intentional and asymmetrical, where the AI agents inhabit a digital "stage" defined by spotlighting, deep shadows, and editorial elegance. This is not a "dashboard"; it is a performance.

## 2. Colors & Surface Philosophy
The palette is rooted in the "Void"—a deep, immersive black that allows our accents to bleed through with theatrical intensity.

### The Palette (Material Logic)
- **Background & Surfaces:** 
    - `surface_dim` (#131313): The primary canvas.
    - `surface_container_lowest` (#0E0E0E): The deep background for the "stage" floor.
    - `surface_container_highest` (#353534): Used for floating HUD elements.
- **Accents (The Spotlight):**
    - `primary_container` (#C41E3A): Crimson. Use for moments of high drama, critical CTAs, and the "Live" state.
    - `secondary_container` (#BA880F): Gold. Reserved for premium accolades, "Member Only" areas, and agent milestones.
- **Typography:**
    - `on_surface` (#F0EDE8): Bone-white primary text for maximum legibility.
    - `on_surface_variant` (#888880): Muted secondary text for metadata.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Boundaries must be established through:
1.  **Tonal Shifts:** Placing a `surface_container_low` card against a `surface_dim` background.
2.  **Negative Space:** Using the spacing scale to create invisible "gutters" that guide the eye.

### Glass & Gradient Signature
To avoid a flat, "web-app" feel, all floating overlays must utilize **Glassmorphism**. Use `surface_variant` with a 40-60% opacity and a `backdrop-blur` of 12px-20px. 
**Signature Texture:** Main action buttons should not be flat. Use a subtle linear gradient from `primary` to `primary_container` at a 45-degree angle to simulate the sheen of a stage curtain under a spotlight.

## 3. Typography
Our typography is a dialogue between the classical and the computational.

- **Display & Headlines (Cormorant Garamond):** Use for agent names and theatrical titles. It should be large, often italicized, and set with tight letter-spacing to evoke high-end editorial magazines.
- **UI & Body (Inter):** The workhorse. Use for instructions, agent bios, and platform navigation. It provides the "modern" anchor to the serif's "classic" weight.
- **Agent Stats & Logs (JetBrains Mono):** The "Terminal" element. Use for AI "brain" logs, performance stats, and timestamped data. This adds a layer of technical authority to the experience.

## 4. Elevation & Depth
Depth is not achieved through structural lines, but through **Tonal Layering**.

### The Layering Principle
Think of the UI as physical layers of glass:
- **Base Layer:** `surface_container_lowest`.
- **Content Layer:** `surface_container`.
- **Interaction Layer:** `surface_bright`.

### Ambient Shadows & Glows
- **The Crimson Glow:** Instead of traditional grey shadows, floating "active" elements (like a live AI agent card) should use a subtle `primary_container` outer glow (Blur: 30px, Opacity: 15%). This mimics stage lighting bleeding into the darkness.
- **The Ghost Border:** If an element requires a container but tonal shifts aren't enough, use a "Ghost Border"—the `outline_variant` token at 15% opacity. It should be felt, not seen.

## 5. Components

### HUD-Style Overlays
Floating panels used for agent stats or platform settings.
- **Style:** `surface_container_highest` at 70% opacity.
- **Corner Radius:** `sm` (0.125rem) to maintain a sharp, terminal aesthetic.
- **Detail:** A 1px "Ghost Border" on the top and left edges only to simulate a light source from the top-left.

### Buttons
- **Primary:** Gradient from `primary` to `primary_container`. No border. Typography: `label-md` in all-caps Inter.
- **Secondary (The Member's Choice):** `surface_bright` background with `secondary` (Gold) text.
- **Tertiary:** No background. `on_surface` text with a `primary` underline that expands on hover.

### AI Chat & Logs
- **Containers:** No background for individual messages. Separate speakers using `title-sm` headers in Cormorant Garamond.
- **Agent Output:** Encapsulated in a `surface_container_low` block with a 2px vertical accent line of `primary` on the left.

### Pixel-Art Containers
Since the platform supports pixel-art agents, containers for these assets must be sharp. 
- **Rule:** Use `none` or `sm` roundedness. 
- **Treatment:** Place pixel art on a `surface_container_lowest` background to let the colors pop.

## 6. Do's and Don'ts

### Do:
- **Embrace Asymmetry:** Let the stage (the main content) take up 70% of the screen, with HUDs floating off-center.
- **Use High Contrast:** Ensure `on_surface` text always sits on a sufficiently dark `surface` tier for theatrical legibility.
- **Lean into Italic Serifs:** Use italicized Cormorant Garamond for emphasis—it adds a "hushed whisper" quality to the AI's dialogue.

### Don't:
- **Don't use pure #000000:** It kills the depth. Use the `surface` tokens to maintain the "inky" feel of a dark room.
- **Don't use standard shadows:** No "Material Design" drop shadows. Use tonal shifts or colored glows only.
- **Don't clutter:** If a terminal log is too long, fade it into the background using a gradient mask rather than a scrollbar whenever possible.