---
version: 1
slug: "src-app-appshell-tsx"
primary_target: "src/app/AppShell.tsx"
related_targets: ["src/features"]
---

# Surface: FINANCE app shell and screens (whole PWA)

Scope: every authenticated screen (Início, Lançamentos, Novo lançamento, Contas, Categorias, Configurações), the shell (mobile bottom bar, desktop sidebar), onboarding and auth pages. Mode: Operate.

Audience/job: owner, family and friends planning and analyzing personal money on phone and PC; calm control; quick entry still a few taps away. Constraints: 4 locales, per-currency totals, light/dark/system theme, 44px targets, i18n parity.

Bar: category standard at the craft level of Nubank and Revolut/Monzo (user choice). Memorable moment: the balance header with a hide-values eye toggle and the month's spending broken down by category right on Início.

## Direction contract

THESIS: A familiar banking app done impeccably — one confident balance header, everything else quiet and exact. Refuses the generic Tailwind-dashboard look (flat white cards, teal accent, default type) the app ships today.

OWN-WORLD: Calm cobalt brand on deep ink; light theme on cool near-white with white sheets and soft offset shadows, dark theme near-black with layered graphite. One brand color for primary actions and the balance header; income green and expense coral only on amounts. Manrope with tabular figures; rounded 20–28px sheets, circular category avatars tinted from their color.

STORY: Open the app → see total balance (hideable), this month in vs out and where it went by category → tap + to record in seconds → review the month list grouped by day with daily totals → manage accounts and categories.

FIRST VIEWPORT: Mobile Início: brand balance header full-width (greeting, eye toggle, total per currency in large tabular type, accounts count) → row of four round quick actions (Novo, Contas, Categorias, Extrato) → "Este mês" sheet with income/expense bars and top categories with proportional bars → recent transactions. Desktop: sidebar left; header + month summary in the first row, category breakdown and recent side by side. Primary action: the + FAB (mobile) / "Novo lançamento" button (sidebar).

FORM: Canon (category standard), standing exit chosen by the user; seed key fcc03456.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
