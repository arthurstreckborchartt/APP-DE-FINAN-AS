---
name: FINANCE
description: A calm, familiar banking app for personal and shared money, with violet on ink, white sheets and tabular figures.
colors:
  primary: "#5b3df5"
  primary-strong: "#4a2ee0"
  primary-fg: "#ffffff"
  primary-soft: "#efebff"
  brand-1: "#5b3df5"
  brand-2: "#2a1a8a"
  brand-fg: "#ffffff"
  brand-muted: "#d6ccff"
  success: "#0f7a55"
  danger: "#cc3b31"
  bg: "#f4f3f9"
  surface: "#ffffff"
  surface-2: "#efedf7"
  surface-3: "#e3e0f0"
  fg: "#110e24"
  muted: "#5d5973"
  line: "#e5e2ef"
typography:
  display:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.03em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    fontFeature: "\"cv11\", \"ss01\""
  body-sm:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  label:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    letterSpacing: "0.06em"
  amount:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\""
rounded:
  field: "16px"
  sheet: "24px"
  panel: "28px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-3}"
  button-ghost:
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "48px"
  button-danger:
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    height: "48px"
  text-field:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "48px"
  text-field-focus:
    backgroundColor: "{colors.surface}"
  sheet-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
    padding: "20px"
  balance-panel:
    backgroundColor: "{colors.brand-1}"
    textColor: "{colors.brand-fg}"
    rounded: "{rounded.panel}"
    padding: "24px"
  segmented-control:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.pill}"
    padding: "4px"
  segmented-option-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "44px"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.field}"
    height: "48px"
  fab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.pill}"
    size: "60px"
  currency-chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  category-avatar:
    rounded: "{rounded.pill}"
    size: "44px"
---

# Design System: FINANCE

## Overview

**Creative North Star: "The Quiet Bank"**

FINANCE looks like the banking app people already trust, done with care. One confident violet balance panel carries the brand; everything below it is quiet, white and exact. Content sits on rounded white sheets floating on a cool near-white ground (light theme) or layered graphite on near-black (dark theme). Density is comfortable rather than packed: generous 20–24px sheet padding, 48px controls, 44px minimum targets.

The system is conventional on purpose. The owner chose the category standard (the craft level of Nubank, Revolut, Monzo), so the identity lives in finish rather than novelty: Manrope with tabular figures for every amount, one brand hue used sparingly, pill-shaped actions, circular category avatars tinted from each category's own color, and a single authored motion moment where the balance panel settles and values unblur.

It replaces the earlier generic Tailwind-dashboard look (flat white cards, teal accent, default type), which is the confirmed anti-reference.

**Key Characteristics:**
- One brand surface per screen: the violet balance panel (or the auth side panel).
- White sheets with soft offset shadows on a cool ground; no borders on cards.
- Every money value uses tabular figures and is hideable.
- Green and coral appear only on amounts and their bars, never as decoration.
- Pills for actions and toggles, 16px fields, 24px sheets, 28px brand panels.
- Light, dark and system themes are first-class and share one token set.

## Colors

A calm violet on deep ink, set against cool, slightly blue neutrals, with two semantic hues reserved for money.

### Primary
- **Serene Violet** (primary): primary buttons, the + FAB, focus outlines, caret, text selection, active nav text, links such as "See all".
- **Pressed Violet** (primary-strong): hover and pressed state of primary actions.
- **Violet Mist** (primary-soft): active nav pill, avatar initials background, empty-state icon disc, hover tint on quick actions and text links.
- **Balance Violet to Deep Ink Blue** (brand-1 to brand-2): the 160deg gradient of the balance panel and the auth side panel, also the BrandMark monogram. Brand-muted is the secondary text on that panel; brand-fg is its primary text.

### Secondary
- **Ledger Green** (success): income amounts, income bars, positive net.
- **Statement Coral** (danger): expense bars, negative net, destructive buttons, field errors.

### Neutral
- **Cool Paper** (bg): the app ground behind sheets; also the ring that cuts the FAB out of the bottom bar.
- **Sheet White** (surface): every card, dialog, sidebar and bottom bar.
- **Fog** (surface-2): input fills, secondary buttons, segmented-control track, list-row hover, progress tracks.
- **Steel Fog** (surface-3): hover on fog fills, the "other" segment in the category bar, scrollbar thumb.
- **Ink** (fg): primary text and expense amounts in lists.
- **Slate** (muted): labels, metadata, inactive nav.
- **Hairline** (line): sidebar edge, bottom-bar top edge, the divider above a net total.

