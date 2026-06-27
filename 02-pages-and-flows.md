# Pages & Flows — Splitwise-lite

Map of every screen and the flows connecting them. Component names reference `01-design-system.md` (shadcn) so this can be fed into **Claude Design** to generate wireframes.

---

## Screen inventory

### 1. Landing / Demo preview  `/`
Marketing + live **demo group** (seeded, read-only-ish) doubling as a tutorial.
- Hero: one line + two `Button`s — "Sign in" / "Try the demo".
- Embedded preview of a group balance view using seed data.
- Components: `Card`, `Button`, `Badge` ("demo").

### 2. Auth  `/login`
Two doors, one screen.
- `Tabs`: **Account** (email + password `Input`s, `Button`) | **Have a link?** (paste/`/g/{token}` explainer).
- Components: `Card`, `Tabs`, `Input`, `Label`, `Button`.

### 3. Share-link entry  `/g/{token}`
Anyone with the link lands here.
- "Who are you in this group?" → `Select` an existing unclaimed slot **or** add your name → claims a `GroupMember`.
- Then routes to Group detail.
- Components: `Card`, `Select`, `Input`, `Button`, `Avatar`.

### 4. Group list (home, signed in)  `/groups`
- List of `Card` rows: group name, your net balance chip (green/red/neutral), member avatars.
- `Button` "New group".
- Empty state: `Skeleton` / prompt to create or open demo.

### 5. Create / edit group  `/groups/new`
- `Input` name, `Select` base currency, toggle **simplify debts** (`Switch`), member name slots (add/remove rows).
- On save → share link generated, shown with copy `Button` + `Toast`.

### 6. Group detail  `/groups/{id}`  ← the hub
- Header: group name, base currency, **share link** copy button, settings gear.
- **Balances summary**: per-member net (green owed / red owe), plus "Settle up" `Button`.
- **Expense feed**: reverse-chron `Card` rows (description, payer · date, amount). Tap → expense detail.
- Floating `Button` "+ Add expense".
- `Tabs` or sections: Balances · Expenses · Activity.

### 7. Add / edit expense  `/groups/{id}/expense/new`
The core form.
- `Input` description, amount, `Select` currency.
- **FX rate row** (only if currency ≠ base): shows *today's* rate as suggestion, editable `Input`.
- Paid by: `Select`/multi (supports >1 payer → amounts).
- Split mode: `ToggleGroup` **Equal | Unequal | Percentage**.
  - Equal → auto-divide.
  - Unequal → amount `Input` per member (must sum to total).
  - Percentage → % `Input` per member (must sum to 100).
- Live validation chip: "splits balance ✓" / "$0.02 left".
- Date `Input`, note `Textarea`, **image upload** (receipt photo, no scan in v1).
- Save → `Toast`, back to group.

### 8. Expense detail  `/groups/{id}/expense/{id}`
- Read view: who paid, who owes, image, note.
- `Button`s: Edit · **Undo/Revert** (own → undo; admin → revert anyone) via `AlertDialog`.

### 9. Settle up  `/groups/{id}/settle`
- Shows **simplified payments** (greedy): "Charlie pays Bob $5", "Charlie pays Alex $15".
- Record a payment → `Settlement` row, `AlertDialog` confirm, `Toast`.
- Components: `Card`, `Button`, `AlertDialog`.

### 10. Activity feed  `/groups/{id}/activity`
- Append-only `audit_log` timeline: actor, action, time. Git-like trace.
- Each entry: **Revert** (`AlertDialog`) where permitted.
- Components: `Card`, `Separator`, `Badge`, `Button`.

### 11. Group settings  `/groups/{id}/settings`
- Rename, base currency, simplify-debts toggle, regenerate share link, manage member slots, (admin) revert controls.

---

## Key flows

**A. New user via share link**
`/g/{token}` → claim slot → Group detail → Add expense → balances update.

**B. Add an expense**
Group detail → "+ Add expense" → fill form → pick split mode → validation passes → save → feed + balances update → audit entry written.

**C. Settle up**
Group detail → "Settle up" → view simplified payments → record payment → balances update → audit entry.

**D. Undo / revert**
Activity (or expense detail) → Revert → `AlertDialog` confirm → inverse applied → new audit entry → balances recompute.

**E. Multi-currency expense**
Add expense → choose non-base currency → today's rate shown → user edits rate if desired → stored on expense → netted into base cents.

---

## Wireframe priority (for Claude Design)
1. Group detail (6) — the hub
2. Add/edit expense (7) — most complex form
3. Settle up (9)
4. Group list (4)
5. Activity feed (10)
6. Auth (2) + Share-link entry (3)
7. Landing/demo (1)
