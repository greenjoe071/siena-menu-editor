# Build Spec — Siena Weekend Specials Menu Editor

Read `README.md` first.

This doc tells you exactly what the editor for the Weekend Specials menu
(*Specialità del Capo Cuoco* — Chef's Suggestions, Thu–Sat) can and can't
change, what character limits to enforce, and the JSON shape `render.js`
reads.

The Weekend menu is a **recurring template**. The chef changes the
dishes every weekend. The hero/masthead and the weekly footer are stable;
the two dish sections are not.

---

## What's different from the Monday menu

| Aspect | Monday menu | Weekend menu |
|---|---|---|
| Hero/masthead | Editable (price, eyebrow, tagline, meta) | **Static** — not in the data model, never editable |
| Section dish counts | **Fixed** (2 + 4) | **Variable, 1–4 per section** |
| Dish prices | Optional (blank by default — prix fixe) | **Required** on every dish |
| Weekly footer rows | 4 (Tue / Wed / Thu / Thu–Sat) | 4 (Mon / Tue / Wed / Thu — no Weekend row) |
| Renderer behavior | Updates fixed dish slots in place | Rebuilds each `.dish-grid` from `<template id="dish-template">` |

Don't copy/paste the Monday editor onto this menu — the cardinality
contract is fundamentally different. See "Renderer behavior", below.

---

## Data model

The menu data is a single JSON object. Its top-level shape:

```jsonc
{
  "sections": {
    "starters": {
      "title":    "Antipasti",
      "subtitle": "Starters",
      "items":    [ /* 1..4 dishes */ ]
    },
    "entrees": {
      "title":    "Secondi",
      "subtitle": "Entrees",
      "items":    [ /* 1..4 dishes */ ]
    }
  },
  "dessert": {                  // OPTIONAL — omit or set null to hide.
    "title": "Dolci",            //                   Exactly one dish when present.
    "name":  "Torta della Nonna",
    "desc":  "…",
    "price": "$12"
  },
  "weekly": {
    "title": "Throughout the Week at Siena",
    "rows":  [ /* 4 rows */ ]
  },
  "policy_line": "<strong>Sorry, no split orders.</strong> &nbsp;·&nbsp; <strong>Standard gratuity 22% for parties of 6 or more.</strong>"
}
```

There is **no `hero` key.** The hero block is fully static in
`template.html` and is intentionally not exposed to the editor.

The top-level **`dessert` key is optional**. When it is absent, `null`,
or missing entirely from the JSON, the renderer removes the entire
dessert section from the DOM — the rendered page then looks identical
to the pre-dessert layout (two sections + weekly footer). When it is
present, it holds exactly one dish; see "Dessert shape" below.

### Dessert shape

```json
{
  "title": "Dolci",
  "name":  "Torta della Nonna",
  "desc":  "Custard cream and pine nut tart, lemon zest, powdered sugar.",
  "price": "$12"
}
```

- `title` — the Playfair italic section head. Editable: e.g. "Dolci",
  "Sweet Endings", "Dessert & Coffee". Treated as the on/off label for
  the section in the editor.
- `name` / `desc` — same shape and styling as a dish in starters/entrees.
- `price` — **required when `dessert` is present.** Same `$` glyph
  convention as the dish prices in starters/entrees: `"$12"`, not
  `"12"`. The renderer prints the value verbatim.
- There is no `id` field. The dessert dish slot is the single stable
  slot `data-dish-id="d-dessert"`, baked into the template alongside
  the weekly-row slot IDs — not in the data model.

### Dish shape

```json
{
  "id":    "d-s1",
  "name":  "Burrata e Pèsca",
  "desc":  "Peach burrata salad, fresh basil, extra virgin olive oil, fresh cracked pepper, baby heirloom tomato salad.",
  "price": "$17"
}
```

- `id` — opaque, stable, never displayed. Generated once per dish entry
  and never reused for a different dish. When a chef rotates a starter
  out, generate a new ID for the replacement rather than recycling the
  old one. Existing IDs persist across edits to that same dish's
  name / desc / price.
- `price` — **required**. Non-empty string. The design convention on
  this menu is to include the `$` glyph (`"$17"`, `"$48"`). Don't store
  bare numerals — the renderer prints the price verbatim.

### Section shape

Each section has a `title` (the Playfair italic head, e.g.
"Antipasti"), a `subtitle` (the small uppercase Montserrat eyebrow on
the same row, e.g. "Starters"), and an `items` array of **1 to 4**
dishes.

Section IDs are stable and fixed: there are exactly two sections,
`starters` and `entrees`, in that order. The editor cannot add a third
section, rename either of them, or reorder them.

### Weekly row shape

```json
{
  "id":        "w-mon",
  "day_label": "Mondays",
  "headline":  "$26 for 26 Years",
  "detail":    "Two courses for $26 — salad or soup, then a fresh pasta of your choice."
}
```

- `id` — opaque, stable. There are exactly four row slots: `w-mon`,
  `w-tue`, `w-wed`, `w-thu`. **They are not semantic** (the editor can
  put Tuesday content into the `w-wed` slot if it wants), but their
  **count is fixed at 4** and their **left-to-right order in the
  rendered grid follows the JSON array order**.
- `day_label` — the small uppercase eyebrow, e.g. "Mondays".
- `headline` — the italic mid-line, e.g. "Wine Lovers Wednesday".
- `detail` — the prose underneath.

> **Note:** This menu's weekly footer intentionally has no "Weekend
> Specials" row — that promo IS this menu, so listing it would be
> redundant. The four rows are Monday's $26 pasta night, Tuesday at the
> Bar, Wine Lovers Wednesday, and Thirsty Thursday.

### IDs

- **Dish IDs** are stable opaque strings the editor mints when it
  creates a new dish slot. They land on the rendered DOM as
  `data-dish-id="…"` so the editor can target a specific dish element.
- **Weekly-row IDs** (`w-mon` through `w-thu`) are baked into the
  template — don't rename or add.
- **Section IDs** (`starters`, `entrees`) are baked into the template —
  don't rename or add.

---

## Editable fields & character limits

The editor must enforce these character limits as **hard caps**. They
were tuned against the 8.5×11 single-page layout; exceeding them causes
wrapping, column collision, or page overflow into the hard-cover
inset.

### Hero block

**Not editable.** No fields. The hero/masthead is template-static and
the editor must not surface any controls for it.

### Course sections (both `starters` and `entrees`)

| Field | JSON path | Max chars | Notes |
|---|---|---|---|
| Section title | `sections.<id>.title` | **20** | Italic Playfair 22pt. Shares a row with the subtitle; pushing past 20 squeezes the subtitle. |
| Section subtitle | `sections.<id>.subtitle` | **16** | Uppercase Montserrat 8.5pt with 0.22em tracking. Won't wrap (`white-space: nowrap`). |
| Dish name | `sections.<id>.items[*].name` | **30** | Italic Playfair 16pt. |
| Dish description | `sections.<id>.items[*].desc` | **140** | Regular Montserrat 10pt, `text-wrap: pretty`. Two to three lines comfortably. Beyond ~140 starts pushing column heights and may visually crowd the weekly footer below. |
| Dish price | `sections.<id>.items[*].price` | **8** | Italic Playfair 11pt, gold. Required, non-empty. Include the `$` glyph: `"$17"`. |

### Dessert (optional)

When the `dessert` key is absent or null on the menu JSON, the whole
section is removed from the DOM and these fields are not editable.
When the key is present, every field below is **required** and must
respect its cap.

| Field | JSON path | Max chars | Notes |
|---|---|---|---|
| Section title | `dessert.title` | **20** | Italic Playfair 22pt. Same cap and styling as `sections.<id>.title`. Defaults to `"Dolci"`; common alternates are `"Sweet Endings"`, `"Dessert & Coffee"`. |
| Dish name | `dessert.name` | **30** | Italic Playfair 16pt. Same cap as `sections.<id>.items[*].name`. |
| Dish description | `dessert.desc` | **140** | Regular Montserrat 9.5pt, centered, `text-wrap: pretty`. Same cap as dish descriptions in starters/entrees. |
| Dish price | `dessert.price` | **8** | Italic Playfair 11pt, gold. Required when the section is shown; include the `$` glyph (`"$12"`, never bare `"12"`). Same cap as dish prices in starters/entrees. |

### Weekly footer

| Field | JSON path | Max chars | Notes |
|---|---|---|---|
| Footer title | `weekly.title` | **42** | Italic Playfair 15pt, centered, sits above a gold rule that spans the page. |
| Day label | `weekly.rows[*].day_label` | **14** | Uppercase Montserrat 8.5pt, tracked. Use en-dash for ranges: "Thu – Sat". |
| Headline | `weekly.rows[*].headline` | **26** | Italic Playfair 13.5pt, centered. |
| Detail | `weekly.rows[*].detail` | **110** | Regular Montserrat 9.5pt, centered, `text-wrap: pretty`. Two to three lines per cell is the design target — beyond ~110 chars one cell grows visibly taller than its neighbors. |

### Footer

| Field | JSON path | Max chars | Notes |
|---|---|---|---|
| Policy line | `policy_line` | **120** | **HTML-allowed.** The renderer uses `innerHTML` for this field specifically. Sanitize to a small allowlist (`<strong>`, `<em>`) if you give managers a rich-text editor here. |

---

## Cardinality (slot counts)

| Section | Min | Max | Notes |
|---|---|---|---|
| `sections.starters.items` | **1** | **4** | The 2-column grid lays out 1–4 dishes naturally. With 1 item it occupies the left cell and the right cell is empty; with 4 it forms a 2×2. |
| `sections.entrees.items` | **1** | **4** | Same. |
| `dessert` | **0** | **1** | Whole-section toggle. Absent / `null` → section removed from DOM. Present → exactly one dish. The editor must never let the manager add a second dessert dish. |
| `weekly.rows` | **4** | **4** | Fixed — the footer is a 4-column CSS grid. |

**Variable cardinality is the defining behavior of this menu.** The
renderer rebuilds each section's dish grid from the JSON items array
every time it runs — it clears the `.dish-grid`, then clones the
`<template id="dish-template">` blueprint once per item. **If `items`
has 2 entries, exactly 2 dish blocks render. If it has 4, all 4 do.
There are no empty placeholder slots.** The editor's "remove dish"
action is just `items.splice(i, 1)` followed by a save + re-render.

The editor MUST:

- Allow add/remove of starters and entrees in the range **1..4**.
- Block "remove" when only 1 item remains in a section.
- Block "add" when there are already 4 items in a section.
- Generate a fresh, unique `id` for any newly-added dish slot. Use a
  short opaque string (e.g. `d-` + nanoid 6 chars). Never reuse an
  ID from a deleted dish.
- Persist new IDs in the JSON. The next render relies on them.

The editor MUST NOT:

- Add a third section, remove a section, or rename `starters` /
  `entrees`.
- Add or remove weekly footer rows (always 4).
- Touch hero content.

---

## Renderer behavior

`render.js` is a UMD module that exports `SienaWeekendRender` on the
root (browser) or as `module.exports` (Node/CommonJS). Public surface
is one function:

```js
SienaWeekendRender.render(document, data)
```

What it does, in order:

1. **Hero — does nothing.** Intentionally untouched.
2. **For each section in `data.sections`**:
   1. Update the section title (`[data-section-title-for]`) and
      subtitle (`[data-section-subtitle-for]`).
   2. Find the section's `.dish-grid` and clear it (removes all
      children).
   3. For each dish in `items`, clone
      `<template id="dish-template">`'s blueprint, set
      `data-dish-id` and `data-section-id` on the clone, populate
      `.dish-name` / `.dish-desc` / `.dish-price`, append to the grid.
