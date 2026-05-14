# Build Spec — Siena Monday $26 Menu Editor

Read `README.md` first.

This doc tells you exactly what the editor for the Monday $26 menu can and can't change, what character limits to enforce, and the JSON shape the renderer reads.

---

## Data model

The menu data is a single JSON object. Its top-level shape:

```jsonc
{
  "hero": {
    "eyebrow":    "Monday Nights at Siena",
    "price":      "26",
    "tagline":    "for 26 Years in Austin",
    "meta_left":  "Two Courses",
    "meta_right": "Mondays Only"
  },
  "sections": {
    "course-1": {
      "title":    "Insalata o Zuppa",
      "subtitle": "Choose One",
      "items": [ /* 2 dishes */ ]
    },
    "course-2": {
      "title":    "Pasta",
      "subtitle": "Choose One",
      "items": [ /* 4 dishes */ ]
    }
  },
  "weekly": {
    "title": "Throughout the Week at Siena",
    "rows":  [ /* 4 rows */ ]
  },
  "policy_line": "<strong>No split checks.</strong> &nbsp;·&nbsp; <strong>Gratuity of 22% for parties of 6 or more.</strong>"
}
```

### Dish shape

```json
{
  "id":    "d-c2a1",
  "name":  "Cacio e Pepe",
  "desc":  "Fresh tagliatelle, Pecorino Romano, toasted cracked pepper",
  "price": ""
}
```

- `id` — opaque, stable, never displayed. Generated once per slot and never reused for a different dish. The template slot keeps its ID even when name/desc are completely changed.
- `price` — **optional**. The Monday menu is a fixed prix-fixe, so prices are blank in the seed. If you set a non-empty string (e.g. `"+8"` for an upcharge), the renderer adds a `.dish-price` element at the right of the row. Empty string = no price element rendered. Same field, two render states.

### Weekly row shape

```json
{
  "id":        "w-tue",
  "day_label": "Tuesdays",
  "headline":  "Tuesday at the Bar",
  "detail":    "$5 house wines and $10 premium wines. 4:30–6:30, bar, patio and cocktail areas only."
}
```

- `id` — opaque, stable. There are exactly four row slots: `w-tue`, `w-wed`, `w-thu`, `w-wknd`. **They are not semantic** (the editor can put Tuesday content into the `w-wed` slot if it wants), but their **count is fixed at 4** and their **left-to-right order in the rendered grid follows the JSON array order**.
- `day_label` — the small uppercase eyebrow, e.g. "Tuesdays", "Thu – Sat".
- `headline` — the italic mid-line, e.g. "Wine Lovers Wednesday".
- `detail` — the prose underneath.

### IDs

- Dish IDs and weekly-row IDs are stable opaque strings. They map 1:1 to fixed slots in `template.html`. **Don't generate new IDs for existing slots, don't remove slots, don't add slots.**
- Section IDs (`course-1`, `course-2`) are semantic and stable. Same rule — don't rename or add.

---

## Editable fields & character limits

The editor must enforce these character limits as **hard caps**. They were tuned against the 8.5×11 layout; exceeding them causes wrapping, column collision, or hero-line breakage.

### Hero block

| Field | JSON path | Max chars | Notes |
|---|---|---|---|
| Eyebrow | `hero.eyebrow` | **48** | Italic Playfair 13pt, one line. |
| Price (number only) | `hero.price` | **3** | Renders inside `$XX`. The `$` is template-static. Pure digits. `"26"`, `"100"` OK; `"26.50"` will break the big hero. |
| Tagline | `hero.tagline` | **38** | Italic Playfair 22pt, one line. Designed for "for 26 Years in Austin"-style phrasing. |
| Meta left | `hero.meta_left` | **22** | Bold Montserrat 10pt, uppercase, tracked. |
| Meta right | `hero.meta_right` | **22** | Same treatment. The ◆ between them is template-static. |

### Course sections (both `course-1` and `course-2` use the same rules)

| Field | JSON path | Max chars | Notes |
|---|---|---|---|
| Section title | `sections.<id>.title` | **24** | Italic Playfair 22pt. Shares a row with the subtitle; pushing past 24 squeezes the subtitle. |
| Section subtitle | `sections.<id>.subtitle` | **16** | Uppercase Montserrat 8.5pt with 0.22em tracking. Won't wrap (`white-space: nowrap`). |
| Dish name | `sections.<id>.items[*].name` | **30** | Italic Playfair 14pt. |
| Dish description | `sections.<id>.items[*].desc` | **140** | Regular Montserrat 10pt. Two lines comfortably. Beyond ~140 starts pushing column heights and visually crowds the weekly card below. |
| Dish price (optional) | `sections.<id>.items[*].price` | **6** | Bold Montserrat 11pt, right-aligned. Empty string = price element omitted. No `$` symbol — the design convention is bare numerals. |

