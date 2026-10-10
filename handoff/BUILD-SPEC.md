# Build Spec — Siena Menu Editor

This document gives Claude Code the detail it needs to build the editor app correctly the first time. Read `README.md` first.

---

## Data model

The menu data is a single JSON object. Its top-level shape:

```jsonc
{
  "header": {
    "restaurant_name": "Siena Ristorante Toscana",
    "sub_page_1": "La Cucina Toscana · Austin, Texas · Since 2000",
    "sub_other_pages": "Spring / Summer Menu 2026"
  },
  "about_blurb": "The cuisine of the Tuscan region…",
  "bread_note": {
    "title": "Fresh Baked Bread",
    "body": "Each day at Siena we bake all of our bread from scratch…"
  },
  "raw_warning_main":      "* Consuming raw or undercooked beef, poultry, or seafood may increase your risk of foodborne illness,",
  "raw_warning_qualifier": "especially if you have certain medical conditions.",
  "policy_line": "<strong>No split checks.</strong>  ·  <strong>Gratuity of 22% for parties of 6 or more.</strong>",
  "salad_addons": {
    "enabled": true,
    "label": "Add to any Salad",
    "items": [
      { "id": "sa-chicken", "name": "Grilled Chicken", "price": "8",  "enabled": true },
      { "id": "sa-salmon",  "name": "Grilled Salmon",  "price": "12", "enabled": true }
    ]
  },
  "pasta_addons": {
    "enabled": true,
    "label": "Add to any pasta",
    "items": [
      { "id": "a-chicken",   "name": "Chicken",   "price": "6.25", "enabled": true },
      { "id": "a-shrimp",    "name": "Shrimp",    "price": "8",    "enabled": true },
      { "id": "a-scallops",  "name": "Scallops",  "price": "12",   "enabled": true },
      { "id": "a-mushrooms", "name": "Mushrooms", "price": "6",    "enabled": true },
      { "id": "a-sausage",   "name": "Sausage",   "price": "4",    "enabled": true }
    ],
    "tail": "— or ask your server for other options."
  },
  "steak_addons": {
    "enabled": true,
    "label": "Add to any steak",
    "items": [
      { "id": "ta-mushrooms", "name": "Sautéed Mushrooms", "price": "6",  "enabled": true },
      { "id": "ta-shrimp",    "name": "Grilled Shrimp",    "price": "9",  "enabled": true },
      { "id": "ta-scallops",  "name": "Seared Scallops",   "price": "12", "enabled": true }
    ]
  },
  "sections": {
    "antipasti":       { "title": "Antipasti",            "items": [ /* 10 dishes */ ] },
    "zuppa-insalate":  { "title": "Zuppa e Insalate",     "items": [ /* 4 dishes */ ] },
    "pasta":           { "title": "Pasta",                "items": [ /* 7 dishes */ ] },
    "contorni":        { "title": "Contorni",             "items": [ /* 6 dishes */ ] },
    "secondi":         { "title": "Secondi Piatti",       "items": [ /* 8 dishes */ ] },
    "non-alcoholic":   { "title": "Non-Alcoholic Beverages", "items": [ /* 7 dishes */ ] }
  }
}
```

### Add-on blocks shape — pasta, salad, steak

There are now **three** add-on lines on the printed menu, each rendered
identically (gold italic Playfair label + Montserrat items with bold names
and middle-dot separators). They sit at the bottom of their respective
sections:

| Block | Page | Sits below | Default items |
|---|---|---|---|
| `salad_addons` | 1 | Zuppa e Insalate grid | Grilled Chicken, Grilled Salmon |
| `pasta_addons` | 2 | Pasta grid | Chicken, Shrimp, Scallops, Mushrooms, Sausage (+ optional tail) |
| `steak_addons` | 3 | Secondi grid | Sautéed Mushrooms, Grilled Shrimp, Seared Scallops |

Each block has the same JSON shape:

