# Claude Design Brief — Splitwise-lite: Flows & Pages

Build wireframes for a web-only expense-splitting app (Splitwise clone). 11 screens total. Follow the priority order below. Design system is in `design.md` — apply it to every screen.

---

## Wireframe priority

1. Group detail — the hub all flows pass through
2. Add/edit expense — most complex form
3. Settle up
4. Group list (home)
5. Activity feed
6. Auth
7. Share-link entry
8. Landing/demo
9. Expense detail
10. Create/edit group
11. Group settings

---

## Screens

---

### 1. Landing / demo preview — `/`

**Purpose:** Marketing page + live embedded preview of a demo group. Two entry points.

**Layout:**
- Full-width hero: one-line tagline + two buttons side by side — "Sign in" (outline) and "Try the demo" (primary/accent fill)
- Below hero: embedded read-only preview of the Group detail screen (screen 4) populated with seed data — label it with a "demo" badge
- The preview is a visual teaser, not interactive

**Components:** Card, Button (primary + outline), Badge ("demo")

**Connects to:** `/login` (Sign in), `/groups/demo` (Try the demo)

---

### 2. Auth — `/login`

**Purpose:** Single screen handles both sign-in and share-link explanation.

**Layout:**
- Centered Card, max-width ~400px
- Tabs inside the card: **Account** | **Have a link?**
  - Account tab: Email input, Password input, "Sign in" button (primary). Link below: "Don't have an account? Sign up"
  - Have a link? tab: Short explanatory text ("Paste your group link or open it directly from your browser"), a URL input field, "Go" button
- No sidebars, no distractions

**Components:** Card, Tabs, Input, Label, Button

**Connects to:** `/groups` (on success), `/g/{token}` (via link entry)

---

### 3. Share-link entry — `/g/{token}`

**Purpose:** Anyone with the group link claims a name slot to participate.

**Layout:**
- Centered Card, max-width ~440px
- Heading: group name at top
- "Who are you in this group?" prompt
- Dropdown Select: list of unclaimed member slots (e.g. "Alex", "Bo", "Cam") + an "Add myself…" option at the bottom
- If "Add myself…" is selected: text Input appears for entering a new display name
- "Join group" button (primary)

**Components:** Card, Select, Input, Button, Avatar (show member initials in the dropdown options)

**Connects to:** `/groups/{id}` (after claiming slot)

---

### 4. Group list — `/groups`

**Purpose:** Signed-in home screen. Lists all groups the user belongs to.

**Layout:**
- Page header: "Your groups" + "New group" button (outline) top right
- List of Card rows, one per group:
  - Left: group name (medium weight) + member avatars (stacked, max 4 then "+N")
  - Right: net balance chip — green if owed, red if owe, neutral/"settled" if zero
- Empty state: centered prompt ("No groups yet") + "Create a group" button and "Or try the demo →" link

**Components:** Card, Avatar, Badge (balance chip), Button, Skeleton (loading)

**Connects to:** `/groups/{id}` (tap row), `/groups/new` (New group)

---

### 5. Create / edit group — `/groups/new` and `/groups/{id}/settings`

**Purpose:** Create a new group or edit an existing one.

**Layout:**
- Single-column form in a Card, max-width ~560px
- Fields (top to bottom):
  1. Group name — Input
  2. Base currency — Select (USD, EUR, GBP, etc.)
  3. Simplify debts — Switch with label "Simplify debts" and subtext "Reduce the number of payments needed to settle up"
  4. Members — repeating row: Avatar (initials) + Input (display name) + remove icon button. "Add member" ghost button below
- Footer: "Create group" (primary) / "Save changes" on edit. On create, a success Toast appears with the share link and a copy button.

**Components:** Input, Select, Switch, Button (primary + ghost + icon), Avatar, Toast/Sonner

**Connects to:** `/groups/{id}` (after save)

---

### 6. Group detail — `/groups/{id}` ← the hub

**Purpose:** Central screen. Shows balances, expense feed, and all primary actions.

**Layout:**
- Page header:
  - Left: group name (h1) + base currency badge
  - Right: share link copy button (icon + "Copy link") + settings gear icon
- **Balances section** (below header):
  - Per-member row: Avatar + name + net balance chip (green if owed, red if owe)
  - "Settle up" button (outline) at bottom of section
- **Tabs** (below balances): Expenses | Activity
  - **Expenses tab** (default): reverse-chronological Card rows
    - Each row: description (medium) left + payer · date (muted, small) below description + amount right
    - Tap row → expense detail
  - **Activity tab**: audit log feed (see screen 10)
- Floating "+" / "Add expense" button fixed bottom-right

**Components:** Card, Tabs, Avatar, Badge (balance chip + currency), Button, Separator

**Connects to:** `/groups/{id}/expense/new`, `/groups/{id}/settle`, `/groups/{id}/activity`, `/groups/{id}/settings`, expense rows → `/groups/{id}/expense/{id}`

---

### 7. Add / edit expense — `/groups/{id}/expense/new` and `/groups/{id}/expense/{id}/edit`

**Purpose:** The core form. Captures amount, payers, split, currency, receipt.

**Layout (single column, scrollable):**

1. **Description** — Input, full width, placeholder "What was this for?"
2. **Amount + currency row** — Amount Input (large, number) + Currency Select inline
3. **FX rate row** — conditionally shown only when currency ≠ group base currency:
   - "Today's rate: 1 USD = 0.92 EUR" + editable Input for rate override
