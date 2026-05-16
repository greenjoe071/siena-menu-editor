# Siena Tues/Wed Prix-Fixe — Build Spec

A weekly-rotating, **fixed 3-course $45 prix-fixe** offered Tuesday and Wednesday. One dish per course — no choices, no substitutions. Has a single optional add-on at the bottom (most commonly a wine pairing, but the data model is generic so it can be a cheese course, dessert course, coffee service, etc.).

This package is the developer handoff for the in-house editor + print system. The CSS, layout, and weekly footer chrome are **frozen** in `template.html`; only the data slots below are user-editable.

---

## 1. UMD contract

`render.js` exposes a single function:

```js
SienaTuewedRender.render(document, data);
```

- **Single self-contained UMD file.** No imports, no `fetch`, no external deps.
- Works server-side via `new Function('module', 'self', src)(mod, fakeRoot)`.
- `render(document, data)` mutates the document in place — no return value.
- Idempotent for a given `(document, data)` pair.

---

## 2. Data shape

```jsonc
{
  "price": "45",                          // digits only — "$" is static
  "courses": [
    { "id": "course-1", "title": "…", "desc": "…" },
    { "id": "course-2", "title": "…", "desc": "…" },
    { "id": "course-3", "title": "…", "desc": "…" }
  ],
  "addon": {                              // optional — see toggle rules below
    "title": "Wine Pairing",
    "desc":  "Three wines, one per course, chosen by the floor",
    "price": "25"                          // digits only — "Add $" is static
  },
  "policy_line": "<strong>No split checks.</strong>…"  // optional, HTML allowed
}
```

**Cardinality is fixed.** The `courses` array always has exactly **3** entries with stable ids `course-1`, `course-2`, `course-3`. The editor must not let the user add or remove courses, only edit the title/desc of each. Re-ordering by changing the array order has no effect on the printed output — slots are matched by `id`, not array position.

---

## 3. Editable fields — full reference

| Field | Required? | Type | Max chars | Notes |
|---|---|---|---|---|
| `price` | required | digits | **3** | e.g. `"45"`. The `$` glyph is rendered statically by the template. |
| `courses[i].id` | required | string | n/a | Must be one of `course-1`, `course-2`, `course-3`. Not user-editable in the UI. |
| `courses[i].title` | required | text | **38** | Dish name. Renders in Playfair italic ~22pt. Italian curly apostrophes (`’`) are preserved verbatim — do not ASCII-fold. |
| `courses[i].desc` | required | text | **140** | Ingredient line. Renders in Montserrat 10.5pt; wraps to up to 2 lines comfortably. The body uses `justify-content: space-evenly`, so descriptions that grow a little absorb into the inter-course gaps. Above ~150 chars the third-course description risks crowding the add-on row — enforce 140 as a hard limit in the editor. |
| `addon.title` | **optional** | text | **24** | When empty/missing, the entire add-on block is removed (this is the "no add-on this week" toggle). Examples: `"Wine Pairing"`, `"Cheese Course"`, `"Dessert Course"`, `"Espresso & Biscotti"`. |
| `addon.desc` | optional | text | **70** | Single-line note in small caps. Rendered uppercase by CSS — input may be normal case. Empty → the note line is removed but the title row stays. |
| `addon.price` | optional | digits | **3** | e.g. `"25"`. The `Add $` prefix is rendered statically by the template. Empty → the `Add $XX` pill is removed but the title stays. |
| `policy_line` | optional | **HTML** | **120** | Single-line footnote at the very bottom. Allows inline HTML (`<strong>`, `<em>`, `<br>`, `&nbsp;`, `&middot;`). Empty/missing → the entire footnotes block is removed. |

### Validation in the editor

- `price` and `addon.price`: input mask to digits only (no `$`, no decimals).
- All text fields: live character counter showing remaining chars against the cap; soft warning at 90% of cap, hard block at the cap.
- Title fields (`courses[i].title`, `addon.title`): collapse runs of whitespace; preserve curly quotes / apostrophes; do not strip em-dashes (`—`) or middle dots (`·`).
- `policy_line`: sanitize HTML allowlist to `<strong>`, `<em>`, `<br>`, and the `&nbsp;` / `&middot;` / `&mdash;` entities. Reject anything else.

---

## 4. Optional-field toggle rules (renderer behaviour)

| Field empty/missing | Renderer behaviour |
|---|---|
| `addon.title` | Entire `[data-addon]` block removed from DOM. The add-on rule above it goes with it. |
| `addon.price` (title set) | The `.addon-price` span (`Add $XX`) is removed; the title row stays as a clean single-label row. |
| `addon.desc` (title set) | The small-caps `[data-text-id="addon-desc"]` line is removed; the title row stays. |
| `policy_line` | Entire `[data-footnotes]` block removed. |

A "filled" value means the trimmed string is non-empty. `null`, `undefined`, `""`, and `"   "` all count as empty.

---

## 5. Static / not editable

These elements are baked into `template.html` and have no data hooks. The editor must not expose them as fields.

