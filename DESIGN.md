---
name: Todo Sticky Calendar
description: 跨平台个人任务管理工具，清晰、高效、专业
colors:
  neutral-bg: "#f7f5f2"
  neutral-panel: "#fdfdfc"
  neutral-line: "#e5e2df"
  ink: "#1c1c1c"
  ink-muted: "#8c8c8c"
  accent: "#5b7f95"
  accent-soft: "#e4ecf1"
  accent-deep: "#3d5d6e"
  success: "#7a9e7e"
  warning: "#c9a96e"
  danger: "#c47e6e"
typography:
  body:
    fontFamily: "'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  title:
    fontFamily: "'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  display:
    fontFamily: "'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif"
    fontSize: "34px"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  label:
    fontFamily: "'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
    textTransform: "uppercase"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 20px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
  button-primary-active:
    backgroundColor: "{colors.accent-deep}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 20px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.neutral-panel}"
    rounded: "{rounded.md}"
    padding: "24px"
  input:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
    typography: "{typography.body}"
---

# Design System: Todo Sticky Calendar

## 1. Overview

**Creative North Star: "The Sharp Page"**

A single sheet of premium paper under even light. Nothing more. The interface recedes until only the task remains.

This is a tool for people who think in lists. The aesthetic is precision without coldness: surfaces are flat and clean, but the off-white background carries a barely perceptible warmth that keeps the screen from feeling sterile. The accent color appears sparingly — a single completed checkbox, a selected tab, a hover state — and its rarity is the point. Typography does the heavy lifting through weight contrast alone: light display figures, confident headlines, quiet body text.

**Key Characteristics:**
- Flat surfaces with minimal elevation; shadows appear only on hover or drag
- One accent color used on less than 10% of any given screen
- Typographic hierarchy through weight contrast (300 / 400 / 600 / 700)
- No dividers; space alone separates sections
- Cool off-white background tinted just enough to not read as pure white

## 2. Colors

A restrained palette built around a single slate-blue accent. Neutrals are slightly warm off-whites, never pure white. Ink is near-black with no perceptible hue.

### Primary
- **Slate Blue** (`#5b7f95`): The sole accent. Used for primary buttons, selected states, checkboxes, links, and the active tab indicator. Appears on ≤10% of any screen.
- **Slate Deep** (`#3d5d6e`): Hover and active states for accent elements.
- **Slate Soft** (`#e4ecf1`): Tinted backgrounds for quadrant headers, selected rows, and hover cards. Never used as a border.

### Neutral
- **Page** (`#f7f5f2`): Root background. A cool off-white with imperceptible warmth.
- **Panel** (`#fdfdfc`): Card and panel surfaces. Brighter than the page to create a subtle lift without shadow.
- **Line** (`#e5e2df`): Borders and dividers. At rest they read as subtle texture; on interaction they can shift to the accent.
- **Ink** (`#1c1c1c`): Primary text. Near-black, slightly softer than pure `#000`.
- **Muted** (`#8c8c8c`): Secondary text, placeholders, captions.

### Semantic
- **Success** (`#7a9e7e`): Completion states. A muted sage green.
- **Warning** (`#c9a96e`): Due dates, approaching deadlines. Muted gold.
- **Danger** (`#c47e6e`): Delete actions, overdue indicators. Muted rose.

### Named Rules
**The One Accent Rule.** The accent color appears on at most 10% of any screen. A button, a selected tab, a checked box. Its scarcity is what makes it signal.

**The No Pure White Rule.** Every light surface is tinted toward the brand temperature. Pure `#ffffff` and pure `#000000` are prohibited.

**The Ghost Border Rule.** Borders are 1px solid, in `neutral-line`. No border-left or border-right greater than 1px as a colored stripe. Color emphasis comes from background tints, not side borders.

## 3. Typography

**Font:** System Chinese UI stack — PingFang SC (Mac/iOS), Microsoft YaHei UI (Windows), system-ui fallback. A single sans-serif family for all roles; distinction comes from weight and size alone.

**Character:** Clean, neutral, and highly readable. The lighter display weight (300) creates an airy contrast against the confident headlines (700). Body text is set at a comfortable 14px with generous line-height.

### Hierarchy
- **Display** (300, 34px, 1.1): Page titles on panels. Used sparingly — typically once per view.
- **Headline** (700, 24px, 1.2): Section headers, calendar month labels. Commands attention without shouting.
- **Title** (600, 18px, 1.3): Card titles, project names, dialog headers.
- **Body** (400, 14px, 1.6): All running text, task titles, input values. Max line length 65ch for multi-line content.
- **Label** (500, 11px, 0.02em letter-spacing, uppercase where the font supports it): Quadrant labels, priority tags, timestamps, field captions.

### Named Rules
**The Weight-Only Rule.** Hierarchy is created through font weight and size alone. Never through color alone on the same size, and never through all-caps for Chinese text.