3. **Dessert section** (`[data-section-id="dessert"]`):
   - If `data.dessert` is absent / `null` / falsy → `section.remove()`.
      The entire `<div>` is gone from the rendered HTML.
   - Otherwise → set the title, populate the single baked-in dish's
      `.dish-name` / `.dish-desc` / `.dish-price` in place. The dish
      element keeps its template-baked `data-dish-id="d-dessert"` and
      `data-section-id="dessert"`; the renderer never clones or
      replaces it.
4. **Weekly footer**: update the title text, then for each row in
   `weekly.rows` find the fixed cell by `data-week-row-id`, fill in
   `day_label` / `headline` / `detail`, and re-append in JSON order.
5. **Policy line**: `innerHTML` (HTML allowed).

The renderer never creates or destroys section containers, the weekly
grid, or the policy line element. It only adds/removes dish elements
— plus, for the dessert section, optionally removes the section
container itself.

If you change `template.html`'s structure (e.g. add a new section, or
change the dish blueprint), `render.js` must be updated in lockstep and
`expected-render.html` regenerated.

---

## Static / non-editable template content

The following are baked into `template.html` and are NOT exposed to the
editor:

- The hero/masthead in its entirety:
  - The "Chef's Suggestions" eyebrow.
  - The "Specialità del Capo Cuoco" title.
  - The "Thursday ◆ Friday ◆ Saturday" meta line (including the diamond
    glyphs).
  - The gold rules flanking the title.
