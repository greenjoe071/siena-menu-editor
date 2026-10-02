# Build Spec — Siena Weekend Specials Menu Editor (v2)

Read `README.md` first. v2 (Oct 2026) supersedes `../handoff-weekend/`.

The Weekend menu is a **recurring template** — the chef changes the dishes
every weekend. The hero and weekly footer are stable; the dish sections are not.

---

## Layout summary

- 8.5×11, single page, slides into a hard cover. Page padding
  `0.55in 0.65in 0.7in` — the asymmetric 0.7in bottom is the hard-cover safe
  zone. **Do not normalize.**
- **Hero (static):** "Weekend Specials" eyebrow → *Specialità del Capo Cuoco*
  title flanked by short gold rules → "Thursday ◆ Friday ◆ Saturday".
- **Menu body:** Antipasti → Secondi → optional Dolci. One centered column.
  Each section title is centered over a full-width gold rule. The whole body is
  **vertically centered** between the hero and the weekly footer
  (`justify-content: center`), so light menus don't leave a gap above the footer.
- **Dish:** name centered on the page's true center line, price on the same
  baseline hanging to the right of the name; description below, full width,
  centered.
- **Weekly footer:** gold rule, then 4 centered cells. No title.
- **Policy line** at the bottom.

### Colors (locked — none are editor-controllable)

| Role | Color |
|---|---|
| Section titles, dish names, bold policy text | deep red `#7a1712` |
| Hero title, eyebrow, day line, prices | dark brown `#3a1a06` |
| Descriptions | black `#000` |
| Decorative rules (title rules, section underlines, footer rule) | gold `#b8821e` |
| Day-line diamonds | tan `#c9a87a` |
| Weekly footer text | unchanged from v1 (gold day labels, `#111` headlines, `#4a3a26` detail) |

---

## Constraint model — auto-fit ladder

**A. One-line fields — hard caps** (block save when exceeded): section
title, dish name, dish price, weekly day label, weekly headline.

**B. Vertical growth — `settle.js`.** Descriptions wrap and dish counts vary.
The page self-fits: while `.page` would overflow, `settle.js` adds these
classes one at a time:

| Step | Class | Drops |
|---|---|---|
| 1 | `v-days` | "Thursday ◆ Friday ◆ Saturday" line |
| 2 | `v-tight` | tightens section / dish spacing |
| 3 | `v-eyebrow` | "Weekend Specials" eyebrow |
| 4 | `v-weekly` | the weekly specials footer (last resort) |

**Order changed from v1** (v1 dropped the eyebrow first). The eyebrow now
says "Weekend Specials" and is kept as long as possible.

Never hard-block save. If `settle()` returns `fits: false` (only reachable at
4 + 4 + dessert with long descriptions), show a **soft warning** in the editor:
"This menu is too long to fit — shorten a description or remove a dish."

Descriptions have no hard cap — a ~180-char soft guard with a counter only.

---

## Data model

```jsonc
{
  "sections": {
    "starters": { "title": "Antipasti", "items": [ /* 1..4 dishes */ ] },
    "entrees":  { "title": "Secondi",   "items": [ /* 1..4 dishes */ ] }
  },
  "dessert": {                 // OPTIONAL — omit or null to hide
    "title": "Dolci", "name": "Torta della Nonna",
    "desc": "…", "price": "$12"
  },
  "weekly": { "rows": [ /* exactly 4 */ ] },
  "policy_line": "<strong>…</strong>"
}
```

**Removed vs v1:** `sections.<id>.subtitle` and `weekly.title`. If old
saved JSON still carries them, the renderer ignores them — strip them on next
save.

**Dish:** `{ "id", "name", "desc", "price" }`. `id` is opaque, minted once,
never reused. `price` is required and stored verbatim, including `$`
(`"$17"`, or `"MP"`).

**Weekly row:** `{ "id", "day_label", "headline", "detail" }`. Exactly four
slots `w-mon`, `w-tue`, `w-wed`, `w-thu` — slots, not semantics; rendered
left-to-right in JSON array order.

There is no `hero` key — the hero is template-static.

---

## Editable fields & limits

| Field | JSON path | Cap | Notes |
|---|---|---|---|
| Section title | `sections.<id>.title` | **20** hard | Playfair italic 22pt, deep red, centered. |
| Dish name | `sections.<id>.items[*].name` | **26** hard | Playfair italic 18pt, deep red, centered. Price hangs off its right — longer names push the price right. |
| Dish description | `sections.<id>.items[*].desc` | ~180 soft | Montserrat 11.5pt, black, full width. Ladder-governed. |
| Dish price | `sections.<id>.items[*].price` | **8** hard | Playfair italic 14pt, dark brown. Required. |
| Dessert title / name / desc / price | `dessert.*` | 20 / 26 / ~180 soft / 8 | Same styling as the course dishes. All required when dessert is on. |
| Weekly day label | `weekly.rows[*].day_label` | **14** | |
| Weekly headline | `weekly.rows[*].headline` | **26** | |
| Weekly detail | `weekly.rows[*].detail` | **110** | Plain text. |
| Policy line | `policy_line` | **120** | HTML allowed (`<strong>`, `<em>` allowlist). |

