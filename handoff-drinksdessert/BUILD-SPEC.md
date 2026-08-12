# Build Spec — Siena Drinks Menu Editor

Read `README.md` first.

This is a **new, structurally different menu** from the others in this
project (Dinner, Happy Hour, Monday, Tue–Wed, Weekend). Read this whole
document before wiring the editor.

---

## 0. The physical product (READ THIS FIRST)

This is **not** a folded multi-page menu. It's **four separate insert
cards**, each 4.25in × 11in, that slide into a hard menu holder with
corners that grip each card individually. Dolci is not one of them —
it's its own standalone insert, produced as a separate two-up print
sheet (see `../Dessert Menu.dc.html`). Don't reintroduce it here.

The four cards, in holder order:

1. **Signature Cocktails**
2. **Spritz Menu** — guests pick any spirit off a list; every spritz is
   the same price. See §1a for its dual-design mechanic.
3. **Spirits & Beer** (Rye/Whiskey/Bourbon, Single Malt Scotch Whisky,
   Bottled Beer)
4. **Liquori** (Tequila, Gin, Vodka, Rum) — a curated top-shelf list, see
   §1c. This replaced an earlier "Siena Dopa Cena" card; if you find that
   name anywhere outside this handoff, it's stale.

They are produced from **two physical 8.5×11 sheets**, each cut with a
**single vertical cut down the middle**:

| Sheet | Left half | Right half |
|---|---|---|
| **Sheet A** | Signature Cocktails | Spritz Menu |
| **Sheet B** | Spirits & Beer | Liquori |

`template.html` models this directly: two `<div class="sheet">` elements
(8.5×11in each, `page-break-after` between them for print), each
containing two `<div class="page">` halves (4.25×11in) side by side with
a dashed `.cut-guide` down the middle showing staff where to cut.

### Why this matters for printing & reprints

**If only the Spritz Menu changes, reprint Sheet A only** — and if only
Spirits/Liquori change, reprint Sheet B only. Build the print UI so a
manager can choose:

- **Print both sheets** (default — full new menu set)
- **Print Sheet A only** (Cocktails + Spritz Menu changed)
- **Print Sheet B only** (Spirits & Beer + Liquori changed)

`template.html` already supports this: add `print-sheet-a-only` or
`print-sheet-b-only` to `<body>`'s class list before calling
`window.print()` (see `@media print` rules in the template — the other
sheet gets `display: none`). Remove the class afterward. No class → both
sheets print.

---

## 1b. The holder crop line — a second, stricter fit constraint

The physical menu holder does not expose the full 11in of a card — its
viewing window hides everything below **9.96in from the top of any
card**. This is a **fixed hardware constant**, not tied to any one
card's current content. It happens to equal where the Signature
Cocktails card's last line currently falls, because that's how it was
derived — but treat it as permanent: if Cocktails' copy later gets
shorter, this line does **not** move up, and a card can still be
correctly rejected for crossing it even while comfortably fitting inside
the 11in physical card.

`validate.js` checks this independently of the ordinary bottom-of-card
overflow check — see its file header for the exact mechanics
(`cropLineOk` / `CROP_LINE_IN`). A page can pass one check and fail the
other. Both must pass for a page to report `fits: true`.

If a future redesign genuinely changes the holder hardware, update
`CROP_LINE_IN` in `validate.js` and this section together — never let
one drift from the other.

---

## 1c. Liquori — curated, not open-ended

Liquori is the one card on this menu that does **not** follow the
open-ended "manager adds/removes freely, validate.js decides what fits"
model used everywhere else. Its four categories (Tequila, Gin, Vodka,
Rum) are fixed, in that order — same as Spirits & Beer's three
subsections — but the **items within each category are a hand-curated
subset of a larger house liquor list**, not a live editable list in the
same sense as Bourbon/Scotch/Beer.

The rule used to build the current seed content, and to use any time the
source liquor list changes:

1. Within each category, sort by price, highest to lowest.
2. Trim each category's list so the four categories end up with roughly
   the same number of items — a big price-tier cluster in one category
   (e.g. Vodka) doesn't mean that category should dominate the page.
3. The trimmed content must satisfy **both** `validate.js` checks: fits
   the 11in card, and clears the holder crop line (§1b) — checked
   against the **Cocktails card specifically**, since Liquori and
   Cocktails are not on the same physical sheet but the crop line
   constant applies to every card equally.
4. Re-run `validate.js` after any change to the trimmed set. If it fails,
   trim further (drop the next-lowest-priced item in the largest
   category) rather than shrinking below the standard type size — the
   1pt shrink step still applies here like any other page, but don't
   lean on it as the primary lever for a curated list.

