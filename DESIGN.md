---
name: FINANCE
description: Personal and group money, read like Cal AI reads calories — one big number beside its ring.
colors:
  primary: "#5b3df5"
  primary-strong: "#4a2ee0"
  primary-soft: "#efebff"
  primary-dark: "#a996ff"
  ground: "#ffffff"
  ground-dark: "#000000"
  cloud: "#f4f4f6"
  cloud-dark: "#1c1c1e"
  cloud-2: "#ebebef"
  cloud-2-dark: "#2c2c2e"
  cloud-3: "#dedee4"
  cloud-3-dark: "#3a3a3c"
  ink: "#0b0b0f"
  ink-hover: "#26262d"
  ink-dark: "#ffffff"
  muted: "#6b6b75"
  muted-dark: "#9a9aa3"
  line: "#ebebef"
  ring-track: "#e4e4ea"
  ring-track-dark: "#2e2e32"
  income: "#1fae6b"
  income-dark: "#34d184"
  expense: "#ff6a4d"
  expense-dark: "#ff7a61"
  limit: "#3a7bfd"
  limit-dark: "#5b95ff"
  danger: "#cc3b31"
  success: "#0f7a55"
  warning: "#b7791f"
  chart-1: "#5b3df5"
  chart-2: "#eb6834"
  chart-3: "#1baf7a"
  chart-4: "#eda100"
  chart-5: "#e87ba4"
  chart-6: "#2a78d6"
typography:
  hero-number:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.04em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  headline-wide:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    letterSpacing: "-0.035em"
  sheet-title:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    letterSpacing: "-0.02em"
  keypad-key:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    fontFeature: "\"cv11\", \"ss01\""
  row-amount:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  label:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  caption:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  nav-label:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
  button:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "-0.01em"
rounded:
  icon-sm: "12px"
  icon: "14px"
  field: "18px"
  tile: "20px"
  row: "22px"
  card: "28px"
  pill: "9999px"
spacing:
  gap-row: "8px"
  card-pad: "20px"
  card-pad-wide: "24px"
  page-x: "20px"
  page-x-wide: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "52px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-secondary:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "52px"
  button-secondary-hover:
    backgroundColor: "{colors.cloud-2}"
  card:
    backgroundColor: "{colors.cloud}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  row-item:
    backgroundColor: "{colors.cloud}"
    rounded: "{rounded.row}"
  chip:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 16px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  segment-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.pill}"
    height: "44px"
  input:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "52px"
    padding: "0 16px"
  fab:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.pill}"
    size: "64px"
  link:
    textColor: "{colors.primary}"
---

# Design System: FINANCE

## Overview

**Creative North Star: "The Ring Ledger"**

FINANCE borrows the Cal AI app's visual language (user-pinned reference, 2026-10-18) and keeps its own violet accent and two-circle logo. Money is read the way Cal AI reads calories: one enormous tabular number beside a thick ring, then small ring cards, then calm gray rows. The ground is pure white (true black in dark); everything that holds content is a flat Cloud slab with a generous 28px radius, no border and no shadow. Depth comes from tone, not from elevation.

The system is quiet and dense in the right places. Black ink does the work of committing (primary buttons, the floating + button, the selected chip or segment); violet is rationed to the things that measure and lead (rings, links, the active-navigation dot and icon, focus). Each metric owns one color for life: income green, expense coral, limit blue, and each category its own hue, so a ring is legible before its label is read.

Money rules are non-negotiable and come before style: tabular figures everywhere, every amount rendered through the Amount component so the hide-values mask works, explicit + / − signs with color on transactions, and totals always per currency, never converted.

**Key Characteristics:**
- Pure white / true black ground; flat Cloud cards (28px), no borders, no card shadows.
- Ink pills for primary actions; black circular FAB (white in dark).
- Selected chips and segments are ink, not violet.
- Thick rounded-cap rings, one color per metric, icon at center.
- Hero number (up to 56px, Manrope 800) beside its ring, currency symbol small and raised.
- Tabular figures, hide-values mask, signed and colored amounts, per-currency totals.

## Colors

A near-monochrome white/Cloud/ink world with one violet accent and a small, fixed set of metric colors.

### Primary
- **FINANCE Violet** (`primary`; dark `primary-dark`): the brand accent. Used for ring arcs that have no metric of their own (budgets total, week strip), "See all" links, the active nav icon and dot, focus outlines, text caret and selection. `primary-soft` is the hover wash behind violet links. Never a button fill, never the selected state of a chip.