- The gold underline beneath each section title.
- The gold rule beneath the weekly-footer title.
- The masthead with the restaurant name and city — **deliberately
  omitted** from this menu (it slides into a hard menu cover that
  shows branding externally).
- All CSS, fonts, page break behavior, page padding, and the weekly
  grid's inset margins.
- The `<template id="dish-template">` blueprint at the end of `<body>`.

If a manager asks to change the days served, the menu title, or any
hero copy, that's an owner-level design decision — surface it as a
request, don't make it editable.

---

## What the editor can change

| Editable | JSON path |
|---|---|
| Section title | `sections.<id>.title` |
| Section subtitle | `sections.<id>.subtitle` |
| Dish name | `sections.<id>.items[*].name` |
| Dish description | `sections.<id>.items[*].desc` |
| Dish price | `sections.<id>.items[*].price` |
| Add/remove dishes (1..4 per section) | `sections.<id>.items` length |
| Dish order within section | `sections.<id>.items` array order |
| Show / hide dessert section | `dessert` present-or-absent |
| Dessert section title | `dessert.title` |
| Dessert dish name / desc / price | `dessert.name` / `dessert.desc` / `dessert.price` |
| Weekly footer title | `weekly.title` |
| Weekly day label | `weekly.rows[*].day_label` |
| Weekly headline | `weekly.rows[*].headline` |
| Weekly detail | `weekly.rows[*].detail` |
| Weekly row order | `weekly.rows` array order |
| Policy line | `policy_line` |