### Cardinality

| Collection | Min | Max |
|---|---|---|
| `sections.starters.items` | 1 | 4 |
| `sections.entrees.items` | 1 | 4 |
| `dessert` | 0 | 1 |
| `weekly.rows` | 4 | 4 |

Add disabled at 4, remove disabled at 1. No third section, no renaming
section IDs, no adding/removing weekly rows.

---

## The 5-word last-line bind (render-time typography)

The owner wants descriptions to run margin to margin, but **never leave
fewer than 5 words alone on a wrapped second line.**

`render.js` does this with `bindLastWords(desc)`: for descriptions of
**8+ words**, the last 5 words are joined with U+00A0 (no-break space), so
they can only wrap as a group. A description that fits on one line is
unaffected; 7-or-fewer-word descriptions are left alone.

- It runs at **render time only.** The stored JSON keeps normal spaces —
  never save the NBSPs back into the data, and don't show them in the editor
  field.
- `.dish-desc` uses plain `text-wrap: wrap` (NOT `balance` / `pretty`) so line
  1 fills the measure. Don't change it.
- Side effect: line 1 can stop slightly short of the margin when the 5-word
  group is too long to fit on it. That's expected.
- In `expected-render.html` the no-break spaces appear as `&nbsp;`.

---

## Renderer behavior (`render.js`)

`SienaWeekendRender.render(document, data)`:

1. Hero — untouched.
2. Each section in `data.sections`: set title; clear `.dish-grid`; clone
   `<template id="dish-template">` once per item; set `data-dish-id` /
   `data-section-id`; fill name, price, and bound description.
3. Dessert: absent/null → `section.remove()`. Otherwise fill the baked-in
   `d-dessert` slot in place.
4. Weekly: fill each fixed cell by `data-week-row-id`, re-append in JSON order.
5. Policy line: `innerHTML`.

Also exported: `bindLastWords(text, n?)`, `BIND_WORDS` (5).

---

## The auto-fit ladder (`settle.js`)

```js
SienaWeekendSettle.settle();        // first .page
SienaWeekendSettle.settle(pageEl);
// → { applied: ['v-days','v-tight'], fits: true }
// → { applied: [...all], fits: false, overflowPx: N }
```

- Call after **every** preview render (debounced) and before `window.print()`.
- Auto-runs once on load after `document.fonts.ready`.
- **Measure at `.page`**, never `.menu-body` (flex:1, never overflows).
- **Wait for `document.fonts.ready`** — Playfair is a variable font.
- Idempotent — resets valves first.
- Not run in the snapshot test (JSDOM has no layout). `expected-render.html`
  is the pre-settle DOM.

---

## `/print` page

Identical to preview, plus:

```html
<script>
  document.fonts.ready.then(() => {
    SienaWeekendSettle.settle();
    setTimeout(() => window.print(), 500);
  });
</script>
```

---

## Static (not editable)

Entire hero (eyebrow, title, rules, day line); all gold rules; all colors,
fonts, spacing, page padding; the weekly grid's 0.45in inset; the dish
blueprint. Requests to change any of these are owner-level design decisions.

---

## Snapshot test

`snapshot-test.spec.mjs`:
1. `render(template, menu-data.json)` must equal `expected-render.html`
   (whitespace-normalized).
2. Dessert null / omitted → section removed; present → populated.
3. Last-5-words bind applied to 8+ word descriptions, skipped for shorter,
   input JSON not mutated.

Wire into CI, block merges on failure. When the seed changes: re-render,
overwrite `expected-render.html`, commit both together.

---

## Edge cases

- Most weekends will run 2–3 of each section; test 1, 2, 3, 4 on both.
- Very long dish names push the price toward the right margin — the 26-char
  cap keeps it on the page.
- Preserve curly quotes, dashes, middle dots, accented letters. No ASCII
  folding.
- Every editable field is required; no empty values.
- Validate JSON against a schema (1..4 items, 4 weekly rows) before saving.

## What "done" looks like

- Seed loads (4 + 4 + dessert) and the preview settles — exactly what prints.
- Remove dishes down to 1 + 1 → the dish block sits vertically centered
  between the day line and the weekly footer.
- Dense configs shed chrome in the order day line → spacing → eyebrow →
  footer. No save is ever blocked; overflow beyond the ladder shows a soft
  warning.
- A long description wraps with ≥5 words on its second line.
- Print → PDF matches `Weekend Specials Menu v2.html` from the owner's machine.
- Snapshot test passes in CI.
