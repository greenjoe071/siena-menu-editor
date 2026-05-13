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
  "raw_warning_full":  "* Consuming raw or undercooked beef, poultry, or seafood may increase your risk of foodborne illness, especially if you have certain medical conditions.",
  "raw_warning_short": "* Consuming raw or undercooked beef, poultry, or seafood may increase your risk of foodborne illness.",
  "policy_line": "<strong>No split checks.</strong>  ·  <strong>Gratuity of 22% for parties of 6 or more.</strong>",
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

### Dish shapes

**Single-price dish** (the common case):
```json
{ "id": "d-3f2a", "name": "Whipped Ricotta", "desc": "Warm Spicy Honey…", "price": "12" }
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
| Raw-food warning (long) | `raw_warning_full` | Used on pages 1 and 3 footers. |
| Raw-food warning (short) | `raw_warning_short` | Used on page 2 footer. Owner may want to merge these later. |
| Policy line | `policy_line` | HTML allowed (the `<strong>` tags around "No split checks" and the gratuity clause). |
| Section title | `sections.<id>.title` | E.g. "Antipasti" → "Antipasti & Stuzzichini". Be conservative — long titles can wrap. |
| Dish name | `sections.<id>.items[*].name` | Plain text. |
| Dish description | `sections.<id>.items[*].desc` | Plain text. **Watch length** — longer descriptions push column heights. |
| Dish price | `sections.<id>.items[*].price` (or `bowl_price` / `cup_price` for dual) | Plain text, no `$` symbol (the menu omits it intentionally). |
| Raw-food flag | `sections.<id>.items[*].raw` | Boolean. Adds the `*` indicator to the dish name. |
| Dish order within section | `sections.<id>.items` array order | Drag-to-reorder UI; persist new order on save. |

## What the editor CANNOT change

- The set of section IDs (`antipasti`, `zuppa-insalate`, `pasta`, `contorni`, `secondi`, `non-alcoholic`)
- The number of dishes in each section (cardinality is fixed: 10 / 4 / 7 / 6 / 8 / 7)
- Which section a dish belongs to (no cross-section moves)
- The `price_format` of a dish (only Tomato Bisque is dual; this is locked)
- Anything visual: CSS, fonts, page breaks, colors, spacing
- The number of pages (3) or which sections appear on which page

If a manager asks to add a dish or section, that's an owner-level decision — surface it as a request, don't try to make it editable.

---

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

`snapshot-test.spec.js` is the safety net. It does this:

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

- **Description length:** the layout was tuned for descriptions of roughly 6–14 words. Much longer descriptions can push column heights past their balance point and create awkward gaps. The editor should warn (not block) when a description exceeds ~120 characters.

- **Section title length:** roughly 25 characters is the safe upper bound. Beyond that, the gold rule beside it gets squeezed. Warn at 22+.

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