```json
{
  "enabled": true,
  "label": "Add to any Salad",
  "items": [
    { "id": "sa-chicken", "name": "Grilled Chicken", "price": "8",  "enabled": true },
    { "id": "sa-salmon",  "name": "Grilled Salmon",  "price": "12", "enabled": true }
  ],
  "tail": "— or ask your server for other options."
}
```

#### Editor controls — all three lines work the same (Oct 2026)

Salad, pasta and steak add-on lines now have **identical** controls. (Before
Oct 2026, salad/steak names were read-only and their item counts fixed — that
restriction is lifted.) Per line, the editor can:

1. **Edit item `name`** — plain text, renders bold.
2. **Edit item `price`** — plain text, no `$`.
3. **Toggle item `enabled`** — hides that item; the rest of the line closes up.
4. **Add / remove items** — new items get a new opaque id (`sa-…`, `a-…`, `ta-…` + 4 hex chars).
5. **Reorder items** — drag-to-reorder; array order = printed order.
6. **Edit `label`** — the gold italic "Add to any …" text.
7. **Toggle block `enabled`** — hides the whole line.

Only the pasta block has a `tail` ("— or ask your server for other
options."). The renderer removes the tail slot if it is empty or missing.
Salad and steak JSON omit `tail`; don't add a tail field to their editors.

#### One-line rule — HARD BLOCK (all three lines)

The owner's rule: **an add-on line never runs to two lines.** The label + items
must fit on a single printed line inside the page's text width. This replaces
the old pasta "≤ 70 characters, warn only" rule — **do not use a character
count**; widths vary too much between names.

Enforced by `validate.js` (see "Fit validator" below), measured from the
rendered preview. If any add-on line wraps or runs past the text width,
`report.fits === false` and **Save is disabled** until the manager shortens
a name, or hides/removes an item. (The pasta `tail` is allowed to sit on its
own line below the items, as it does in the current design.)

#### Hide behavior

The renderer **removes the block from the DOM entirely** when:
- `block.enabled === false`, OR
- every item has `enabled === false` (no surviving items to render).

No leftover empty `<div>`, no `display: none` — the page reflows.

### Dish shapes

**Single-price dish** (the common case):
```json
{ "id": "d-3f2a", "enabled": true, "name": "Whipped Ricotta", "desc": "Warm Spicy Honey…", "price": "12" }
```

**Single-price dish with raw-food warning** (the Carpaccio, Bistecca, Salmone, Costata, Filetto):
```json
{ "id": "d-91bc", "name": "Carpaccio", "desc": "Raw Wagyu Beef…", "price": "15", "raw": true }
```
The `raw` flag tells the renderer to append the `*` indicator inside the dish name.

**Dual-price dish** (only Tomato Bisque uses this):
```json
{ "id": "d-7e08", "name": "Tomato Bisque", "desc": "…", "price_format": "dual", "bowl_price": "10", "cup_price": "5" }
```
Detected by `price_format === "dual"`.

### Dish hide/show — every section (Oct 2026)

Every dish has `enabled` (boolean; absent = `true`). This is a **hide/show
switch, not a delete** — a hidden dish stays in the data so it can be turned
back on later (seasonal items). There is no permanent delete for dishes.

Renderer behavior (`render.js` → `renderSection`):
- A hidden dish is **removed from the DOM** (not `display:none`).
- Visible dishes are re-appended in data order, so every later dish shifts
  back one slot. In `.two-col` sections (Antipasti, Zuppa e Insalate, Pasta,
  Contorni) that is **row-by-row**: dishes can move across columns. In
  `.two-col-flow` sections (Secondi, Non-Alcoholic, Mocktails) the browser
  re-balances the two columns.
  Example: hide Schiacciata (Antipasti slot 8) → Carpaccio moves into slot 8,
  Cozze into slot 9, slot 10 is gone; the section is one row shorter.
- **Centering only for a lone dish.** If a section is down to exactly ONE
  visible dish, it is centered at one column's width (pure CSS:
  `.two-col > .dish:only-child`, `.two-col-flow:has(> .dish:only-child)`).
  An odd last row (e.g. Pasta's 7th dish) stays in the LEFT column — the owner
  explicitly rejected centering it. Don't add that.
- If every dish in a container is hidden, the container is removed (for the
  Mocktails container, its "Mocktails" heading goes too). If every dish in a
  section is hidden, the section heading is removed as well. The owner doesn't
  expect this to happen; it is handled so the page never shows an empty heading.
- The space freed by hiding dishes is left as-is (page 2 absorbs it around the
  artwork; on page 3 the gap above the Non-Alcoholic box grows). Intentional.

### Adding dishes — Pasta only, max 8

- **Only the Pasta section** accepts new dishes. Pasta currently has 7; the
  8th fills the open slot beside Capellini con Gamberi without growing the page.
- Limit: **8 visible pasta dishes** (hidden ones don't count). Enforced by
  `validate.js` → `validateData()` (HARD BLOCK). Disable the "Add dish"
  button at 8.
- New dish = new object in `sections.pasta.items` with a fresh opaque id
  (`d-` + 4 hex), `enabled: true`, `price_format: "single"`. The renderer
  builds its slot automatically.
- **No "Add dish" in any other section** — those pages are full. Hide/show only.
  (`validate.js` also rejects new ids outside Pasta.)

### IDs

- Every dish has an `id` like `d-a7f3` — opaque, 4-hex-char suffix. Generated once. Never displayed to users. **Never repurposed semantically** (the slot keeps its ID even when the name and description completely change).
- Section IDs (`antipasti`, `secondi`, …) **are** semantic and stable. They map 1:1 to fixed slots in the template. **Do not rename them or add new ones.** The template has hardcoded `data-section-id` hooks.

---

## What the editor can change

| Editable | Where in JSON | Notes |
|---|---|---|
| Restaurant name (top of every page) | `header.restaurant_name` | Rarely edited. Provide it but de-emphasize. |
| Page-1 sub-header | `header.sub_page_1` | Allows minimal HTML (e.g. `·` separators). Render via `innerHTML`. |
| Other-pages sub-header | `header.sub_other_pages` | E.g. "Spring / Summer Menu 2026" — manager will change every season. |
| About blurb (page 1) | `about_blurb` | Plain text. |
| Bread note title | `bread_note.title` | Plain text. |
| Bread note body | `bread_note.body` | Plain text. |
| Raw-food warning (line 1) | `raw_warning_main` | Plain text. The bottom of every page. Renders above an explicit line break. |
| Raw-food warning (line 2) | `raw_warning_qualifier` | Plain text. Sits below the break. Together with `raw_warning_main` forms the full disclaimer. |
| Policy line | `policy_line` | HTML allowed (the `<strong>` tags around "No split checks" and the gratuity clause). |
| **Salad add-on item price** | `salad_addons.items[*].price` | Plain text, no `$`. The headline editable field for this block. |
| **Salad add-on item enabled** | `salad_addons.items[*].enabled` | Boolean toggle. Hides the item from the printed line. |
| **Salad add-ons block enabled** | `salad_addons.enabled` | Boolean. Hides the entire line. |
| Salad add-ons label | `salad_addons.label` | Plain text. Italic gold eyebrow. Rarely edited but allowed. |
| **Salad add-on item name** | `salad_addons.items[*].name` | Plain text. Renders bold. (New Oct 2026.) |
| **Salad add-on add/remove/reorder** | `salad_addons.items` | Same as pasta. One-line HARD BLOCK. (New Oct 2026.) |
| **Pasta add-on item price** | `pasta_addons.items[*].price` | Plain text, no `$`. |
| **Pasta add-on item enabled** | `pasta_addons.items[*].enabled` | Boolean. Hide one item. |
| Pasta add-on item name | `pasta_addons.items[*].name` | Plain text. Renders bold. |
| Pasta add-on item add/remove | `pasta_addons.items` array length | Subject to the one-line HARD BLOCK. |
| Pasta add-on item order | `pasta_addons.items` array order | Drag-to-reorder. |
| Pasta add-ons label | `pasta_addons.label` | Plain text. Italic gold eyebrow. |
| Pasta add-ons tail | `pasta_addons.tail` | Plain text. The trailing italic line below the items. Empty string removes the tail slot. |
| **Pasta add-ons block enabled** | `pasta_addons.enabled` | Boolean. Hides the entire line. |
| **Steak add-on item price** | `steak_addons.items[*].price` | Plain text, no `$`. |
| **Steak add-on item enabled** | `steak_addons.items[*].enabled` | Boolean toggle. |
| **Steak add-ons block enabled** | `steak_addons.enabled` | Boolean. Hides the entire line. |
| Steak add-ons label | `steak_addons.label` | Plain text. Italic gold eyebrow. Rarely edited. |
| **Steak add-on item name** | `steak_addons.items[*].name` | Plain text. Renders bold. (New Oct 2026.) |
| **Steak add-on add/remove/reorder** | `steak_addons.items` | Same as pasta. One-line HARD BLOCK. (New Oct 2026.) |
| Section title | `sections.<id>.title` | E.g. "Antipasti" → "Antipasti & Stuzzichini". Be conservative — long titles can wrap. |
| Dish name | `sections.<id>.items[*].name` | Plain text. |
| Dish description | `sections.<id>.items[*].desc` | Plain text. Length is limited by the page-fit HARD BLOCK, not a character cap. |
| Dish price | `sections.<id>.items[*].price` (or `bowl_price` / `cup_price` for dual) | Plain text, no `$` symbol (the menu omits it intentionally). |
| Raw-food flag | `sections.<id>.items[*].raw` | Boolean. Adds the `*` indicator to the dish name. |
| Dish order within section | `sections.<id>.items` array order | Drag-to-reorder UI; persist new order on save. |
| **Dish hide/show** | `sections.<id>.items[*].enabled` | Boolean switch on every dish in every section. Hidden dishes stay in the editor (greyed) and are removed from the printed page. (New Oct 2026.) |
| **Add a pasta dish** | `sections.pasta.items` (push) | Pasta only, max 8 visible. (New Oct 2026.) |

## What the editor CANNOT change

- The set of section IDs (`antipasti`, `zuppa-insalate`, `pasta`, `contorni`, `secondi`, `non-alcoholic`)
- Adding dishes to any section other than Pasta (Pasta max 8 visible). Dishes are hidden, never deleted.
- Which section a dish belongs to (no cross-section moves)
- The `price_format` of a dish (only Tomato Bisque is dual; this is locked)
- The structural line break between `raw_warning_main` and `raw_warning_qualifier` — the template hardcodes a `<br>` between the two text slots; the editor only edits the two text contents, not their relationship
- Anything visual: CSS, fonts, page breaks, colors, spacing
- The number of pages (3) or which sections appear on which page

If a manager asks to add a dish outside Pasta, or a new section, that's an owner-level decision — surface it as a request, don't try to make it editable.

---

## Fit validator — `validate.js` (HARD BLOCK, new Oct 2026)

**Rule: the bottom of a page must never be cut off.** Each `.page` is a fixed
8.5×11 with `overflow: hidden`, so anything that grows past the bottom is
silently clipped in print. `validate.js` (UMD `SienaSpringValidate`, same
pattern as `handoff-happyhour-v2` / `handoff-tueswed`) is the guard.

After every edit (debounced), the editor:
1. renders the candidate JSON into the preview iframe with `SienaRender.render`,
2. `await SienaSpringValidate.waitForLayout(doc)` (fonts must be loaded),
3. `const report = SienaSpringValidate.validate(doc, { data: candidate })`.

If `report.fits === false`: **disable Save**, show each `report.problems[i].message`
(plain English, written for managers), and highlight `problem.section` /
`problem.block` / `problem.page` in the preview. Save re-enables as soon as the
next validation passes — nothing to dismiss. **Never auto-shrink text to fit.**

| Check | What fails | Message example |
|---|---|---|
| `page-overflow` | A page's natural content height > 11in minus a **6pt safety margin** | "Page 3 is too full. Shorten something on this page — Secondi Piatti is the largest section there." |
| `addon-wrap` | An add-on line's label + items wrap to a second line, or run past the text width | "The "Add to any steak" line is too long to fit on one line…" |
| `pasta-count` | More than 8 visible pasta dishes | "Pasta can show at most 8 dishes. Hide one to save." |
| `add-not-allowed` | A new dish id outside Pasta | "New dishes can only be added to Pasta…" |

Page height is measured by temporarily laying the page out at `height:auto`
(the margin:auto slack absorbers collapse), **not** `scrollHeight` — flex
children can shrink and hide overflow from scrollHeight.

Needs a real layout engine (browser / iframe / Playwright). **JSDOM cannot run
it** — the snapshot test covers rendering; test the validator in Chrome.
`validate-check.html` (open it from a local web server in this folder) runs
seven scenarios against the real template: seed, hide Schiacciata, 8th pasta,
9th pasta, too many steak add-ons, very long Secondi text, one Contorni left.
The seed data must show "Fits".

The server must also run `validateData(data)` on PUT `/api/menu` and reject
`pasta-count` failures (layout checks are client-side only).

## Editor UI sketch

Two-pane layout, full-viewport:

```
┌────────────────────────┬─────────────────────────────────────┐
│ EDITOR PANE            │ PREVIEW PANE (iframe → /preview)    │
│ ─ Restaurant header    │                                     │
│   [name field]         │   [ live rendered menu, scrollable, │
│   [sub page 1]         │     showing all 3 pages stacked,    │
│   [sub other pages]    │     same way the print file does    │
│ ─ About blurb          │     in screen mode ]                │
│ ─ Sections             │                                     │
│   [Antipasti ▾]        │                                     │
│     ≡ Whipped Ricotta  │                                     │
│       [name] [desc]    │                                     │
│       [price]          │                                     │
│     ≡ Fichi Ripieni    │                                     │
│       …                │                                     │
│   [Zuppa & Insalate ▾] │                                     │
│   [Pasta ▾]            │                                     │
│   …                    │                                     │
│ ─ Bread note           │                                     │
│ ─ Footer text          │                                     │
│                        │                                     │
│ [Save]  [Print Menu]   │                                     │
└────────────────────────┴─────────────────────────────────────┘
```

- Each section is collapsible. Default state: first section open, rest collapsed.
- Drag handle (`≡`) on each dish row reorders dishes within its section. Drag is blocked at section boundaries.
- A small `*` toggle (raw-food warning) next to each dish row, where relevant.
- A **hide/show switch** (eye icon) on every dish row. Hidden rows stay in the list, greyed out.
- **"+ Add dish"** appears in the Pasta section only; disabled at 8 visible dishes.
- Add-on lines: an editable list per line (name, price, show/hide, drag handle, remove) + "+ Add item".
- A fit banner near Save: "Fits" or the validator's problem messages; Save disabled while blocked.
- "Save" pushes JSON to `/api/menu`. Auto-save with debounce (~1s after last keystroke) is preferable to a manual save button, but either is fine. Show a "Saved" indicator.
- "Print Menu" opens `/print` in a new tab.

Live preview updates on every edit (debounced ~200–500ms). Implementation: `iframe.contentWindow.location.reload()` after each save, OR — for snappier feel — postMessage the new JSON into the iframe and have the iframe re-call `render()`.

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

This matches the current Spring Menu's print behavior exactly. The 500ms delay gives the variable fonts time to settle. **Do not skip the `document.fonts.ready` await** — printing before fonts load is one of the most common ways to ship a broken menu.

---

## Snapshot test

`snapshot-test.spec.mjs` is the safety net. It does this:

1. Load `template.html`.
2. Load `menu-data.json`.
3. Run `render(parsedTemplate, menuData)`.
4. Compare the serialized output to `expected-render.html` (both normalized to collapse whitespace).
5. Fail loudly if they differ, with the first diff location.

This proves: given the seed data, the renderer reproduces the original menu exactly. If any developer (or AI) changes `template.html`'s structure, `render.js`'s logic, or `expected-render.html` without keeping all three in sync, this test fails.

**Wire it into CI.** Block merges on test failure.

When the seed JSON is intentionally updated (e.g., the owner asks to change a dish), the workflow is:
1. Edit `menu-data.json`.
2. Run `render()` on it and overwrite `expected-render.html` with the result.
3. Commit both files together.
4. The test passes again because the new expected matches the new render output.

---

## Edge cases & gotchas

- **The `*` raw-food marker** is inside the dish-name span as a styled inner span. The renderer (`render.js` → `renderDishName`) handles this; don't recreate it manually.

- **Tomato Bisque** is the only dual-price item. The renderer detects `price_format === "dual"` and emits `<div class="dish-price-dual">Bowl 10<br>Cup 5</div>` instead of `<div class="dish-price">…</div>`. If a manager somehow changes another dish to dual-price, **block that in validation** — only the Tomato Bisque slot has the layout space for two-line prices.

- **Special characters in dish names:** the menu currently has `A' Siciliana Natural Soda` using a curly apostrophe (`A’`). Preserve typography — don't force-ASCII apostrophes on save. If you sanitize input, allow `’`, `·`, `é`, `à`, `ñ`, etc.

- **HTML in fields:** `header.sub_page_1` and `policy_line` contain HTML (`<strong>`, `&nbsp;`, `·`). The renderer uses `innerHTML` for these specifically. **All other fields are `textContent`** — never inject user input as HTML elsewhere. If you give managers a rich-text editor for the policy line, sanitize to a small allowlist (`<strong>`, `<em>`).

- **Description length:** the layout was tuned for descriptions of roughly 6–14 words. Much longer descriptions can push column heights past their balance point and create awkward gaps. There is no character cap — the page-fit HARD BLOCK (validate.js) stops any edit that would push a page past its bottom edge.

- **Section title length:** roughly 25 characters is the safe upper bound. Beyond that, the gold rule beside it gets squeezed. Warn at 22+.

- **Add-on rows** (salad p.1, pasta p.2, steak p.3) are single inline lists — `<strong>Name</strong> price` pairs joined by `&nbsp;·&nbsp;`. The renderer rebuilds `.addons-items` from the JSON each time; item ids are for the editor's list keys and don't appear in the DOM. All three lines: editable names, add/remove/reorder, one-line HARD BLOCK. The steak line is on the fullest page — the page-fit check catches it if it ever pushes page 3.

- **Add-on hide behavior is whole-block:** if every item in a block is disabled (or `block.enabled === false`), the renderer removes the entire block element from the DOM — not just blanks it. The printed page reflows. There is no "empty add-ons row" intermediate state.

- **Snapshot regeneration when add-on data changes:** if you flip an `enabled` flag or change a price in the seed JSON for testing, the snapshot test will fail until you regenerate `expected-render.html`. Workflow: load `template.html` into JSDOM, run `SienaRender.render(doc, newData)`, write `dom.serialize()` to `expected-render.html`, commit all three (data, expected, test) together.

- **Reorder must be persistent:** when the manager drags Dish A above Dish B and saves, the new order is the new canonical order. The next preview, the next print, the next edit session — all see the new order.

- **Empty values:** never allow an empty dish name, empty description, or empty price to save. Validate.

- **Saving:** validate the JSON against a schema (Zod, JSON Schema, whatever Claude Code prefers) before writing. Reject malformed updates.

---

## What "done" looks like

- Editor loads, shows all current menu content correctly populated.
- Manager edits a dish name → preview updates within ~1 second.
- Manager drags a dish to reorder → preview updates → save → reload page → new order persists.
- Manager clicks "Print Menu" → new tab → 3-page menu loads → print dialog opens → Save as PDF produces a PDF visually identical to printing the current `Spring Menu 2026-print.html` from the owner's machine.
- Snapshot test passes in CI.
- Owner can demo to a manager in 5 minutes without writing anything down.
