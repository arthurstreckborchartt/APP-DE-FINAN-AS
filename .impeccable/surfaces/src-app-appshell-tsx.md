---
version: 1
slug: "src-app-appshell-tsx"
primary_target: "src/app/AppShell.tsx"
related_targets: ["src/features"]
---

# Surface: FINANCE app shell and screens (whole PWA)

Scope: every authenticated screen (Início, Lançamentos, Novo lançamento, Cartões, Grupos, Orçamentos, Metas, Relatórios, Contas, Categorias, Recorrentes, Ajustes), the shell (mobile bottom bar, desktop sidebar), onboarding and auth pages. Mode: Operate.

Audience/job: owner, family and friends planning and analyzing personal money on phone and PC; calm control; quick entry a tap away. Constraints: 4 locales, per-currency totals, light/dark/system theme, 44px targets, hide-values everywhere, i18n parity.

Bar: user-pinned reference (2026-10-18): the Cal AI app's visual language, executed at its craft level, keeping FINANCE's violet accent and two-circle logo. Memorable moment: the Início ring dashboard (big remaining number beside a ring, three ring cards, week strip of day rings).

## Direction contract

THESIS: Money read like Cal AI reads calories: one enormous "left this month" number beside its ring, then small ring cards — instead of the banking-app gradient header and stacked white sheets the app ships today.

OWN-WORLD: Pure white ground (dark: true black). Cards are flat Cloud gray (#f4f4f6 / dark #1c1c1e), 28px radius, no shadows, no borders. Ink-black pill buttons and a black circular FAB (dark: white with black glyph). Violet #5b3df5 is the accent: rings, active states, links, selected chips. Rings are thick (8–10px) rounded-cap arcs on a light track with an icon at the center; each metric owns one color (income green, expense coral, limit blue, category colors). Manrope 800 for huge tabular numbers (48–56px), quiet 500 labels. Rounded-square icon tiles for categories in lists.

STORY: Open → see what's left to spend this month and today's place in the week → glance at in/out/limit rings → tap + to record → drill into lists, budgets, goals, reports that all speak the same ring/card language.

FIRST VIEWPORT: Mobile Início: header (logo + FINANCE, avatar) → week strip of 7 day circles with spend rings, today highlighted → hero Cloud card: huge remaining/balance number + label left, large ring right → row of three ring cards (Entradas, Saídas, Cartões) → "Últimos lançamentos" gray rows. Black + FAB floats bottom-right above the white tab bar. Desktop: white sidebar, same cards in a two-column grid.

FORM: User-pinned reference world (Cal AI), not rolled; seed: pinned-cal-ai.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