**Editor implication:** don't build the same add/remove-item UI for
Liquori that Spirits & Beer gets. If the owner wants to swap which
liquors appear, that's closer to a content/design revision (re-run the
curation process above) than a routine menu edit — surface it as such,
or at minimum re-validate very deliberately after any change here.

---

## 1a. Spritz Menu — one shared data set, two swappable designs

The Spritz card is not a fixed design — the manager can toggle between
two layouts at any time from a "choose your design" screen in the editor
(not a one-time decision; it stays reachable for as long as the menu
exists):

- **Design A** — single flat list, item name + tasting note, top to bottom.
- **Design B** — the same items grouped under three fixed headings
  ("Bitter & Bright", "Herbal & Aromatic", "Rich & Earthy"), driven by
  each item's `category`, each heading flanked by small ornamental rules
  (see §5 — added on top of the plain subsection-title style).

**Both designs read the exact same `data.spritz.items` array.** There is
only one data set, never two. Design A simply ignores each item's
`category` field; Design B sorts by it. Every item should carry a
`category` anyway so switching to Design B never surprises the manager
with an unsorted item.

The header block above the list — "new" kicker, "Spritz Menu" title
(flanked by the same dark rules as the Liquori title — see §5), "Choose
Your Spirit" subhead, the single price, and the "every spritz is topped
with prosecco and soda" tagline — is **identical between the two
designs** and lives once in the template. Only the item-list portion
below it swaps.

**Item typography:** the spritz item name is set in **Playfair Display
italic** (matching the cocktail-name treatment), not Montserrat — this
was a deliberate style change; don't revert it to Montserrat bold. The
tasting-note description stays Montserrat.

### Price is a page-level exception

Every other price on this menu omits the `$` glyph (see §3). **The
Spritz price is a deliberate, isolated exception** — it prints as `$12`.
Don't "fix" it to match the rest of the menu.

---

## 1. Constraint model — validate.js + a single 1pt shrink step

