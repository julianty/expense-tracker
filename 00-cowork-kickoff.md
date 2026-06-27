# Splitwise-lite — Cowork Kickoff Brief

A lightweight, web-only Splitwise clone. Goal: rebuild the free core **plus** the "pro" features worth reclaiming, completable in a weekend, sized for ~10 users with room to grow.

---

## 1. Product summary

Core loop: people in a group log expenses → the app tracks who owes whom → it tells everyone the minimum payments to settle up.

**Rebuilding (Splitwise free core):**
- Groups + members (add by name; claim later)
- Add/edit expenses: amount, payer(s), description, date, note
- Split modes: equal, unequal amounts, percentage
- Net balances (who owes what)
- Simplify debts (greedy settlement)
- Settle up (record manual payment)
- Activity feed with revert/undo

**Reclaiming (normally paid):**
- Currency conversion (one FX call/day, user-editable rate) — *v1*
- Receipt **image upload** — *v1* (auto-scan/itemize is a fast-follow)

---

## 2. Architecture (locked)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router)**, web only | UI + API in one deployable |
| Hosting | **Vercel** free tier | Fine for ~10 users |
| DB + Auth + Storage | **Supabase** | Postgres + auth + image storage in one |
| ORM | **Prisma** (or Drizzle) | Typed queries + migrations |
| UI | **Tailwind + shadcn/ui** | Prebuilt components, minimal custom code |
| FX rates | free API (frankfurter.app / open.er-api.com) | one cached call/day |

### Authorization — one model
All writes go through **Next.js server actions**. Each action checks *valid session* **OR** *valid group share-token*, then writes with the service key. No direct browser→Supabase writes; Supabase RLS is not the auth surface. (One bouncer, one door, two kinds of ID.)

### Two ways in
1. **Real account** (Supabase Auth, email + password)
2. **Share link** `/g/{token}` — anyone with it claims a member slot and can act. The audit log + revert is what makes this safe.

### Member identity = slot model
A `GroupMember` is a **name slot** first (`"Alex"`), optionally **claimed** by a real user or a share-link visitor. Expenses reference the *slot*, never the account — so claiming/unclaiming never breaks history. (Assigned seats at a wedding: the seat exists; a person fills it later.)

### Ledger = net-balance, integer cents
- Each expense stores contributions that **sum to exactly zero** (in integer cents) → the whole ledger always nets to zero (testable invariant).
- Balances are **derived** (sum the columns), never stored separately → no drift.
- Summing is commutative → expense order never matters, and **revert = subtract that one row**.
- **Always work in integer cents**; assign any leftover penny deterministically (to the payer).
- **Multi-currency: convert each row to the group base currency *before* summing**, using the expense's stored `fxRate`.

### Simplify debts = greedy (in for v1)
Net everyone's position, then repeatedly match biggest creditor ↔ biggest debtor until zero. O(n), always settles correctly. (Provably-minimal transaction count is NP-hard / subset-sum — skip it; greedy is what Splitwise effectively ships.)

### Audit log = append-only + revert
- Every mutation writes an `audit_log` row: `actor`, `action`, `before`/`after` JSON snapshot.
- **Revert** applies the stored inverse and itself logs a new entry.
- User can undo their **own** latest entry; group admin (creator) can revert **anyone's**.
- (Like Google Docs version history, not full Git.)

---

## 3. Data model (sketch)

- `User` — real accounts (Supabase auth)
- `Group` — `name`, `baseCurrency`, `shareToken`, `simplifyDebts` (bool), `createdBy`
- `GroupMember` — slot: `groupId`, `displayName`, `claimedByUserId?`
- `Expense` — `groupId`, `description`, `note`, `date`, `currency`, `fxRate` (editable), `imageUrl?`, `createdByMemberId`
- `ExpensePayment` — `expenseId`, `memberId`, `amountCents` *(supports multiple payers)*
- `ExpenseShare` — `expenseId`, `memberId`, `amountCents` *(who owes; resolved from split mode at save)*
- `Settlement` — `groupId`, `fromMemberId`, `toMemberId`, `amountCents`, `date`
- `AuditLog` — `groupId`, `actorMemberId`, `action`, `beforeJson`, `afterJson`, `revertedByLogId?`, `createdAt`

Balances + simplified payments are **computed**, never stored.

---

## 4. Deliverables in this package
- `01-design-system.md` — tokens, type, components (shadcn-based)
- `02-pages-and-flows.md` — every screen + flow, for Claude Design wireframes
- `03-task-list.md` — your by-hand setup vs. Cowork build tasks
- `04-roadmap.md` — weekend-1 scope vs. fast-follows

## 5. First Cowork actions
1. Scaffold Next.js + Tailwind + shadcn/ui, install Prisma + Supabase client.
2. Apply the data model as a Prisma schema + first migration.
3. Build the ledger + greedy-simplify module **with unit tests** (cents invariant, multi-currency, revert).
4. Wire server-action auth gate (session OR share-token).
5. Build screens per `02-pages-and-flows.md`.
6. Seed the demo group.
