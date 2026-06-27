# Task List — Splitwise-lite

Split into **your by-hand jobs** (accounts, secrets, linking) and **Cowork build tasks**.

---

## A. Your by-hand setup (do these; Cowork can't)

### Accounts & repos
- [ ] Create / sign in to **GitHub**; create an empty repo `splitwise-lite`.
- [ ] Create / sign in to **Vercel**; import the GitHub repo (link remote).
- [ ] Create / sign in to **Supabase**; new project. Note the region.

### Secrets to collect
- [ ] Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only — never client).
- [ ] Supabase: database connection string (for Prisma `DATABASE_URL`).
- [ ] FX API: pick frankfurter.app (no key) or open.er-api.com (free key) → `FX_API_URL` (+ key if needed).
- [ ] App secret for sessions (e.g. `AUTH_SECRET`, generate random).

### Where secrets go
- [ ] Local: `.env.local` (gitignored).
- [ ] Vercel: Project → Settings → Environment Variables (paste the same set). Mark `SUPABASE_SERVICE_ROLE_KEY` + `AUTH_SECRET` as server-only.

### Supabase config
- [ ] Create a **Storage bucket** `receipts` (for expense images).
- [ ] Enable email auth (password) in Supabase Auth settings.

> Anything requiring you to type a password, create an account, or accept terms = your job. Cowork will tell you exactly when it needs a value.

---

## B. Cowork build tasks

### Foundation
- [ ] Scaffold Next.js (App Router) + TypeScript + Tailwind.
- [ ] Init **shadcn/ui**; add Button, Card, Input, Label, Select, Textarea, Tabs, ToggleGroup, Dialog, AlertDialog, Avatar, Badge, Separator, Switch, Skeleton, Sonner.
- [ ] Install Prisma + `@supabase/supabase-js`.
- [ ] Apply design tokens from `01-design-system.md` (accent `#C57C24`, reserved green/red).

### Data + core logic
- [ ] Prisma schema per kickoff brief; first migration.
- [ ] **Ledger module** (integer cents): net balances, split resolvers (equal/unequal/%), zero-sum invariant.
- [ ] **Greedy simplify-debts** function.
- [ ] **Currency**: daily FX fetch + cache; per-expense editable rate; convert-before-sum.
- [ ] **Audit log** write-on-mutation + revert (inverse apply); permission check (own vs admin).
- [ ] **Unit tests**: cents rounding, multi-currency netting, revert correctness, simplify output.

### Auth + access
- [ ] Server-action auth gate: valid session **OR** valid share-token.
- [ ] Supabase email/password sign-in.
- [ ] Share-link entry + slot claiming.

### Screens (per `02-pages-and-flows.md`)
- [ ] Landing/demo, Auth, Share-link entry.
- [ ] Group list, Create/edit group.
- [ ] Group detail (balances + feed).
- [ ] Add/edit expense (all split modes + image upload + FX row).
- [ ] Expense detail, Settle up, Activity feed, Settings.

### Data + deploy
- [ ] Seed **demo group** with realistic data (persistent, used as preview).
- [ ] Verify build on Vercel preview deploy.

---

## C. Suggested order
1. A (setup) → 2. Foundation → 3. Data + core logic (with tests) → 4. Auth → 5. Screens → 6. Seed + deploy.
