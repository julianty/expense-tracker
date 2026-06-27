# Design system — Splitwise-lite

Complete design reference for Claude Design wireframe generation. Apply every rule on every screen.

---

## 1. Aesthetic

Black and white, one amber accent, generous whitespace, flat surfaces. shadcn/ui defaults extended with two reserved semantic colors (green, red) for ledger meaning. No gradients, no drop shadows, no decorative effects.

---

## 2. Color tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#FFFFFF` | Page / surface |
| `--foreground` | `#0A0A0A` | Primary text |
| `--muted` | `#F4F4F5` | Secondary surface, empty states |
| `--muted-foreground` | `#71717A` | Secondary text, hints, timestamps |
| `--border` | `#E4E4E7` | All borders and dividers |
| `--primary` | `#C57C24` | Primary buttons, active states, links |
| `--primary-foreground` | `#FFFFFF` | Text on primary/accent fill |

### Reserved semantic colors — never repurposed as accent

| Meaning | Token | Value | Usage |
|---|---|---|---|
| Owed to you / positive | `--owed` | `#15803D` | Net balance when the member is owed money |
| You owe / negative | `--owe` | `#B91C1C` | Net balance when the member owes money |
| Settled / neutral | — | `--muted-foreground` | Zero balance |

**Rule:** Green and red appear only on balance figures and balance chips. The amber accent never appears on a balance. This prevents color confusion — amber means "action", green means "you're owed", red means "you owe."

---

## 3. Typography

Font stack: Inter / system-ui. Two weights only: 400 regular, 500 medium. Never 600 or 700.

| Element | Size | Weight | Notes |
|---|---|---|---|
| h1 (page title) | 24px | 500 | Group name, page headings |
| h2 (section / card title) | 20px | 500 | Expense description in detail view |
| h3 (subsection label) | 16px | 500 | Section headers within cards |
| Body | 16px | 400 | Default text |
| Small / meta | 13px | 400 | Timestamps, payer name, secondary info |
| Currency amounts | any | 500 | Always tabular-nums so columns align |

Sentence case everywhere. No title case, no all-caps.

---

## 4. Spacing and radius

Spacing rhythm: 4 / 8 / 12 / 16 / 24px.

| Context | Value |
|---|---|
| Control radius (inputs, buttons, badges) | `rounded-md` (6px) |
| Card radius | `rounded-lg` (12px) |
| Card padding | 16–20px |
| Section gap within a card | 12–16px |

---

## 5. Components

### Buttons

| Variant | Style | When to use |
|---|---|---|
| Primary | Amber fill (`--primary`), white text | One per screen — the main CTA ("Save expense", "Join group") |
| Outline | White bg, `--border` border, foreground text | Secondary actions ("Settle up", "Edit", "Copy link") |
| Ghost | No border, no bg, foreground text | Low-priority actions ("Cancel", "Add member") |
| Destructive | White bg, red border, red text | Irreversible actions ("Undo", "Revert", "Delete group") — always followed by AlertDialog |

### Cards

White background, 1px `--border`, `rounded-lg`, 16–20px padding. Used for: grouped form sections, list rows, detail views, expense rows in the feed.

### Inputs

36px height. Full border on all sides, `rounded-md`. Placeholder text in `--muted-foreground`. Focus ring: 2px amber (`--primary`).

### Avatars

Initials-based fallback. Background: `--muted`. Text: `--foreground`. Consistent color per member (derive from name hash — same person always gets the same color). Sizes: 32px inline, 40px in detail views.

### Balance chip / badge

Inline badge showing a member's net balance.
- Owed: green background tint, green text, e.g. "Owed $28.00"
- Owes: red background tint, red text, e.g. "Owes $14.50"
- Settled: muted background, muted text, "Settled"

Never use amber for balance figures.

### Tabs

Used in: Auth screen (Account / Have a link?), Group detail (Expenses / Activity), Add expense split mode (Equal / Unequal / %). Active tab indicator: amber underline or amber text.

### ToggleGroup (split mode selector)

Pill-style toggle: Equal | Unequal | %. Active selection: amber fill, white text. Inactive: outline.

### AlertDialog (confirm destructive actions)

Used before: revert/undo, settle-up payment, delete group, regenerate share link. Two-button footer: "Confirm" (primary/destructive) + "Cancel" (ghost). Body text explains the consequence, e.g. "This will reverse the expense and restore prior balances."

### Toast / Sonner

Bottom-right notification. Appears after: save, revert, copy link, payment recorded. Short text only — no more than one line. Auto-dismisses after ~3s.

### Skeleton

Used during loading states. Replaces Cards and rows with gray placeholder shapes of the same dimensions.

### Separator

1px horizontal rule in `--border`. Used between sections in: activity feed rows, settings page sections, card internal sections.

---

## 6. Expense row (feed)

Each expense in the Group detail feed:

```
[Avatar] Description                    $84.00
         Alex · Jun 14
```

- Description: body weight (400), foreground
- Payer + date: small (13px), `--muted-foreground`
- Amount: 500 weight, tabular-nums, right-aligned
- Full row is tappable → Expense detail

---

## 7. Balance row (group detail)

Each member's net position:

```
[Avatar] Alex            Owed $28.00   (green)
[Avatar] Bo              Owes $14.50   (red)
[Avatar] Cam             Settled       (muted)
```

---

## 8. FX rate row (add expense)

Conditionally shown only when expense currency ≠ group base currency:

```
Today's rate: 1 USD = [0.92] EUR    ← editable input
```

Gray helper text on left. Editable Input on right, pre-filled with today's fetched rate. User can override.

---

## 9. Split validation chip

Appears below the split mode inputs in the add expense form:

- Valid: green chip — "Splits balance ✓"
- Invalid: red chip — "$0.02 remaining" or "$1.00 over"

Updates live as user types. Blocks save when invalid.

---

## 10. Navigation model

No persistent sidebar. Navigation is page-based with in-page back links or breadcrumbs.

Typical header pattern:
```
← Back to {group name}        [action buttons]
```

Group detail is the hub — most flows return to it after completion.

---

## 11. Empty states

Short, action-oriented. No "Nothing here yet."

| Screen | Empty state |
|---|---|
| Group list | "No groups yet. Create one or try the demo." |
| Expense feed | "No expenses yet. Add the first one." |
| Activity feed | "No activity yet." |
| Settle up | "Everyone's settled up." |

---

## 12. Tone of voice

Short, plain, friendly. Mirror Splitwise's minimal-effort, high-transparency feel.

- Use contractions: "you're owed", "can't undo"
- Sentence case everywhere
- Amounts always show 2 decimal places: "$28.00", not "$28"
- Describe actions simply: "Alex added 'Dinner' · $84.00 · Jun 14"
- Error messages say what happened and what to do: "Splits don't add up. $0.50 is unassigned."

---

## 13. Screen-level rules

| Screen | Key rules |
|---|---|
| Landing | One primary CTA ("Try the demo"). Demo preview read-only, labeled with Badge. |
| Auth | Centered card, max ~400px. No logo beyond app name. |
| Group list | Balance chip on every row — never omit. Avatars stacked, max 4. |
| Group detail | Balances section always visible above tabs. Floating "+" stays bottom-right. |
| Add expense | FX row appears/disappears based on currency match. Validation chip always visible when split inputs are shown. |
| Expense detail | Revert button is destructive style. Admin sees "Revert", owner sees "Undo". |
| Settle up | Each suggestion row has its own "Record payment" — don't collapse into one bulk action. |
| Activity feed | Every entry has a timestamp. Revert only shown where permitted. |
| Settings | Danger zone visually separated at the bottom with a Separator. |