### Secondary (metric colors)
- **Income Green** (`income`): income ring, + amounts.
- **Expense Coral** (`expense`): expense ring, − amounts, and the overflow color when a ring passes 100%.
- **Limit Blue** (`limit`): credit-limit ring.
- **Category / chart hues** (`chart-1`…`chart-6`, plus user-chosen category and card colors): category rings, icon tiles (glyph in the hue on a 14% tint), chart series.

### Neutral
- **Ground** (`ground` / `ground-dark`): page background, sheets on mobile, fields inside a Cloud card.
- **Cloud** (`cloud` / `cloud-dark`): cards, list rows, fields and chips on the ground, sidebar active item.
- **Cloud 2 / Cloud 3**: hover on Cloud surfaces; Cloud 3 also the sheet grabber and scrollbar thumb.
- **Ink** (`ink` / `ink-dark` white): primary text and every committing fill (primary button, FAB, today's date, selected chip/segment/tile, avatar).
- **Muted** (`muted` / `muted-dark`): labels, captions, inactive nav.
- **Line** (`line`): the only hairlines — sidebar edge and bottom-bar top edge. Not used on cards.
- **Ring Track** (`ring-track` / `ring-track-dark`): the unfilled ring; dashed when the day has no value.
- **Danger / Success / Warning**: form errors, destructive text buttons, status text.

### Named Rules
**The Ink Commits Rule.** Anything that means "this is chosen" or "do it" is ink: primary button, FAB, selected chip, selected segment, selected tile, today's date. Violet never fills a control.

**The One Color Per Metric Rule.** A metric keeps its color everywhere it appears (ring, amount, chart). Income is green, expense coral, limit blue, a category its own hue. Don't recolor a metric for decoration.

**The Rationed Violet Rule.** Violet marks measurement and navigation only: rings, links, active-nav indicator, focus. If a screen's violet is mostly fills, it is wrong.

## Typography

**Display Font:** Manrope Variable (with system-ui, sans-serif)
**Body Font:** Manrope Variable (same family; stylistic sets cv11 + ss01 on)

**Character:** One geometric sans at two volumes: extra-bold 800 for numbers and titles with tight negative tracking, quiet 500–600 for labels. The contrast is weight and size, never a second family.

### Hierarchy
- **Hero number** (800, 56px shrinking to fit down to 26px, 1.05, -0.04em, tabular): the single main amount in a HeroCard. Currency symbol at 0.48em, bold, raised.
- **Amount keypad display** (800, 44–52px, -0.035em): the value being entered on the new-transaction screen.
- **Headline** (800, 30px; 34px on desktop, -0.035em): page titles. No eyebrow or kicker above them.
- **Sheet title** (800, 22px, -0.02em).
- **Title** (800, 19px, -0.02em): section headers; ring-card values (16–22px, -0.03em).
- **Row amount** (800, 17px, tabular): amounts on list rows, goal and budget rows.
- **Body / button** (500–700, 15px): body text, buttons (700, -0.01em).
- **Label** (600, 13px, muted): field labels, card labels, captions. Chips 13–14px bold. Captions and week-day initials 12px bold. Nav labels 11px bold.

### Named Rules
**The Tabular Money Rule.** Every amount carries tabular figures (`tnum`, -0.01em) and is rendered through Amount, so it aligns in columns and obeys the hide-values mask (`••••`, unblur reveal).

**The Small Symbol Rule.** In hero-sized numbers the currency symbol shrinks to about half size and rides high; the digits get the width.

## Layout

Mobile first: 20px page gutter, sticky white header (logo left, avatar right), content, then a fixed 4-item white bottom bar with a hairline top edge and a black 64px FAB floating above it at the right. On the new/edit transaction form the bottom bar and FAB step aside. Desktop (lg, 1024px+): a 17rem white sidebar with logo, a full-width ink "New transaction" pill, pill nav links and a profile row; content in a max-width 72rem column with 40px gutters, cards arranged in a two-column grid.

Rhythm: list rows are separate Cloud rows 8px apart (never a single bordered table); card padding 20px (24px from sm). Home reads top-down as week strip of seven day rings → HeroCard → three RingCards side by side → recent rows. Touch targets are at least 44px everywhere.

## Elevation & Depth

Flat by default. Depth is tonal: Cloud on white, white on Cloud (fields and plain buttons invert inside a card), Cloud 2/3 for hover. Shadows exist only for things that float above the page.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 6px 14px -4px rgb(11 11 15 / 0.32), 0 14px 32px -12px rgb(11 11 15 / 0.28)`; dark adds a 1px white 6% ring): the FAB only.
- **Pop** (`box-shadow: 0 2px 6px rgb(11 11 15 / 0.06), 0 24px 48px -20px rgb(11 11 15 / 0.28)`): sheets/dialogs and popovers, over a 40% black scrim.

### Named Rules
**The No-Shadow Card Rule.** Cards, rows, tiles and chips never carry a shadow or a border. If a surface needs separation, change its tone.

## Shapes

Soft, generous rounding that grows with the surface: 12–14px icon tiles, 18px fields and icon buttons, 20px choice tiles and keypad keys, 22px list rows and payment cards, 24px small ring cards on mobile, 28px cards, sheets (top corners on mobile) and hero. Every button, chip, segment, avatar and FAB is a full pill or circle. Rings use round caps. No borders on shapes; the only lines are the shell's two hairlines.

## Components

### Buttons
- **Shape:** full pill, 52px tall, 24px horizontal padding, 15px bold.
- **Primary:** ink fill, ground text; hover ink-hover; press scales to 0.98.
- **Secondary:** Cloud fill, ink text; hover Cloud 2.
- **Plain / Plain danger:** ground fill so it shows on a Cloud card; danger variant uses danger text.
- **Ghost / Danger:** transparent; Cloud or 10% danger wash on hover.
- **Focus:** 2px violet outline, 2px offset. Disabled at 50% opacity.

### Chips
- **Style:** 44px pill on the field fill (Cloud on white, white inside a Cloud card), 13–14px bold ink text.
- **State:** selected = ink fill with ground text; hover on unselected = Cloud 2. Groups are radiogroups with roving focus and scroll horizontally. Choice tiles (category icon + name) follow the same rule at 20px radius.

### Segmented control
A pill track on the field fill with 4px inset; the selected segment is an ink pill, others muted text that darkens on hover. Arrow/Home/End keys move selection.

### Cards / Containers
- **Corner Style:** 28px.
- **Background:** Cloud.
- **Shadow Strategy:** none (see Elevation).
- **Border:** none.
- **Internal Padding:** 20px, 24px from sm.
- **List rows:** separate Cloud rows at 22px, 8px apart, hover on the inner link.

### Inputs / Fields
- **Style:** 52px, 18px radius, field fill, 16px semibold text; label above in 13px semibold muted.
- **Focus:** 2px violet ring. **Error:** 2px danger ring and a 13px danger message linked by aria-describedby. Disabled at 60%.
- **Date picker** glyph is the app's own calendar icon in muted, violet on hover/focus.

### Navigation
- **Mobile bottom bar:** white, hairline top edge, four items with 22px icon and 11px bold label; active = ink text, heavier stroke, and a 4px violet dot below.
- **Desktop sidebar:** pill links 48px tall; active = Cloud fill, ink text, violet icon.
- **FAB:** 64px ink circle with a + glyph, float shadow; white with black glyph in dark.

### Ring (signature)
Thick round-cap arc on the ring track, drawn on mount with a 1100ms expo-out stroke-dashoffset (skipped under reduced motion). Sizes: 100px/10px stroke in heroes, 64px/8px in ring cards, 44px/4px in the week strip, 48px/6px in list rows. Past 100% the arc turns to its overflow color (expense coral). An icon in the metric color sits in the center; a dashed track marks "no value yet".

### HeroCard
A Cloud card with the hero number and its muted label on the left and a ~100px ring on the right, side by side at every width. The number fits its column (56px down to 26px).

### RingCard
Small Cloud card: value (16–22px extrabold), 13px muted label, 64px ring with centered icon. Three sit side by side on Home (Income, Expenses, Cards).

### Payment card tile
The one place a surface takes a user color: a 1.586-ratio card at 22px radius filled with the card's color, two soft translucent circles top-right echoing the logo, name, currency and closing/due days; a gentle pointer tilt (10°, 1.03 scale) on hover. A Cloud summary row sits below it.

## Do's and Don'ts

### Do:
- **Do** put the one number that matters at hero size beside its ring, with a small raised currency symbol.
- **Do** use ink for every committing fill and every selected state (chips, segments, tiles, today).
- **Do** keep violet for rings, links, the active-nav indicator and focus.
- **Do** give each metric its fixed color: income green, expense coral, limit blue, categories their own hue.
- **Do** render all money through Amount: tabular figures, hide-values mask, +/− with color, totals per currency.
- **Do** separate content by tone (Cloud on white, white on Cloud), with 28px cards and 22px rows.
- **Do** keep targets at 44px and every ring labeled for screen readers.

### Don't:
- **Don't** add shadows or borders to cards, rows, chips or tiles; shadows are for the FAB, sheets and popovers only.
- **Don't** fill buttons, chips or segments with violet.
- **Don't** bring back the gradient brand header or stacked white sheets of the previous banking look.
- **Don't** put eyebrows or kickers above page titles.
- **Don't** sum or convert across currencies in a single total.
- **Don't** introduce a second typeface; contrast comes from Manrope's weights.