### Dark theme
The same role names remap under `.dark`: bg #09080f, surface #13111d, surface-2 #1c1929, surface-3 #272339, fg #f1effa, muted #a39fb8, line #262238, primary #a996ff, primary-strong #bcadff, primary-fg #160a4a, primary-soft #231b52, brand-1 #4a2ee0, brand-2 #1a0f5c, brand-muted #cfc4ff, success #45d19a, danger #ff7b6f. Components only reference role names, never theme-specific values.

### Named Rules
**The One Brand Surface Rule.** The brand gradient appears once per screen, on the balance panel (Início, Contas) or the auth side panel. Other sheets stay white.

**The Money-Only Semantics Rule.** Ledger Green and Statement Coral color amounts, their bars and errors only. Expense amounts in a list stay Ink; only the net total turns coral. Signs (+ / −) always accompany color so meaning never rests on color alone.

**The Category Tint Rule.** Category avatars take the category's own color for the glyph and the same color at roughly 12% alpha for the disc. The category bar on Início uses the full color.

## Typography

**Display Font:** Manrope Variable (with system-ui, sans-serif)
**Body Font:** Manrope Variable
**Label/Mono Font:** Manrope with tabular figures (`.num`), no separate mono

**Character:** One geometric-humanist family across the whole app, set heavy (600–800) and tightly tracked at large sizes so numbers read as solid, confident figures. Stylistic sets cv11 and ss01 are on globally.

### Hierarchy
- **Display** (800, 38px rising to 46px from sm, line-height 1.25, -0.03em, tabular): the main balance in the brand panel. Siblings: account total 34px→40px, amount entry 36px→44px, auth tagline 44px at line-height 1.05 and -0.035em.
- **Headline** (800, 28px rising to 34px at lg, -0.03em): one page title per screen. Auth card title uses 30px.
- **Title** (800, 17px, -0.01em): sheet titles. Dialog titles step up to 20px with -0.02em.
- **Body** (600–700, 15px): list-row primary text (700, -0.01em), nav items, button labels (700), subtitles (500). Inputs use 16px medium to avoid mobile zoom.
- **Body-sm** (500, 13px, muted): row metadata, field labels (600), helper and error text.
- **Label** (800, 13px, +0.06em, uppercase, muted): day-group headers in Lançamentos and settings section headings; 12px bold for summary terms. Bottom-nav labels are 11px bold, sentence case.
- **Amount** (700–800, 15–17px, -0.01em, tabular): every money value in rows and summaries.

### Named Rules
**The Tabular Money Rule.** Every money value renders through the Amount component with tabular figures and a -0.01em track, so columns align and hidden values become a fixed "••••" mask.

**The Weight Carries Hierarchy Rule.** Hierarchy comes from weight and size steps (800 for titles and amounts, 500–600 for meta), not from color or extra faces.

## Layout

Mobile first, one column with a 20px gap between sheets and 16px side margins. A sticky translucent header (bg at 90% with blur) holds the BrandMark and avatar; a fixed white bottom bar holds four tabs plus a raised center FAB, and hides on the transaction form so the keypad and Save button own the screen. Content reserves 128px bottom padding for the bar.

At lg (1024px) the shell becomes a 17rem white sidebar (BrandMark, primary "Novo lançamento" pill, nav list, profile card pinned to the bottom) beside a content column capped at 72rem with 40px side padding. Início becomes a 7fr / 5fr grid (balance and category breakdown left, month summary and recent right); Lançamentos puts the list left and a sticky 20rem aside (month switcher, totals, filters) right. Auth splits 50/50 with the brand panel on the left.

Rhythm runs on a 4px base: 4, 8, 12, 16, 20, 24, 32. Controls are 48px tall; icon buttons and segmented options are 44px; the FAB is 60px; quick-action discs are 56px.

## Elevation & Depth

Hybrid: tonal layering does most of the work (bg, then surface, then surface-2 fills inside), and two soft, offset shadows lift the things that float. There are no borders on cards. In dark theme the shadows deepen to near-black and the graphite surface steps carry the layering.

### Shadow Vocabulary
- **Sheet** (`0 1px 2px rgb(12 18 34 / 0.04), 0 8px 24px -12px rgb(12 18 34 / 0.12)`): every white sheet, the month switcher, selected segmented option, quick-action discs, dialogs.
- **Float** (`0 10px 30px -10px rgb(36 69 184 / 0.55)`): violet-tinted glow under the balance panel, primary buttons, the FAB and the primary quick action. Dark: `0 10px 30px -10px rgb(0 0 0 / 0.8)`.

### Named Rules
**The Two Shadows Rule.** Only Sheet and Float exist. Sheet means "resting surface"; Float means "brand or primary action". Disabled primaries drop their shadow.