## What the editor CANNOT change

- Anything in the hero/masthead.
- Number of sections (always two: `starters`, `entrees`).
- Section IDs.
- Number of weekly rows (always 4).
- Weekly row IDs (`w-mon`, `w-tue`, `w-wed`, `w-thu`).
- Number of dessert dishes (0 or exactly 1 — never 2+).
- The dessert dish slot ID (`d-dessert` is baked into the template).
- Any CSS, font, color, or layout property.
- The diamond between the days, the gold rules, the section underlines.

---

## Editor UI sketch

Two-pane layout:

```
┌────────────────────────┬─────────────────────────────────────┐
│ EDITOR PANE            │ PREVIEW PANE (iframe → /preview)    │
│                        │                                     │
│ ─ Antipasti (Starters) │   [ live rendered single-page menu, │
│   [title]  [subtitle]  │     same way the file renders in    │
│     ≡ Burrata e Pèsca  │     screen mode ]                   │
│       [name] [desc]    │                                     │
│       [price]   [×]    │                                     │
│     ≡ Gamberoni…       │                                     │
│       …         [×]    │                                     │
│     [+ Add starter]    │                                     │
│                        │                                     │
│ ─ Secondi (Entrees)    │                                     │
│   [title]  [subtitle]  │                                     │
│     ≡ Dentice          │                                     │
│       …                │                                     │
│     [+ Add entree]     │                                     │
│                        │                                     │
│ ─ Dessert (optional)   │                                     │
│   [ ■ Show on menu ]   │                                     │
│     [title]            │                                     │
│     [name]             │                                     │
│     [desc]   [price]   │                                     │
│                        │                                     │
│ ─ Throughout the Week  │                                     │
│   [footer title]       │                                     │
│     ≡ Mondays          │                                     │
│       [day][headline]  │                                     │
│       [detail]         │                                     │
│     ≡ Tuesdays  …      │                                     │
│                        │                                     │
│ ─ Policy line          │                                     │
│                        │                                     │
│ [Save]  [Print Menu]   │                                     │
└────────────────────────┴─────────────────────────────────────┘
```

- Each section is collapsible. Default state: starters open, rest
  collapsed.
- `≡` drag handle reorders dishes within a section or weekly rows
  within the footer. Drag is blocked across section boundaries.
- `[+ Add starter]` is disabled when the section already has 4 dishes.
  `[×]` (remove) is disabled when the section has only 1 dish.
- The Dessert panel has a single "Show on menu" toggle at the top.
  Toggled OFF → the editor strips the `dessert` key from the JSON
  before saving (or sets it to `null`) and the panel collapses to just
  the toggle. Toggled ON → the four dessert fields appear and are all
  required; an empty save is blocked.
- Show the character counter for every text field, turning red as the
  user nears the cap. **Block save** when any field exceeds its cap.
- Auto-save with ~1s debounce after last keystroke. Show a "Saved"
  indicator.
- "Print Menu" opens `/print` in a new tab.

Live preview updates on every edit (debounced ~200–500ms). Either
reload the iframe or postMessage the new JSON in and have the iframe
re-call `render()`.

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

Matches the other Siena menus' print behavior. The 500ms delay gives
variable fonts time to settle. **Do not skip `document.fonts.ready`** —
printing before fonts load is the most common way to ship a broken
menu.

---

