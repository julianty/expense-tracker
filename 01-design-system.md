# Design System — Splitwise-lite

**Aesthetic:** black & white, one accent, generous whitespace, flat surfaces. Think shadcn/ui defaults. **Use prebuilt shadcn components wherever possible** — write custom CSS only to fill gaps.

---

## 1. Color tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#FFFFFF` | page / surface |
| `--foreground` | `#0A0A0A` | primary text |
| `--muted` | `#F4F4F5` | secondary surface |
| `--muted-foreground` | `#71717A` | secondary text, hints |
| `--border` | `#E4E4E7` | borders, dividers |
| `--primary` (accent) | **`#C57C24`** | primary buttons, links, active states |
| `--primary-foreground` | `#FFFFFF` | text on accent |

### Reserved semantic colors — **never reused as accent**
| Meaning | Token | Value |
|---|---|---|
| You're owed / positive | `--owed` | `#15803D` (green) |
| You owe / negative | `--owe` | `#B91C1C` (red) |

Green and red carry ledger meaning only. The amber accent never appears on a balance figure.

Provide a dark-mode variant later (shadcn handles via CSS vars) — not required for v1.

---

## 2. Typography

shadcn default stack (Inter / system). Two weights: **400 regular, 500 medium**.

| Element | Size | Weight |
|---|---|---|
| h1 | 24px | 500 |
| h2 | 20px | 500 |
| h3 | 16px | 500 |
| body | 16px | 400 |
| small / meta | 13px | 400 |
| numbers (amounts) | tabular-nums | 500 |

Sentence case everywhere. Currency amounts use tabular figures so columns align.

---

## 3. shadcn components to lean on

| Need | shadcn component |
|---|---|
| Actions | `Button` (variants: default=accent, outline, ghost, destructive) |
| Containers | `Card`, `CardHeader`, `CardContent` |
| Forms | `Input`, `Label`, `Select`, `Textarea`, `Form` |
| Money entry | `Input` (type number) + `Select` for currency |
| Split mode | `Tabs` or `ToggleGroup` (equal / unequal / %) |
| Modals | `Dialog`, `AlertDialog` (confirm revert/settle) |
| Lists / feed | `Card` rows + `Separator` |
| Identity | `Avatar` (initials fallback) |
| Status | `Badge` (e.g. "demo", "you owe") |
| Nav | `Tabs` or simple header links |
| Feedback | `Sonner`/`Toast` (saved, reverted) |
| Empty/loading | `Skeleton` |

Links use accent color with underline-on-hover (shadcn `a` styling).

---

## 4. Component conventions

- **Cards:** white bg, 1px `--border`, `rounded-lg`, padding `16–20px`.
- **Buttons:** primary = accent fill; secondary = outline; destructive (revert/delete) = red outline, confirm via `AlertDialog`.
- **Balance chip:** green if owed, red if owe, neutral if settled. Never amber.
- **Expense row:** description + meta (payer · date) left, amount right; tap → expense detail.
- **Avatars:** initials on `--muted`; consistent per member.
- **Radius:** `rounded-md` controls, `rounded-lg` cards.
- **Spacing rhythm:** 4 / 8 / 12 / 16 / 24px.

---

## 5. Tone of voice
Short, plain, friendly. "You're owed $28." "Alex paid $84." Mirror Splitwise's minimal-effort, high-transparency feel.

---

*Hand this file to Claude Design alongside `02-pages-and-flows.md` to generate wireframes. The flows doc references the component names above.*