### Weekly card

| Field | JSON path | Max chars | Notes |
|---|---|---|---|
| Card title | `weekly.title` | **42** | Italic Playfair 16pt, centered. |
| Day label | `weekly.rows[*].day_label` | **14** | Uppercase Montserrat 10pt, tracked. Use en-dash for ranges: "Thu – Sat". |
| Headline | `weekly.rows[*].headline` | **28** | Italic Playfair 13pt. |
| Detail | `weekly.rows[*].detail` | **130** | Regular Montserrat 10pt. Two to three lines per cell is the design target. |

### Footer

| Field | JSON path | Max chars | Notes |
|---|---|---|---|
| Policy line | `policy_line` | **120** | **HTML-allowed.** The renderer uses `innerHTML` for this field specifically. Sanitize to a small allowlist (`<strong>`, `<em>`) if you give managers a rich-text editor here. |

---

## Cardinality (fixed counts)

| Section | Count | Notes |
|---|---|---|
| `course-1` items (Insalata o Zuppa) | **2** | The two-dish column is sized for exactly 2 entries. |
| `course-2` items (Pasta) | **4** | The four-dish column is the layout's vertical anchor. |
| `weekly.rows` | **4** | The card is a four-column grid; the count drives the grid template. |

**The editor cannot add or remove items in any of these arrays.** If the owner wants a fifth pasta option or a fifth weekly cell, that's a design-level change — surface it as a request, don't try to make it editable.

---

## Static / non-editable template content

The following are baked into `template.html` and are NOT exposed to the editor:

- The literal `$` glyph in the hero (the price field is digits only).
- The `◆` diamond separator between `hero.meta_left` and `hero.meta_right`.
- The horizontal gold rules above and below the price (`.price-rule`).
- The gold underline beneath each course title.
- The vertical dividers between weekly cells (`.weekly-cell` `border-left`).
- The masthead with the restaurant name and city — **deliberately omitted** from this menu (it slides into a hard menu cover that shows branding externally).
- All CSS, fonts, page break behavior, page padding, and the weekly card's inset margins.

If a manager asks to bring back the restaurant-name header or change colors, that's an owner-level decision.

---

## What the editor can change

| Editable | JSON path |
|---|---|
| Hero eyebrow | `hero.eyebrow` |
| Hero price | `hero.price` |
| Hero tagline | `hero.tagline` |
| Hero meta left | `hero.meta_left` |
| Hero meta right | `hero.meta_right` |
| Course section title | `sections.<id>.title` |
| Course section subtitle | `sections.<id>.subtitle` |
| Dish name | `sections.<id>.items[*].name` |
| Dish description | `sections.<id>.items[*].desc` |
| Dish price (optional) | `sections.<id>.items[*].price` |
| Dish order within section | `sections.<id>.items` array order |
| Weekly card title | `weekly.title` |
| Weekly day label | `weekly.rows[*].day_label` |
| Weekly headline | `weekly.rows[*].headline` |
| Weekly detail | `weekly.rows[*].detail` |
| Weekly row order | `weekly.rows` array order |
| Policy line | `policy_line` |

## What the editor CANNOT change

- Number of sections (always two: `course-1`, `course-2`)
- Number of items per section (always 2 and 4)
- Number of weekly rows (always 4)
- Section IDs, dish IDs, weekly row IDs
- Which section a dish belongs to (no cross-section moves)
- Any CSS, font, color, or layout property
- The `$` symbol, the diamond, the rules, the weekly card border

---

## Editor UI sketch

Two-pane layout:

