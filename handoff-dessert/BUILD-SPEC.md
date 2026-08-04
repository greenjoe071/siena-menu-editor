# Build Spec — Siena Desserts Menu Editor

Read this whole document before wiring the editor. This package is
smaller than `../handoff-drinksdessert/` (one card, one field set, no
dual-design mechanic) but shares its constraint model and conventions —
read that package's `BUILD-SPEC.md` too if anything here is unclear.

---

## 0. The physical product (READ THIS FIRST)

One insert card, **4.25in × 11in** — the same size and the same holder as
the 4 cards in `../handoff-drinksdessert/` (Cocktails, Spritz, Spirits &
Beer, Dopa Cena). This card used to be the "Dolci" page on the old
combined Drinks & Dessert card; it's now a standalone insert with its
own editor surface.

It prints **two-up on a single 8.5×11 sheet**: two IDENTICAL copies of
the same card, side by side, with a dashed cut-guide down the middle for
staff to cut. This is the same physical mechanic as the Drinks Menu's
Sheet A / Sheet B — **except both halves here are the SAME card**, not
two different ones. The point is purely to save paper: printing one
8.5×11 sheet gets you 2 copies of this card, instead of printing two
separate 8.5×11 sheets.

`template.html` models this as one `<div class="sheet">` containing two
`<div class="page" data-page-id="dessert">` elements
(`data-copy-id="1"` / `"2"`), with a `.cut-guide` between them. Both
copies are always hydrated from the exact same `data.desserts` array —
see §2.

---

## 1. Constraint model — validate.js + a single 1pt shrink step

Same layout-budget approach as the Drinks Menu (`../handoff-drinksdessert/
BUILD-SPEC.md` §1): the item list is **open-ended**, no hard cap.
However many items fit is however many the manager can have — the
enforcement is `validate.js`, not a count printed anywhere in this doc.

1. After every edit, render the candidate data into a live preview and
   call `SienaDessertValidate.validate(previewDoc)`.
2. The validator measures **only the primary copy**
   (`[data-copy-id="1"]`). Since both copies are always hydrated from the
   same data at the same size, checking one proves both — measuring both
   would be redundant work.
3. **If the primary copy overflows at normal type size**, the validator
   tries exactly **one** fallback: it adds the `shrink-1pt` class to
   **both** `[data-page-id="dessert"]` elements together (never just
   one — the two printed copies must never visually disagree), which
   drops item name/price/description by exactly 1pt. The page title
   ("Dolci") is never touched; it's static chrome.
4. If it fits after that single step, save proceeds — show a subtle
   "this card is now at reduced type" indicator.