4. **Paid by** — "Who paid?" label + one Select per payer slot. If multiple payers: "+ Add payer" ghost link reveals a second row with member Select + amount Input
5. **Split mode** — ToggleGroup: Equal | Unequal | %
   - Equal: no extra inputs, auto-divides
   - Unequal: amount Input per member (inline list)
   - Percentage: % Input per member (inline list)
   - Live validation chip below: "Splits balance ✓" in green, or "$0.02 remaining" in red
6. **Date** — date Input, defaults to today
7. **Note** — Textarea (optional)
8. **Receipt** — file upload button ("Attach receipt"), shows thumbnail if image selected
9. Footer: "Save expense" (primary) + "Cancel" (ghost)

**Components:** Input, Select, ToggleGroup (Tabs), Textarea, Button, Badge (validation chip), file upload

**Connects to:** `/groups/{id}` (on save/cancel)

---

### 8. Expense detail — `/groups/{id}/expense/{id}`

**Purpose:** Read-only view of one expense. Entry point for edit and revert.

**Layout:**
- Card, max-width ~560px
- Header: description (h2) + date (muted)
- **Paid by section:** Avatar + name + amount for each payer
- **Owes section:** per-member row — Avatar + name + amount owed (positive = owes, negative = is owed)
- If receipt image: thumbnail, full-width, tappable to expand
- If note: italic text block
- Footer buttons:
  - "Edit" (outline)
  - "Undo" (destructive outline, red) — labeled "Undo" for own expense, "Revert" for admin reverting another's. Clicking opens AlertDialog to confirm.

**Components:** Card, Avatar, Button (outline + destructive), AlertDialog

**Connects to:** `/groups/{id}/expense/{id}/edit`, back to `/groups/{id}`

---

### 9. Settle up — `/groups/{id}/settle`

**Purpose:** Show simplified payment suggestions. Record a manual payment.

**Layout:**
- Heading: "Settle up"
- List of payment suggestion Cards:
  - Each: "Charlie pays Alex $15" — Avatar (Charlie) → arrow → Avatar (Alex) + amount
  - "Record payment" button (outline) on each row
- Clicking "Record payment" opens a confirmation AlertDialog: "Confirm: Charlie paid Alex $15" + "Confirm" (primary) + "Cancel"
- On confirm: Toast "Payment recorded", balance updates

**Components:** Card, Avatar, Button (outline), AlertDialog, Toast/Sonner

**Connects to:** back to `/groups/{id}` (after recording)

---

### 10. Activity feed — `/groups/{id}/activity`

**Purpose:** Append-only audit log of every action in the group.

**Layout:**
- Reverse-chronological list of rows, separated by Separators
- Each row:
  - Left: Avatar (actor) + action text (e.g. "Alex added 'Dinner' · $84.00") + timestamp (muted, small)
  - Right: "Revert" button (ghost, small) — shown only if the acting user owns the entry OR is the group admin. Clicking opens AlertDialog.
- Badge variants: "expense", "settlement", "revert" to tag entry type

**Components:** Avatar, Separator, Badge, Button (ghost/small), AlertDialog

**Connects to:** expense entries → `/groups/{id}/expense/{id}`

---

### 11. Group settings — `/groups/{id}/settings`

**Purpose:** Edit group metadata, manage member slots, regenerate share link.

**Layout (sections separated by Separators):**

1. **Group info** — same form as Create group (name, currency, simplify-debts switch) with a "Save" button
2. **Share link** — current link displayed in a read-only Input + "Copy" icon button + "Regenerate" link (destructive, opens AlertDialog to confirm)
3. **Members** — list of member slots: Avatar + display name + "claimed by {email}" or "unclaimed" badge + remove button (admin only, opens AlertDialog)
4. **Danger zone** — "Delete group" button (destructive), AlertDialog confirm

**Components:** Input, Select, Switch, Button, Separator, Badge, AlertDialog, Avatar

**Connects to:** `/groups/{id}` (back)

---

## Key flows

Use these to generate flow diagrams or annotated transitions between screens.

---

### Flow A — New user via share link

```
/g/{token}
  → claim member slot (Screen 3)
  → Group detail (Screen 6)
  → Add expense (Screen 7)
  → balances update on Group detail
```

---

### Flow B — Add an expense (happy path)

```
Group detail (Screen 6)
  → tap "+ Add expense"
  → Add expense form (Screen 7)
  → fill description, amount, currency, payers, split mode
  → validation chip shows "Splits balance ✓"
  → tap "Save expense"
  → Toast "Expense saved"
  → back to Group detail — feed + balances updated
  → audit entry written (visible in Activity tab)
```

---

### Flow C — Settle up

```
Group detail (Screen 6)
  → tap "Settle up"
  → Settle up screen (Screen 9): simplified payment list
  → tap "Record payment" on one row
  → AlertDialog confirm
  → Toast "Payment recorded"
  → back to Group detail — balances updated
  → audit entry written
```

---

### Flow D — Undo / revert an expense

```
Group detail (Screen 6) → tap expense row
  → Expense detail (Screen 8)
  → tap "Undo" / "Revert"
  → AlertDialog: "This will reverse the expense and restore prior balances. Continue?"
  → confirm
  → Toast "Expense reverted"
  → back to Group detail — balances restored
  → new "revert" audit entry written in Activity feed
```

---

### Flow E — Multi-currency expense

```
Add expense form (Screen 7)
  → enter amount
  → change Currency Select to non-base currency (e.g. EUR when group is USD)
  → FX rate row appears: "Today's rate: 1 USD = 0.92 EUR"
  → user can edit rate inline
  → on save: rate stored on expense; amount converted to base cents before netting
```