```
┌────────────────────────┬─────────────────────────────────────┐
│ EDITOR PANE            │ PREVIEW PANE (iframe → /preview)    │
│ ─ Hero                 │                                     │
│   [eyebrow]            │   [ live rendered single-page menu, │
│   [price]              │     same way the file renders in    │
│   [tagline]            │     screen mode ]                   │
│   [meta L] [meta R]    │                                     │
│ ─ Course 1: Insalata   │                                     │
│   [title]  [subtitle]  │                                     │
│     ≡ Caesar Salad     │                                     │
│       [name] [desc]    │                                     │
│       [price (opt)]    │                                     │
│     ≡ Soup of the Day  │                                     │
│       …                │                                     │
│ ─ Course 2: Pasta      │                                     │
│   [title]  [subtitle]  │                                     │
│     ≡ Cacio e Pepe     │                                     │
│     ≡ Carbonara        │                                     │
│     ≡ Amatriciana      │                                     │
│     ≡ Pasta alla Gricia│                                     │
│ ─ Throughout the Week  │                                     │
│   [card title]         │                                     │
│     ≡ Tuesdays         │                                     │
│       [day][headline]  │                                     │
│       [detail]         │                                     │
│     ≡ Wednesdays  …    │                                     │
│ ─ Policy line          │                                     │
│                        │                                     │
│ [Save]  [Print Menu]   │                                     │
└────────────────────────┴─────────────────────────────────────┘
```

- Each section is collapsible. Default state: first section open, rest collapsed.
- Drag handle (`≡`) reorders items within a course or weekly rows within the grid. Drag is blocked across section boundaries.
- Show the character counter for every text field, turning red as the user nears the cap. **Block save** when any field exceeds its cap.
- Auto-save with ~1s debounce after last keystroke. Show a "Saved" indicator.
- "Print Menu" opens `/print` in a new tab.

Live preview updates on every edit (debounced ~200–500ms). Either reload the iframe or postMessage the new JSON in and have the iframe re-call `render()`.

---

## The `/print` page

Identical to `/preview`, plus this script at the end of `<body>`:

```html
<script>
  document.fonts.ready.then(() => {
    setTimeout(() => window.print(), 500);
  });
</script>
```

Matches the original print HTML's behavior. The 500ms delay gives variable fonts time to settle. **Do not skip `document.fonts.ready`** — printing before fonts load is the most common way to ship a broken menu.

---

## Snapshot test

`snapshot-test.spec.js` is the safety net. It does this:

1. Load `template.html`.
2. Load `menu-data.json`.
3. Run `render(parsedTemplate, menuData)`.
4. Compare the serialized output to `expected-render.html` (whitespace normalized).
5. Fail loudly if they differ, with the first diff location.

This proves: given the seed data, the renderer reproduces the canonical menu exactly. If any developer (or AI) changes `template.html`'s structure, `render.js`'s logic, or `expected-render.html` without keeping all three in sync, this test fails.

**Wire it into CI. Block merges on test failure.**

When the seed JSON is intentionally updated (e.g., owner asks to change a pasta), the workflow is:

1. Edit `menu-data.json`.
2. Run `render()` on it and overwrite `expected-render.html` with the result.
3. Commit both files together.
4. Test passes again because the new expected matches the new render output.

---

## Edge cases & gotchas

- **Hero price field accepts digits only.** Reject `"26.50"`, `"$26"`, `"twenty-six"`. The visible `$` is in the template; the field is the numeric portion. If the owner wants to advertise `$26.50`, that's a design-level conversation.

- **Weekly row IDs are slots, not semantics.** `w-tue` is not "Tuesday." It's slot 1. The editor may put anything in slot 1. The slot doesn't move; the array order does.

- **`detail` text on weekly cells is plain text.** No HTML allowed. If a manager wants bold or italic inside a detail, that's an out-of-band request.

- **`policy_line` is HTML.** It's the one exception. Sanitize on input.

- **Special characters:** preserve curly quotes (`’`), en/em dashes (`–`, `—`), and middle dots (`·`). Don't ASCII-fold on save.

- **Empty values:** never allow an empty `hero.price`, empty section title, empty dish name, empty dish description, empty weekly `day_label`, empty weekly `headline`, or empty weekly `detail`. `dish.price` is the only field that can legitimately be empty.

- **Saving:** validate the JSON against a schema (Zod, JSON Schema, etc.) before writing. Reject malformed updates.

- **Reorder must persist:** when the manager drags a dish or a weekly cell to reorder and saves, the new order is the new canonical order across every subsequent preview, print, and edit session.

---

## What "done" looks like

- Editor loads, all current Monday menu content correctly populated.
- Manager edits a pasta description → preview updates within ~1 second.
- Manager drags Cacio e Pepe below Carbonara → preview reflects new order → save → reload → new order persists.
- Manager clicks "Print Menu" → new tab → single-page menu loads → print dialog opens → Save as PDF produces a PDF visually identical to printing `Monday $26 Menu.html` from the owner's machine.
- Snapshot test passes in CI.
- Owner can demo to a manager in 3 minutes.
