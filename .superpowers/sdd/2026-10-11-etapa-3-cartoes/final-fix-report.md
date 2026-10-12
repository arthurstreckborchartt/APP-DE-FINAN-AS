# Final fix report - Etapa 3
1. Preview rollover: `firstUnpaidInvoiceMonth` in src/lib/invoice.ts (+test); used in TransactionFormPage.tsx (useCardInvoices before early returns).
2. CardTile.tsx archived pill: onCardDark ? bg-white/70 + ink : bg-black/45 + white.
3. PayInvoiceSheet.tsx maps hints to invoices.errors.* (4 locales); `isRpcHint` in src/lib/db-errors.ts (+test).
4. CardDetailPage.tsx: default = oldest unpaid with total>0, else first unpaid closing>=today, else last; useEffect scrollIntoView on selection (hooks moved above early returns).
5. TransactionsPage.tsx retry refetches cardsQuery.
6. HomePage.tsx: `showMonth` (accounts>0 or month entries) gates "Este mês" and "Para onde foi o dinheiro".
7. realtime.ts: 300 ms trailing debounce, timer cleared on cleanup.
8. supabase/migrations/20261012000002_guard_lock.sql: FOR SHARE on related invoices. Dry-run PASS; with 03_cards.sql body PASS (not pushed).
Verification: npm test 160 passed (23 files); npm run build ok; npm run e2e 8 passed; screens recaptured to .impeccable/review; card-detail selects overdue Aug, home shows month blocks. Dev server I started was stopped.
