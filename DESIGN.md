---
name: Todo Sticky Calendar
description: 跨平台个人任务管理工具，清晰、温暖、高效
colors:
  neutral-bg: "#FFFEFC"
  neutral-panel: "#FFFFFF"
  neutral-line: "#E9E9E7"
  ink: "#37352F"
  ink-muted: "#9B9A97"
  accent: "#5B7F95"
  accent-soft: "#E4ECF1"
  accent-deep: "#3D5D6E"
  hl-red-bg: "#F9E8E5"
  hl-red-text: "#CE5242"
  hl-orange-bg: "#F9ECDF"
  hl-orange-text: "#D9730D"
  hl-yellow-bg: "#FAF3DC"
  hl-yellow-text: "#C29209"
  hl-green-bg: "#EDF3EC"
  hl-green-text: "#448361"
  hl-blue-bg: "#E7F3F8"
  hl-blue-text: "#337EA9"
  hl-gray-bg: "#F1F1EF"
  hl-gray-text: "#787774"
typography:
  body:
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  title:
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  display:
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  label:
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
    textTransform: "uppercase"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  full: "999px"
spacing:
  xs: "6px"
  sm: "14px"
  md: "24px"
  lg: "36px"
  xl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 22px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 22px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.neutral-panel}"
    rounded: "{rounded.md}"
    padding: "28px"
  input:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
    typography: "{typography.body}"
---

# Design System: Todo Sticky Calendar

## 1. Overview

**Creative North Star: "Notion Calm"**

A warm white canvas where content breathes. The interface borrows Notion's soft minimalism: generous whitespace, a six-color pastel highlight system, and a single warm-gray text tone. Everything sits on a welcoming off-white page that feels like a blank document ready to be filled.

This is a tool for people who think in lists and want their tools to fade into the background. The aesthetic is warm without being cozy, structured without being rigid. The accent appears sparingly — a completed task, a selected tab — and its restraint gives it meaning. The highlight palette lets users scan quadrants and priorities at a glance, while the generous spacing keeps every item distinct.

**Key Characteristics:**
- Warm white page (`#FFFEFC`) that avoids cool-blue undertones
- Six-color highlight system (red, orange, yellow, green, blue, gray) for semantic tagging
- Unified warm-gray ink (`#37352F`) for all primary text
- Neutral gray hover tint (`rgba(55,53,47,0.06)`) replacing colored hovers
- Default 708px content width on desktop web for focused reading
- Inter typeface leading a system font stack across all platforms

## 2. Colors

A warm, restrained palette built around a slate-blue accent with Notion's signature multi-color highlight system. Neutrals lean perceptibly warm, never cool. Ink is a warm dark gray, not pure black.

### Primary
- **Slate Blue** (`#5B7F95`): The sole accent. Used for primary buttons, selected states, checkboxes, links, and the active tab indicator.
- **Slate Deep** (`#3D5D6E`): Hover and active states for accent elements.
- **Slate Soft** (`#E4ECF1`): Tinted backgrounds for selected calendar days and edit buttons.

### Neutral
- **Page** (`#FFFEFC`): Root background. A warm white, Notion's signature canvas color.
- **Panel** (`#FFFFFF`): Card and panel surfaces. Subtly brighter than the page.
- **Line** (`#E9E9E7`): Borders and dividers. At rest they read as subtle texture.
- **Ink** (`#37352F`): Primary text. A warm dark gray, Notion's signature text tone.
- **Muted** (`#9B9A97`): Secondary text, placeholders, captions.

### Highlight Palette (Notion's 6-color system)
Each color pair has a pastel background and a saturated text color:
- **Red** (`#F9E8E5` / `#CE5242`): Urgent-important quadrant, danger actions
- **Orange** (`#F9ECDF` / `#D9730D`): Urgent quadrant
- **Yellow** (`#FAF3DC` / `#C29209`): P1 priority, warning states
- **Green** (`#EDF3EC` / `#448361`): Completion, success states
- **Blue** (`#E7F3F8` / `#337EA9`): Important quadrant, info states
- **Gray** (`#F1F1EF` / `#787774`): Backlog quadrant, P2 priority, neutral tags

### Semantic Remapping
- `--success` = `--hl-green-bg`, `--success-text` = `--hl-green-text`
- `--warning` = `--hl-yellow-bg`, `--warning-text` = `--hl-yellow-text`
- `--danger` = `--hl-red-bg`, `--danger-text` = `--hl-red-text`

### Named Rules
**The Notion Hover Rule.** Interactive elements hover toward `rgba(55,53,47,0.06)` — a warm neutral gray tint that works across all highlight backgrounds. No colored hovers.

**The Panel Tonal Shift Rule.** Panel hover states shift background from white to page (`#FFFEFC`). No shadow reveal on hover.