## Shapes

Soft and rounded throughout, scaled to the object: pills for anything pressable or toggled (buttons, segmented controls, chips, nav indicators, icon buttons, avatars), 16px for fields, keypad keys, list rows and nav items, 24px for sheets and empty states, 28px for brand panels and the auth card. Bottom-sheet dialogs round only the top at 28px on mobile and become 24px floating dialogs on desktop. Category avatars and icon discs are always circles. Progress bars are 8px (month) or 12px (category stack) pill tracks.

## Components

### Buttons
Confident, round and heavy.
- **Shape:** full pill, 48px tall, 24px horizontal padding, 15px bold label with -0.01em track.
- **Primary:** Serene Violet fill, white label, Float shadow; hover to Pressed Violet; press scales to 0.98.
- **Secondary:** Fog fill, Ink label; hover to Steel Fog.
- **Ghost:** transparent, Ink label; hover Fog.
- **Danger:** transparent, coral label; hover coral at 10%.
- **Focus / Disabled:** 2px violet outline offset 2px; disabled at 50% opacity with no shadow; loading shows an inline spinner.

### Chips
- **Currency chip:** Fog pill, 12px extrabold Slate code; tags each per-currency block when more than one currency exists.
- **On-brand pill:** white at 12% on the balance panel (accounts link, eye toggle), white at 20% on hover.

### Cards / Containers
- **Corner Style:** 24px (sheet), 28px (brand panel, auth card).
- **Background:** Sheet White; brand gradient for the balance panel only.
- **Shadow Strategy:** Sheet; brand panel uses Float.
- **Border:** none.
- **Internal Padding:** 20px, 24px from sm; list sheets use 8–12px so rows carry their own 12px padding.

### Inputs / Fields
- **Style:** Fog fill, transparent 1px border, 16px radius, 48px tall, 16px medium text; 13px semibold Slate label above, 6px gap.
- **Focus:** fill turns Sheet White, border turns violet, 4px violet ring at 15%.
- **Error / Disabled:** coral border and ring, 13px coral message below; disabled at 60% opacity. Selects share the field and add a muted chevron.

### Navigation
- **Mobile bottom bar:** white with hairline top and a soft upward shadow; tabs are 64px tall with an icon in a 48×28 pill (Violet Mist when active) over an 11px bold label; active is violet, inactive Slate. The center + FAB is a 60px violet circle raised 24px, cut out by a 6px bg-colored ring.
- **Desktop sidebar:** 48px rows at 16px radius, 15px semibold; active is Violet Mist with violet text, hover Fog. The primary pill sits above the list.

### Segmented Control
Fog pill track with 4px padding; 44px options; selected option is a Sheet White pill with the Sheet shadow and Ink text, others Slate. Behaves as a keyboard radiogroup.

### Balance Panel (signature)
The brand moment. A 160deg gradient from brand-1 to brand-2 with a white radial highlight in the top-right corner, 28px radius, Float shadow. Greeting and "Saldo" in brand-muted, the display amount below, extra currencies at 20px in brand-muted, and an eye toggle that hides all values app-wide. On open it settles up 10px from 0.985 scale over 640ms; toggling values unblurs them over 360ms, both on `cubic-bezier(0.16, 1, 0.3, 1)` and only without reduced motion.

### Transaction Row
16px-radius row with 12px padding: 44px category avatar, 15px bold description over 13px Slate "category · account", amount right-aligned (green with + for income, Ink with − for expense). Rows group by day inside a sheet under an uppercase Label header with the day's net at right.

### Amount Keypad
3-column grid of 56px Fog keys at 16px radius with 22px bold tabular digits, under a 36–44px extrabold entry display.

## Do's and Don'ts

### Do:
- **Do** route every money value through tabular figures and the hide-values mask.
- **Do** keep the brand gradient to one panel per screen and put everything else on white sheets with the Sheet shadow.
- **Do** use pills for actions and toggles, 16px for fields and rows, 24px for sheets, 28px for brand panels.
- **Do** pair income/expense color with a + / − sign and with bars that have text labels.
- **Do** keep controls at 48px and every target at 44px or more.
- **Do** reference role tokens (primary, surface-2, muted) so light and dark themes stay in parity.

### Don't:
- **Don't** return to the flat white cards, teal accent and default type of the previous look.
- **Don't** use green or coral for decoration, icons or backgrounds outside money values, their bars and errors.
- **Don't** add borders around sheets; separate with the ground color and the Sheet shadow.
- **Don't** introduce shadows beyond Sheet and Float, or a second typeface.
- **Don't** print an expense amount in coral inside a list; only the net total turns coral.