## 4. Elevation

This system is flat by default. Depth is conveyed through subtle background tonal shifts (the page is slightly darker than panels) rather than shadow. Shadows appear only as a response to interaction: hover, drag, or active states.

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08)`): Card hover, dropdown menus, drag previews. Diffuse and low-contrast.
- **Modal** (`box-shadow: 0 20px 48px rgba(0, 0, 0, 0.14)`): Dialog backdrops and modal surfaces only.
- **Inset Line** (`box-shadow: inset 0 0 0 1px var(--line)`): The default border surrogate. A 1px inner stroke that reads as a border without consuming layout space.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, elevation, focus, drag).

**The 1px Maximum Rule.** No border or outline exceeds 1px. Grouping and separation come from space and background tonal shifts, not stroke weight.

## 5. Components

### Buttons
- **Shape:** Consistently 8px radius. Square enough to feel precise, rounded enough to not feel harsh.
- **Primary:** Slate Blue background (`#5b7f95`), white text, 8px 20px padding. Used for the single most important action on a screen.
- **Hover / Focus:** Deepens to Slate Deep (`#3d5d6e`). Transition 150ms ease-out.
- **Secondary:** Transparent background, Ink text, inset 1px Line border. Used for auxiliary actions.
- **Ghost:** Transparent, Ink-muted text. Hover reveals a subtle Line background. Used for icon buttons and inline actions.
- **Danger:** Danger background (`#c47e6e`), white text. Reserved for delete confirmations.

### Tabs
- **Style:** Pill buttons (999px radius). Inactive: transparent with muted text. Active: accent background with white text.
- **Transition:** Background color 180ms ease-out.

### Cards / Panels
- **Corner Style:** 12px radius. Sharp enough to stack cleanly, soft enough to not feel like a spreadsheet.
- **Background:** `neutral-panel` (`#fdfdfc`).
- **Border:** None visible. Separation from the page is tonal (panel is brighter).
- **Shadow:** None at rest. Ambient shadow on hover only for interactive cards.
- **Internal Padding:** 24px.

### Inputs / Fields
- **Style:** Neutral-bg background, 8px radius, inset 1px Line border.
- **Focus:** Inset border shifts to accent color. No glow, no outline expansion.
- **Height:** 36-40px for text inputs.
- **Placeholder:** Ink-muted, 14px.

### Chips / Tags
- **Style:** 999px radius (fully rounded). 6px 12px padding, 12px font.
- **Priority tags (P0/P1/P2):** Distinct tinted backgrounds: P0 uses danger tint, P1 uses warning tint, P2 uses neutral-line.
- **Quadrant chips (q1-q4):** Muted tinted backgrounds matching the quadrant's semantic role.

### Progress Bar
- **Style:** 6px height, full radius (3px / 999px). Track uses neutral-line. Fill uses accent.
- **Interaction:** Cursor shifts to ew-resize. Drag updates fill width in real-time.

### Modals / Dialogs
- **Style:** Panel background, 16px radius, Modal shadow.
- **Backdrop:** rgba(0, 0, 0, 0.2), no blur.
- **Width:** 380-480px, centered.

### Navigation (Tab Bar)
- **Style:** Horizontal pill row, 8px gap between pills.
- **Active:** Accent background, white text, 999px radius.
- **Inactive:** Transparent, muted text.

## 6. Do's and Don'ts

### Do:
- **Do** use the single accent color sparingly — one button, one selected tab, or one checked state per view.
- **Do** rely on weight contrast (300 / 400 / 600 / 700) for typographic hierarchy instead of color or size changes.
- **Do** use 1px inset shadows (`inset 0 0 0 1px`) as border surrogates. They don't consume layout space.
- **Do** separate sections with space alone. The gap between two panels should speak louder than any divider line.
- **Do** use 8-12px radius for interactive elements (buttons, inputs), 12-16px for containers (cards, panels).
- **Do** keep shadows flat at rest. Reserve elevation for hover, drag, and modal states.
- **Do** use the same font stack across all platforms (PingFang SC / Microsoft YaHei UI / system-ui).

### Don't:
- **Don't** use dark mode as the default theme. The default is always light.
- **Don't** use enterprise SaaS blue-and-white as the baseline palette (no gradient blue headers, no white cards on blue-gray backgrounds).
- **Don't** use gradient text (`background-clip: text`), glassmorphism (backdrop-filter blur on cards), or decorative animations.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, or callouts.
- **Don't** use nested cards. One level of card surface is enough.
- **Don't** use em dashes or decorative punctuation in UI copy.
- **Don't** use modal dialogs as the first solution. Exhaust inline expansion and progressive disclosure first.
- **Don't** exceed 65 characters per line for multi-line body text.
- **Don't** use pure white (`#ffffff`) or pure black (`#000000`) anywhere.