**The Highlight Pair Rule.** Every highlight color comes as a bg+text pair. Backgrounds are used for surfaces and tags; text colors for text on those surfaces. Never mix bg from one pair with text from another.

## 3. Typography

**Font:** Inter primary, PingFang SC / Microsoft YaHei UI fallback. Inter brings Notion's characteristic warmth and readability; the system fallbacks ensure consistent rendering across platforms.

**Character:** Warm, humanist, highly readable. Body text at 16px with comfortable 1.5 line-height. Display weight is bold (700) rather than light, creating confidence without coldness.

### Hierarchy
- **Display** (700, 40px, 1.2): Page titles. Bold and warm. Mobile: 32px.
- **Headline** (600, 24px, 1.3): Section headers, calendar month labels. Mobile: 20px.
- **Title** (600, 20px, 1.3): Card titles, project names, dialog headers. Mobile: 17px.
- **Body** (400, 16px, 1.5): All running text, task titles, input values. Max line length 75ch.
- **Label** (500, 12px, 0.02em letter-spacing): Quadrant labels, priority tags, timestamps.

### Named Rules
**The Weight-Only Rule.** Hierarchy is created through font weight and size alone. Never through color alone on the same size.

## 4. Elevation

This system is flat by default. Depth is conveyed through subtle border lines and background tonal shifts.

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 2px 10px rgba(0,0,0,0.06)`): Lighter and more diffuse than before. Used for sticky windows and drag previews.
- **Modal** (`box-shadow: 0 8px 24px rgba(0,0,0,0.12)`): Dialog backdrops and modal surfaces.
- **Inset Line** (`box-shadow: inset 0 0 0 1px var(--line)`): The default border surrogate. A 1px inner stroke.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (drag, modal elevation).

**The 1px Maximum Rule.** No border or outline exceeds 1px.

## 5. Components

### Buttons
- **Shape:** 6px radius (sm). Tighter than before, closer to Notion's precise corners.
- **Primary:** Slate Blue background, white text, 8px 22px padding. Transition 150ms ease-out.
- **Secondary:** Transparent background, Ink text, inset 1px Line border.
- **Ghost:** Transparent, Ink-muted text. Hover reveals `rgba(55,53,47,0.06)` background.
- **Danger:** Red highlight bg, red highlight text (pastel bg + saturated text, Notion style).
- **Complete/Success:** Green highlight bg, green highlight text.

### Tabs
- **Style:** Pill buttons (999px radius). Inactive: transparent with muted text; hover gets gray tint. Active: accent background with white text.
- **Transition:** all 180ms ease-out.

### Cards / Panels
- **Corner Style:** 8px radius (md). Clean and confident.
- **Background:** `neutral-panel` (`#FFFFFF`).
- **Hover:** Background shifts to `var(--page)` for a subtle tonal response. No shadow.
- **Internal Padding:** 28px (web), 20-24px (mobile).

### Inputs / Fields
- **Style:** Page background, 6px radius, inset 1px Line border.
- **Focus:** Inset border shifts to accent color. No glow.
- **Height:** 36-40px.

### Chips / Tags
- **Style:** 999px radius (fully rounded). 12px font.
- **Priority tags (P0/P1/P2):** Highlight pairs: P0 = red, P1 = yellow, P2 = gray.

### Progress Bar
- **Style:** 8px height, full radius. Track uses neutral-line. Fill uses accent.
- **Interaction:** Cursor shifts to ew-resize.

### Modals / Dialogs
- **Style:** Panel background, 10px radius (lg), Modal shadow.
- **Backdrop:** rgba(0, 0, 0, 0.2), no blur.

### Quadrant Columns
- **Urgent-Important (q1):** Red highlight bg
- **Important (q2):** Blue highlight bg
- **Urgent (q3):** Orange highlight bg
- **Backlog (q4):** Gray highlight bg

### Desktop Width Toggle
- **Default:** `min(708px, calc(100% - 48px))` — single column, focused reading
- **Full-width:** `min(1200px, calc(100% - 56px))` — two columns, full workspace

## 6. Do's and Don'ts

### Do:
- **Do** use the highlight palette's bg+text pairs together. Never cross-match.
- **Do** use `rgba(55,53,47,0.06)` for hover states on interactive elements.
- **Do** rely on weight contrast (400 / 500 / 600 / 700) for typographic hierarchy.
- **Do** separate sections with generous whitespace.
- **Do** keep the default content width at 708px for focused reading on desktop.
- **Do** use the Inter font stack across all platforms.

### Don't:
- **Don't** use dark mode as the default theme. The default is always light.
- **Don't** use gradient text, glassmorphism, or decorative animations.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe.
- **Don't** use nested cards.
- **Don't** use modal dialogs as the first solution.
- **Don't** use pure black (`#000`) or pure white (`#fff`) — always the warm equivalents.