- Restaurant chrome — the hero title `Chef's / Three-Course Menu`, the `$` glyph, the `Add $` prefix, the subtitle `Suggestioni del Capo Cuoco · Prix Fixe`, the gold rule under the hero.
- Roman numerals `I`, `II`, `III` next to each course (cardinality is fixed, so numerals are static text).
- The four weekly-specials cells in the footer: `Mondays` ($26 for 26 Years), `Thursdays` (Thirsty Thursday), `Thu – Sat` (Weekend Specials), `Nightly` (Bar Happy Hour). These point to the *other nights'* offers — they don't change with this menu. (If they ever need to change, that's a structural design conversation, not an editor change.)
- The "Throughout the Week at Siena" weekly header.
- All typography (Playfair Display Italic for display, Montserrat for UI/body), all colors (gold `#b8821e`, dark browns `#5a2e0e` / `#3a1a06`, rule `#c9a87a`), all spacing, all page-padding (asymmetric `0.55in 0.65in 0.7in` to keep the bottom corners safe in the hard cover).
- Days line — the menu does **not** print "Tuesday & Wednesday" anywhere; staff hand it out only those nights.

---

## 6. DOM hooks (for renderer reference)

| Slot | Selector | Field |
|---|---|---|
| Price digits | `[data-text-id="price"]` | `price` (textContent) |
| Course title | `[data-text-id="course-N-title"]` | `courses[i].title` where `i.id == "course-N"` |
| Course desc | `[data-text-id="course-N-desc"]` | `courses[i].desc` |
| Add-on container | `[data-addon]` | removed when `addon.title` empty |
| Add-on title | `[data-text-id="addon-title"]` | `addon.title` (textContent) |
| Add-on price | `[data-text-id="addon-price"]` | `addon.price` (textContent); pill removed when empty |
| Add-on desc | `[data-text-id="addon-desc"]` | `addon.desc` (textContent); removed when empty |
| Footnotes container | `[data-footnotes]` | removed when `policy_line` empty |
| Policy line | `[data-text-id="policy-line"]` | `policy_line` (**innerHTML**) |

`textContent` for everything **except** `policy_line`, which uses `innerHTML`.

---

## 7. Editor UI sketch (recommended)

```
┌───────────────────────────────────────────────────────────┐
│  Chef's Three-Course Menu — Tues & Wed                    │
│                                                           │
│  Price                                                    │
│    $ [ 45 ]      (digits only, max 3)                    │
│                                                           │
│  ─ Course I ─────────────────────────────                │
│    Dish name      [ Burrata e Fichi          ] 16/38     │
│    Description    [ Hand-pulled Puglian b…   ] 95/140    │
│                                                           │
│  ─ Course II ────────────────────────────                │
│    Dish name      […]                                     │
│    Description    […]                                     │
│                                                           │
│  ─ Course III ───────────────────────────                │
│    Dish name      […]                                     │
│    Description    […]                                     │
│                                                           │
│  ─ Add-on (optional) ────────────────────                │
│    ☑ Include add-on this week                            │
│    Title          [ Wine Pairing             ] 12/24     │
│    Add $          [ 25 ]   (digits only)                 │
│    Note           [ Three wines, one per c…  ] 47/70     │
│                                                           │
│  ─ Footer ───────────────────────────────                │
│    ☑ Include policy line                                 │
│    Policy         [ <strong>No split…</strong>] 105/120  │
│                                                           │
│  [ Preview ]   [ Save & Publish ]                        │
└───────────────────────────────────────────────────────────┘
```

The "Include add-on" toggle simply clears `addon.title` to "" when off (which the renderer interprets as "remove the block"). Same for the policy line.

---

## 8. Gotchas

- **Don't ASCII-fold smart punctuation.** Curly apostrophes (`’`), middle dots (`·`), en/em dashes (`–` / `—`) are intentional. The owner is precise about typography.
- **The word `extravaganza` is banned** in any Siena menu copy. Block it in the editor.
- **Don't print "Tuesday & Wednesday" anywhere.** The menu only goes out on those nights; calling it out is redundant.
- **Don't lean on description length.** Even though the body absorbs slightly long copy, exceeding 140 chars on a description risks the add-on or weekly footer overlapping. Treat the cap as a hard limit.
- The hard-cover holder clips ~0.25–0.3in off the bottom corners on insert. The asymmetric `0.7in` bottom padding keeps the footnote clear; do not "normalize" the page padding to symmetric values.

---

## 9. Files in this handoff

| File | Purpose |
|---|---|
| `template.html` | The frozen layout with `data-*` hooks. Self-hosts Playfair from `fonts/`; loads Montserrat from Google. |
| `render.js` | UMD renderer. Single source of truth for JSON → HTML. |
| `menu-data.json` | Realistic seed data. Drop-in starting point for the first published menu. |
| `expected-render.html` | Snapshot baseline. The exact output of `render(template, menu-data.json)`. |
| `snapshot-test.spec.js` | Vitest test that runs the renderer in JSDOM and diffs against the baseline. |
| `BUILD-SPEC.md` | This document. |
| `README.md` | Quickstart. |
| `fonts/` | Self-hosted Playfair Display variable + italic variable. |

---

## 10. Test workflow when the design changes

1. Edit `template.html` (and/or `menu-data.json`).
2. Re-render: run `render(template, menu-data.json)` and overwrite `expected-render.html` with the output.
3. Commit `template.html`, `menu-data.json`, and `expected-render.html` together.
4. The snapshot test passes again because new expected = new render output.

Snapshot diffs are how the team catches accidental layout drift in this handoff.
