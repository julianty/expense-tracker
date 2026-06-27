# Roadmap — Splitwise-lite

Principle: a weekend stays a weekend. Ship the reliable core; defer the NP-hard and AI-heavy bits.

---

## Weekend 1 — MVP (in scope)

**Core**
- Groups + slot-based members
- Two-door auth: account + share link
- Add/edit expenses: equal, unequal, percentage
- Multiple payers
- Net-balance ledger (integer cents, zero-sum invariant)
- **Greedy simplify-debts** + settle up
- Activity feed + **revert/undo** (own vs admin)
- Currency: daily FX call, user-editable rate per expense, base currency per group
- Receipt **image upload** (no scan)
- Seeded **demo group** as preview/tutorial
- Deploy to Vercel

**Explicitly cut from v1**
- Receipt auto-scan / itemization
- Charts & spending trends
- Recurring expenses
- Venmo/PayPal payout integration
- Realtime live updates (refresh is fine at ~10 users)
- Provably-minimal transaction optimization
- Dark mode

---

## Fast-follows (next, in rough priority)

1. **Receipt scanning** — image → Claude vision API → line items → assign to members. Add a per-link rate cap so a shared link can't run up API calls.
2. **Charts & trends** — spending by category over time (the other reclaimed "pro" feature).
3. **Recurring expenses** — rent, subscriptions.
4. **Realtime** — Supabase realtime for live balance updates.
5. **Friends view** — non-group 1:1 expenses (Splitwise's "non-group expenses").
6. **Debt-simplification optimization** — max-flow / better heuristic if greedy ever feels suboptimal in practice.
7. **Dark mode** — shadcn makes this cheap via CSS vars.

---

## Scaling notes (past ~10 users)
- Supabase + Vercel free tiers comfortably cover early growth.
- Ledger is O(n) per group; fine well beyond initial scale.
- Watch: FX cache (keep at one call/day app-wide), Storage size (receipts), and rate-limiting the scan endpoint once added.