## Snapshot test

`snapshot-test.spec.js` is the safety net. It does this:

1. Load `template.html`.
2. Load `menu-data.json`.
3. Run `render(parsedTemplate, menuData)`.
4. Compare the serialized output to `expected-render.html` (whitespace
   normalized).
5. Fail loudly if they differ, with the first diff location.

This proves: given the seed data (the 4-starter / 4-entree maximum
configuration), the renderer reproduces the canonical menu exactly. If
any developer (or AI) changes `template.html`'s structure, `render.js`'s
logic, or `expected-render.html` without keeping all three in sync,
this test fails.

**Wire it into CI. Block merges on test failure.**

When the seed JSON is intentionally updated (e.g., this weekend's dishes
become next weekend's), the workflow is:

1. Edit `menu-data.json`.
2. Run `render()` on it and overwrite `expected-render.html` with the
   result.
3. Commit both files together.
4. Test passes again because the new expected matches the new render
   output.

---

## Edge cases & gotchas

- **Variable dish count is the whole game.** The seed ships with
  the maximum (4 starters + 4 entrees) so you can see the full layout,
  but in production most weekends will have 2 or 3 of each. The editor
  must gracefully handle removing items down to 1, and adding back up
  to 4. Test all four edge counts.

- **Dessert is whole-section optional.** The default state for a new
  weekend menu is no dessert. When `data.dessert` is absent, `null`,
  or otherwise falsy, the renderer calls `section.remove()` on the
  dessert `<div>` and the rendered HTML contains zero trace of the
  dessert section. When the manager turns the dessert toggle on, the
  editor must populate all four fields (title, name, desc, price)
  before saving — a half-filled dessert is not a valid state.
- **Dish IDs are mint-once, never-reused.** When the manager clicks
  "Add starter", generate a brand new opaque ID (e.g. nanoid). When
  they click "Remove", drop that item from the array — but don't
  recycle the ID for a future "Add". This keeps audit logs and any
  external references (e.g. inventory linkage) clean.

- **Dish price is required.** Never allow an empty `price` field. The
  weekend menu is à la carte — every dish has its own price. If a
  manager wants to mark a dish as "MP" (market price), have them type
  `"MP"` into the price field literally; the renderer prints it verbatim.

- **The `$` glyph lives in the data, not the template.** Unlike the
  Monday menu's big hero price (where `$` is template-static), here the
  whole price string including the dollar sign is whatever the editor
  saves. `"$17"` and `"MP"` are both valid; `"17"` will render as
  `"17"` with no glyph — probably a typo.

- **Weekly row IDs are slots, not semantics.** `w-mon` is not
  "Monday." It's slot 1. The editor may put anything in slot 1. The
  slot doesn't move; the array order does.

- **`detail` text on weekly cells is plain text.** No HTML allowed. If
  a manager wants bold or italic inside a detail, that's an
  out-of-band request.

- **`policy_line` is HTML.** It's the one exception. Sanitize on input.

- **Special characters:** preserve curly quotes (`’`), en/em dashes
  (`–`, `—`), middle dots (`·`), and accented letters (`è`, `à`).
  Don't ASCII-fold on save.

- **Empty values:** never allow an empty section title, subtitle, dish
  name, dish description, dish price, weekly `day_label`, weekly
  `headline`, or weekly `detail`. Every editable field on this menu is
  required.

- **Saving:** validate the JSON against a schema (Zod, JSON Schema,
  etc.) before writing. Reject malformed updates. Make sure the schema
  encodes the 1..4 cardinality on `items`.

- **Reorder must persist:** when the manager drags a dish or a weekly
  cell to reorder and saves, the new order is the new canonical order
  across every subsequent preview, print, and edit session.

---

## What "done" looks like

- Editor loads with all 4 starters + 4 entrees from the seed correctly
  populated, plus the four weekly cells.
- Manager removes 2 starters → preview re-renders with 2 dishes in the
  Antipasti grid, occupying the top row.
- Manager adds a starter → blank dish slot appears with a fresh ID →
  manager fills it in → preview updates.
- Manager drags Dentice below Linguine al Limone → preview reflects new
  order → save → reload → new order persists.
- Manager tries to add a 5th entree → button disabled.
- Manager tries to remove the last entree → button disabled.
- Manager clicks "Print Menu" → new tab → single-page menu loads →
  print dialog opens → Save as PDF produces a PDF visually identical to
  printing `Weekend Specials Menu.html` from the owner's machine.
- Snapshot test passes in CI.
- Owner can demo to a manager in 3 minutes.