**Cocktails, Spirits & Beer, and Spritz have open-ended item counts.**
Managers can add or remove bourbons, scotches, beers, cocktails, or
spritzes at will — there is no hard max (spritz targets 9–12 items, but
that's a layout target, not an enforced ceiling). Liquori does not
follow this model — see §1c. Instead, for the open-ended cards:

1. After every edit, render the candidate data into a live preview and
   call `SienaDrinksDessertValidate.validate(previewDoc)`.
2. The validator measures each of the four `.page` cards **independently**
   (they're four separate physical cards — one can overflow while its
   neighbors have slack), against **both** the bottom-of-card check and
   the holder crop line (§1b).
3. **If a page fails either check at normal type size**, the validator
   tries exactly **one** fallback: it adds the `shrink-1pt` class to
   *that page only*, which (via CSS already in `template.html`) drops
   every data-driven text run — item names, prices, descriptions — by
   exactly 1pt. Page titles and subsection titles are never touched;
   they're static chrome.
4. If the page passes both checks after that, the save proceeds — show
   the manager a subtle "this card is now at reduced type" indicator.
5. **If it still doesn't pass, block the save.** There is no second
   shrink step and no further ladder. Surface the message using
   `report.pages[i].worstList` — e.g. *"Spirits doesn't fit. Bottled Beer
   is the largest section on that card — remove an item there, or shorten
   the list."* For Spritz, remember this only tells you about whichever
   design is currently active — validate both if the manager is choosing
   between designs (see §1a).

### Why not an auto-fit ladder (settle.js) like Weekend?

These cards don't have disposable chrome — a Spirits card is just a
dense price list top to bottom. Silently degrading it further than the
one approved 1pt step would make it look broken. Block instead, and tell
the manager exactly what's too big.

### Soft sanity guards (optional)

Keep loose sanity caps purely to catch accidental paste-a-paragraph
errors — e.g. name ≤ 60 chars, description ≤ 200 chars. These are NOT the
real enforcement; `validate.js` is.

---

## 2. UMD contract

Two UMD modules ship in this package:

```js
SienaDrinksDessertRender.render(document, data);     // mutates DOM in place
SienaDrinksDessertValidate.validate(document);       // measures & reports; needs a real browser
```

- Both are self-contained UMD files (browser global + `module.exports`).
- `render()` never checks fit — it's pure hydration.
- `validate()` requires a real CSS layout engine (`getBoundingClientRect`,
  `scrollHeight`/`clientHeight`). **JSDOM cannot host it.** The snapshot
  test only exercises `render.js`.

---

## 3. Data shape

```jsonc
{
  "cocktails": [ /* open-ended */ {
    "id": "ck-1", "name": "Godfather",
    "desc": "Maker's Mark Bourbon and Amaretto Disaronno. Brando's drink on set!",
    "price": "14.00",
    "note": ""            // OPTIONAL — empty/missing removes the note line entirely
  } ],
  "spirits": {
    "bourbon": [ /* open-ended */ { "id": "sp-b1", "name": "Bulleit Bourbon", "price": "13.00" } ],
    "scotch":  [ /* open-ended */ ],
    "beer":    [ /* open-ended */ ]
  },
  "liquori": {
    // Fixed 4 categories, in this order. Curated, not open-ended — see §1c.
    "tequila": [ { "id": "lq-tq1", "name": "Don Julio 1942", "price": "42.00" } ],
    "gin":     [ /* … */ ],
    "vodka":   [ /* … */ ],
    "rum":     [ /* … */ ]
  },
  "spritz": {
    "price": "12",           // single price for the WHOLE page — the one place `$` prints, see below
    "design": "a",           // "a" (flat list) | "b" (grouped by category) — which one is currently live
    "items": [ /* open-ended, targets 9–12 */ {
      "id": "sp-1", "name": "Aperol",
      "desc": "Orange and rhubarb, gently bitter, easy sipping.",
      "category": "bright"   // "bright" | "herbal" | "earthy" — read by design B only, ignored by design A
    } ]
  }
}
```

### Price convention

**Prices never include the `$` glyph, anywhere — except `spritz.price`,
which always renders WITH one** (`"12"` → prints `$12`). Everywhere else,
store `"13.00"`, `"7.50"`, `"11"` in the JSON. The renderer formats for
display: a trailing `".00"` is dropped (`"13.00"` → `"13"`); any other
cents are kept (`"6.50"` stays `"6.50"`). Store full-precision values in
the JSON — let `render.js`'s `formatPrice()`/`formatSpritzPrice()` handle
the display trim.

### Item shape by list

| List | Fields | Notes |
|---|---|---|
| `cocktails[i]` | `id`, `name`, `desc` (required), `price` (required), `note` (optional) | `note` is the small line under the description — e.g. the Siena Margarita's floater upsell. Empty/missing → line removed entirely. |
| `spirits.bourbon\|scotch\|beer[i]` | `id`, `name`, `price` (required) | **No description field** — name+price only. Don't add a `desc` key here. |
| `liquori.tequila\|gin\|vodka\|rum[i]` | `id`, `name`, `price` (required) | **No description field**, same as Spirits. Curated per §1c, not freely open-ended. |
| `spritz.items[i]` | `id`, `name`, `desc` (required), `category` (required: `bright`\|`herbal`\|`earthy`) | No per-item price — see `spritz.price` above. `desc` is the tasting note, shown by both designs. |

### IDs

Opaque, stable, mint-once per new item — same convention as the other
Siena handoffs. Never recycle a deleted item's ID for a new one in that
slot.

---

## 4. Editable fields — full reference

**Font system:** page titles, subsection titles, all prices, and the
cocktail/spritz item names are set in Playfair Display italic. Spirits &
Beer and Liquori item names, plus cocktail/spritz descriptions, are set
in Montserrat. Don't reintroduce Montserrat on cocktail/spritz names, or
Playfair on spirits/liquori names.

| Field | JSON path | Required? | Notes |
|---|---|---|---|
| Cocktail name | `cocktails[i].name` | required | Playfair italic ~16pt (shrinks to ~15pt). |
| Cocktail description | `cocktails[i].desc` | required | Montserrat ~12pt (shrinks to 11pt), wraps freely. |
| Cocktail price | `cocktails[i].price` | required | Playfair italic. No `$`, trailing `.00` dropped for display. |
| Cocktail note | `cocktails[i].note` | optional | Montserrat. Empty/missing removes the line. |
| Spirits & Beer item name | `spirits.<sub>[i].name` | required | Montserrat semibold ~12pt (shrinks 1pt). |
| Spirits & Beer item price | `spirits.<sub>[i].price` | required | Playfair italic. No `$`, trailing `.00` dropped. |
| Liquori item name | `liquori.<cat>[i].name` | required (curated, §1c) | Montserrat semibold ~12pt — same treatment as Spirits & Beer. |
| Liquori item price | `liquori.<cat>[i].price` | required (curated, §1c) | Playfair italic. No `$`, trailing `.00` dropped. |
| Spritz price | `spritz.price` | required | Playfair italic, larger, part of the shared header. **Prints WITH `$`** — the one exception on this menu. |
| Spritz design | `spritz.design` | required | `"a"` or `"b"` — set by the "choose your design" screen, not free text. |
| Spritz item name | `spritz.items[i].name` | required | **Playfair Display italic** (not Montserrat — see §1a), ~12pt (shrinks 1pt). |
| Spritz item description | `spritz.items[i].desc` | required | Montserrat, tasting note. Shown by both designs. |
| Spritz item category | `spritz.items[i].category` | required | `"bright"` \| `"herbal"` \| `"earthy"`. Only visibly sorts Design B; still required on every item. |

### Add / remove / reorder

Cocktails, Spirits & Beer, and Spritz support add, remove, and reorder —
no printed maximum (see §1). Liquori does not get this UI — see §1c. The
editor, for the open-ended lists:

- Generates a fresh opaque `id` on add.
- Removes the item from its array on delete.
- Persists array order as the new canonical order (renderer prints in
  array order, top to bottom).
- Must run `validate.js` after every such change and block save on
  `fits: false`.

---

## 5. Static / not editable

Baked into `template.html`, no data hooks, not surfaced in the editor:

- The four page titles: "Signature Cocktails", "Spritz Menu", "Spirits &
  Beer", "Liquori". **Cocktails and Spirits & Beer titles are plain
  centered text — no flanking rules.** Spritz and Liquori titles keep the
  flanking dark rules. Don't make these consistent with each other; this
  split is a deliberate, current design decision.
- The entire Spritz header block: the "new" kicker, "Choose Your Spirit"
  subhead, and tagline — identical in both designs; the manager can only
  edit `spritz.price` within it.
- The three Spritz Design B group headings and their order ("Bitter &
  Bright", "Herbal & Aromatic", "Rich & Earthy"), each flanked by small
  ornamental rules — fixed; the editor cannot add, rename, reorder, or
  restyle them. Only which `category` each item carries is editable.
- The Spirits & Beer subsection titles: "Rye / Whiskey / Bourbon" and
  "Single Malt Scotch Whisky" are plain text. **"Bottled Beer" is a
  visually distinct accent treatment** — larger type (~15pt vs ~10.5pt)
  with small flanking rules, unlike its two siblings. This asymmetry is
  intentional; don't normalize all three to look the same.
- The Liquori subsection titles ("Tequila", "Gin", "Vodka", "Rum") — plain
  text, same treatment as Bourbon/Scotch (no rules, no size boost).
- The number and order of subsections on Spirits & Beer (always 3) and
  Liquori (always 4). The editor cannot add, rename, or reorder them.
- The order of the four cards themselves, and which two share a sheet.
- The `.cut-guide` dashed line, all typography, colors, and page padding.
- The holder crop line constant (§1b) — an engineering constraint, never
  a manager-facing setting.
- Fonts, page size (4.25×11in per card / 8.5×11in per printed sheet).

If a manager wants a new subsection, a renamed page title, or a
different card order, that's an owner-level design change — surface it
as a request, don't build it into the editor.

---

## 6. DOM hooks (for renderer reference)

| Slot family | Selector pattern | Field |
|---|---|---|
| Card container | `[data-page-id="cocktails\|spritz\|spirits\|liquori"]` | validate.js measures this |
| Sheet container | `[data-sheet-id="a\|b"]` | print-scope toggle target |
| Spritz design flag | `body.spritz-design-b` | set by render.js from `spritz.design` (or an override); absent = Design A |
| Any list | `[data-list-id="…"]` | render.js clears + repopulates; validate.js's `worstList` diagnostic |
| List IDs | `cocktails`, `spirits-bourbon`, `spirits-scotch`, `spirits-beer`, `liquori-tequila`, `liquori-gin`, `liquori-vodka`, `liquori-rum`, `spritz-a`, `spritz-b-bright`, `spritz-b-herbal`, `spritz-b-earthy` | maps 1:1 to the JSON paths in §3 — the four `spritz-*` lists all draw from the one `spritz.items` array (see §1a) |
| Item | `[data-item-id="…"]` | one per JSON item, opaque stable ID |

The renderer uses `textContent` exclusively — no `innerHTML` anywhere in
this menu.

---

## 7. Editor UI sketch

Four collapsible panels (one per card), each with a live preview pane
that re-renders and re-validates on every edit. Cocktails, Spirits &
Beer, and Spritz get full add/remove/reorder editing; Liquori is
presented read-mostly (see §1c) — surface its four category lists but
route a change request to the curation process rather than a plain
"+add item" flow. Spritz panel also has a "Change design →" link that
opens the choose-your-design screen at any time — status line: Cocktails
/ Spritz / Spirits / Liquori, each fits or "fits (reduced type)"; any
failure names the worst list, save is disabled while any card reports
fits:false, and a print dropdown offers both sheets / Sheet A only /
Sheet B only.

The **"choose your design" screen** (opened from the Spritz panel) shows
Design A and Design B side by side, each its own `render()` call against
the SAME `spritz` data — one forced to `spritzDesign: "a"`, the other to
`"b"` (see §1a) — each with its own fit status and a "Use this one"
button.

- Every open-ended list item has drag-to-reorder within its list;
  dragging across lists is blocked.
- On the Spritz panel, `category` is a required 3-option select on every
  item, regardless of which design is currently active.
- Debounce re-render + re-validate ~300–500ms after the last keystroke.
- "Save" is disabled while `report.fits === false` on any card.
- The print control is a small dropdown: "Print both sheets" (default),
  "Print Sheet A only", "Print Sheet B only".

---

## 8. Gotchas

- **`validate()` needs a real browser.** It calls `getBoundingClientRect`
  and reads `scrollHeight`/`clientHeight`. Run it in the editor's preview
  iframe, not in a Node/JSDOM context. The snapshot test only proves
  `render.js` is correct, not that any given edit fits the page.
- **Wait for fonts before validating.** Call
  `await SienaDrinksDessertValidate.waitForLayout(doc)` before
  `validate(doc)` — Playfair is a variable font and shifts line-heights
  slightly when it swaps in, which can flip a borderline fit/no-fit call.
  This matters even more now that Spritz item names are Playfair too.
- **The 1pt shrink is per-page, not global.** Spirits can be at reduced
  type while Cocktails, Spritz, and Liquori stay full size.
- **A page can fail on the crop line alone.** Don't assume "no
  `overflowPx`" means a page fits — check `cropLineOk` too (see §1b).
  `fits` is already the AND of both; only look at the sub-flags when
  building a diagnostic message.
- **No `$` in the JSON — except `spritz.price`.** This is the #1 way a
  first pass at this data gets it wrong (copying the Weekend/Dinner
  convention, which DOES store `$` everywhere).
- **Spirits and Liquori genuinely have no description field.** Don't add
  one "for consistency" — `render.js` has no code path for it.
- **Spritz's two designs share one data set, not two.** Never introduce
  a second `items` array "for design B."
- **A hidden Spritz design can't be measured.** Within one DOM, the
  inactive design's content is `display:none`, so its `scrollHeight`/
  `clientHeight` read 0. To check the other design's fit, re-render with
  the other `spritzDesign` forced and validate that.
- **Reprints:** always ask "which sheet(s) changed?" before printing.
- **Liquori is not a free-for-all list editor.** See §1c — treat content
  changes here as a mini re-curation pass (sort, trim to keep categories
  roughly even, validate), not a simple add/remove.
- **Special characters:** preserve curly quotes (`'`, `"…"`), en/em
  dashes (`–`, `—`), and accented letters (`è`, `à`, `ñ`). Don't
  ASCII-fold on save.
- **Empty values:** never allow an empty item name anywhere, or an empty
  price, or an empty `spritz.price`. Cocktail description and every
  Spritz item's description are required; cocktail note is the only
  truly optional text field on this menu.

---

## 9. What "done" looks like

- Editor loads all four cards from the seed data, populated exactly as
  in `expected-render.html`.
- Manager adds a 12th bourbon → Spirits card re-renders with 12 rows →
  validator runs → if it still passes both checks, save proceeds; if
  not, the card shows `shrink-1pt` applied automatically and still
  passes, or the save is blocked with a message naming Bottled Beer as
  the worst section.
- Manager removes the Siena Margarita's floater note → the note line
  disappears entirely from the rendered card, not just goes blank.
- Manager reorders cocktails by drag → save → reload → new order
  persists and prints in that order.
- Manager adds a 10th spritz with a new tasting note and category →
  both Design A and Design B re-render from the same data; whichever is
  currently active is what shows and prints; its name renders in
  Playfair italic on both.
- Manager opens "choose your design", sees Design A and B rendered side
  by side from current data, picks Design B → `spritz.design` becomes
  `"b"` → live page 2 is now the grouped layout with its ornamented
  group headings.
- Manager selects "Print Sheet B only" after only editing Liquori's
  content (via the curation process) → only the Spirits & Beer + Liquori
  sheet goes to the printer.
- A hypothetical edit that makes Liquori's last line cross the 9.96in
  holder crop line, even though the card still has slack before its own
  11in bottom, is correctly rejected by `validate.js` with
  `cropLineOk: false`.
- Snapshot test passes in CI (`snapshot-test.spec.mjs`).
- Owner can demo to a manager in a few minutes.