5. **If it still doesn't fit, block the save.** No second shrink step,
   no further ladder. Surface `report.pages[0].worstList` (always
   `"dessert-1"` here — there's only one list per copy) in the message,
   e.g. *"Dolci doesn't fit — remove an item or shorten a description."*

### Why not an auto-fit ladder?

Same reasoning as the Drinks Menu: this card has no disposable chrome to
shed (just a title and a centered item list). Block instead of silently
degrading further than the one approved 1pt step.

---

## 2. Two identical copies, one data set — never duplicate storage

**There is only one `desserts` array, rendered into both printed
copies.** `render.js` writes the exact same items into
`[data-list-id="dessert-1"]` and `[data-list-id="dessert-2"]` every time
it runs. Do not give the editor two separate "left card" / "right card"
forms, and do not store two arrays — that would let the two printed
copies drift out of sync, defeating the entire point of "two identical
copies." One edit, one array, two renders.

---

## 3. UMD contract

```js
SienaDessertRender.render(document, data);     // mutates DOM in place
SienaDessertValidate.validate(document);       // measures & reports; needs a real browser
```

- Both are self-contained UMD files (browser global + `module.exports`).
- `render()` never checks fit — it's pure hydration, and uses
  `textContent` only (no `innerHTML` anywhere).
- `validate()` requires a real CSS layout engine
  (`getBoundingClientRect`, `scrollHeight`/`clientHeight`). **JSDOM
  cannot host it.** The snapshot test only exercises `render.js`.

---

## 4. Data shape

```jsonc
{
  "desserts": [ /* open-ended */ {
    "id": "ds-1",
    "name": "Sorbetti di Frutta",
    "desc": "Mango, Raspberry, Lemon",
    "price": "11.00"
  } ]
}
```

Every field is **required** on every item — `name`, `desc`, `price`. No
optional fields on this card (simpler than Cocktails' optional `note` or
Dopa Cena's optional `desc`). No hard per-field character limit —
loose sanity caps to catch paste errors are fine (e.g. name ≤ 60 chars,
desc ≤ 200 chars) but are not the real enforcement; `validate.js` is.

### Price convention

**Prices never include the `$` glyph** — matches every other menu in
this project except Spritz (`../handoff-drinksdessert/`), which is a
deliberate, isolated exception. Store full-precision values in the JSON
(`"11.00"`, `"8.00"`); the renderer drops a trailing `.00` for display
(`"11.00"` → `"11"`) and keeps any other cents as-is (`"6.50"` stays
`"6.50"`). Don't pre-strip `.00` or prepend `$` yourself — let
`render.js`'s `formatPrice()` handle display.

### IDs

Opaque, stable, mint-once per new item — same convention as every other
Siena handoff. Never recycle a deleted item's ID for a new one in that
slot. One item's ID appears in BOTH printed copies (it's the same item,
rendered twice).

---

## 5. Editable fields — full reference

| Field | JSON path | Required? | Notes |
|---|---|---|---|
| Item name | `desserts[i].name` | required | Playfair Display italic, 16pt (shrinks to 15pt). |
| Item description | `desserts[i].desc` | required | Montserrat, 12pt (shrinks to 11pt), wraps freely, centered. |
| Item price | `desserts[i].price` | required | Playfair Display italic, 14pt (shrinks to 13pt). No `$`; trailing `.00` dropped for display. |

### Add / remove / reorder

The list supports add, remove, and reorder — no printed maximum (see
§1). The editor:

- Generates a fresh opaque `id` on add.
- Removes the item from the array on delete.
- Persists array order as the new canonical order (renderer prints in
  array order, top to bottom, identically in both copies).
- Must run `validate.js` after every such change and block save on
  `fits: false`.

---

## 6. Static / not editable

Baked into `template.html`, no data hooks, not surfaced in the editor:

- The page title, "Dolci", plus its flanking dark rules — printed
  identically on both copies.
- The vertical centering: the title stays pinned at the top of the card;
  the item list centers in the remaining space below it. This is
  layout behavior, not a data field — nothing to expose in the editor.
- The `.cut-guide` dashed line between the two copies.
- The number of printed copies (always 2, side by side on one sheet) —
  this is not a print option like the Drinks Menu's Sheet A/B toggle;
  there's only one sheet, and it always prints both copies together.
- All typography, colors, card background, and page padding.
- Fonts, page size (4.25×11in per card / 8.5×11in per printed sheet).

If a manager wants a renamed title, a different card size, or only one
copy printed, that's an owner-level design change — surface it as a
request, don't build it into the editor.

---

## 7. DOM hooks (for renderer reference)

| Slot family | Selector pattern | Field |
|---|---|---|
| Card container (both copies) | `[data-page-id="dessert"]` | validate.js's shrink-1pt target — applied to both together |
| Card container (primary, measured) | `[data-page-id="dessert"][data-copy-id="1"]` | validate.js measures only this one |
| Card container (mirror copy) | `[data-page-id="dessert"][data-copy-id="2"]` | hydrated identically, never measured |
| Sheet container | `[data-sheet-id="dessert"]` | the one physical 8.5×11 print page |
| List, copy 1 | `[data-list-id="dessert-1"]` | render.js clears + repopulates; matches `data.desserts` |
| List, copy 2 | `[data-list-id="dessert-2"]` | same array, rendered a second time |
| Item | `[data-item-id="…"]` | one per JSON item, opaque stable ID — appears once in EACH copy |

The renderer uses `textContent` exclusively — no `innerHTML` anywhere in
this card.

---

## 8. Editor UI sketch

One panel — a single live preview pane that re-renders and re-validates
on every edit (debounce ~300–500ms after the last keystroke):

- One open-ended list: name, description, price per row. Drag-to-reorder
  within the list.
- Status line: "fits" / "fits (reduced type)" / the blocking message
  naming what to shorten or remove.
- "Save" disabled while `report.fits === false`.
- No design-choice screen, no print-sheet picker — there's exactly one
  print output (both copies together), so the print action is a single
  button.

---

## 9. Gotchas

- **`validate()` needs a real browser.** It calls
  `getBoundingClientRect` and reads `scrollHeight`/`clientHeight`. Run it
  in the editor's preview iframe, not in a Node/JSDOM context.
- **Wait for fonts before validating.** Call
  `await SienaDessertValidate.waitForLayout(doc)` before `validate(doc)`
  — Playfair is a variable font and shifts line-heights slightly when it
  swaps in, which can flip a borderline fit/no-fit call.
- **Only the primary copy is measured — but the shrink class always goes
  on both.** Never apply `shrink-1pt` to just one copy; that would print
  two cards at different type sizes, which defeats "two identical
  copies."
- **One data set, not two.** Never store a separate array "for the right
  copy" — that's exactly the duplication that would let the two printed
  copies drift apart. `render.js` always writes the same `desserts` array
  into both list containers.
- **No `$` in the JSON.** This card is not the Spritz exception (see
  `../handoff-drinksdessert/BUILD-SPEC.md` §3) — no price on this card
  ever prints with a `$`.
- **No optional fields.** Unlike Cocktails (`note`) or Dopa Cena (`desc`
  on some items), every field on a dessert item is required. Don't add
  an optional-field code path "for consistency" — this card doesn't need
  one.
- **Special characters:** preserve curly quotes, en/em dashes, middle
  dots, and accented letters (e.g. "Crème Brûlée"). Don't ASCII-fold on
  save.
- **Empty values:** never allow an empty name, description, or price.

---

## 10. What "done" looks like

- Editor loads the card from the seed data, populated exactly as in
  `expected-render.html`, identically in both printed copies.
- Manager adds a 7th dessert → both copies re-render with 7 rows →
  validator runs → if it still fits, save proceeds; if not, the card
  shows `shrink-1pt` applied to both copies and still fits, or the save
  is blocked with a message.
- Manager edits a description to be much longer → card re-validates;
  if it now overflows and the 1pt shrink doesn't save it, the manager
  sees a message telling them to shorten it or remove an item.
- Manager reorders items by drag → save → reload → new order persists
  and prints in that order, identically in both copies.
- Manager prints the card → gets one 8.5×11 sheet with two identical
  Dolci cards side by side and a cut-guide between them.
- Snapshot test passes in CI (`snapshot-test.spec.js`).
