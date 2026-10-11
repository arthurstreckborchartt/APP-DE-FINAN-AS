# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People managing their own money — the owner, family and friends — mostly in Brazil and Portugal (also English and Spanish speakers). Primary job: **plan and analyze** — sit down calmly, understand where the money goes, see balances per account and per currency, and keep things under control. Quick entry on the phone exists, but analysis and planning carry equal or greater weight. Personal finances can be shared through groups (couple, family, trip) while each member keeps their individual view.

## Product Purpose

FINANCE is a personal + group finance manager installable as a PWA on phone and desktop. It tracks accounts, categories, income and expenses, and (in upcoming stages) credit cards with real-time limits, installments, recurring bills, shared groups, budgets, goals and reports. Success: the user trusts the numbers and always knows where they stand.

## Positioning

One app for personal and shared money: each person keeps private finances and can join groups that show shared totals while preserving who spent what. Credit cards are first-class (closing/due days, installments, limit updating live). Multi-currency without fake conversions — totals are always shown per currency.

## Operating Context

- Used on phone (installed PWA, one-handed, on the go) and on PC (wider screens for review and planning).
- Four languages: pt-BR, pt-PT, en, es; user picks language, main currency and theme (system/light/dark).
- Stages shipped: 1 (auth, profile, i18n, theme, layout, PWA), 2 (accounts, categories, transactions). Next: 3 cards/invoices/installments, 4 recurring, 5 groups, 6 budgets/goals/reports, 7 deploy.

## Capabilities and Constraints

- React 19 + TypeScript + Vite 8 + Tailwind 4 + TanStack Query + Supabase (Postgres + RLS).
- Money is integer cents + ISO currency; currencies BRL, EUR, USD, GBP, CHF, CAD, AUD, ARS, MXN.
- All UI text through i18n with key parity across the 4 locales.
- No exchange-rate conversion in v1.

## Brand Commitments

- Name: **FINANCE** (provisional, chosen by the owner; may change later).
- Personality: **calm and trustworthy** — serious like a good bank, conveys control and tranquility. Not playful, not loud fintech.
- Visual preference (2026-10-11): the owner chose the **category standard** — a familiar personal-finance/banking app — executed at the craft level of **Nubank** and **Revolut / Monzo**. Convention is the commitment; no novelty worlds.

## Evidence on Hand

No testimonials, customers, logos or marketing assets exist. Do not fabricate any.

## Product Principles

1. Trust the numbers: every amount is exact, labeled with its currency, and never mixed across currencies.
2. Calm control: the interface lowers money anxiety — clear hierarchy, no alarmist noise, errors explained plainly.
3. Analysis first, entry fast: overviews and trends are first-class; adding a transaction stays a few taps away.
4. Private by default, shared on purpose: personal data never leaks into groups unless marked.

## Accessibility & Inclusion

Keyboard and screen-reader support (radiogroups, dialogs with focus trap, labeled controls), 44px touch targets, no information by color alone, readable in both light and dark themes.
