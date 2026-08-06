# Build Spec — Siena Drinks &amp; Dessert Menu Editor

Read `README.md` first.

This is a **new, structurally different menu** from the others in this
project (Dinner, Happy Hour, Monday, Tue–Wed, Weekend). Read this whole
document before wiring the editor — the physical product and the
constraint model are both unlike anything you've built for the other
menus.

---

## 0. The physical product (READ THIS FIRST)

This is **not** a folded multi-page menu. It's **four separate insert
cards**, each 4.25in × 11in, that slide into a hard menu holder with
corners that grip each card individually. **Dolci is no longer one of
them** — it's now its own standalone insert, produced as a separate
two-up print sheet (see `../Dessert Menu.dc.html`). Don't reintroduce it
here.

**⚠️ Aug 2026 corner-clip fix:** the holder's angled corner grips were
covering the bottom-left/bottom-right of Spirits & Beer and Dopa Cena
(the two densest cards — Cocktails/Spritz never ran deep enough to reach
that zone). Fixed directly in `template.html` in two rounds — a first
padding-only pass, then Joe measured the holder directly and asked for a
specific amount more clearance per card (3/4in on Spirits & Beer, 1/4in
on Dopa Cena). Closing that second, larger gap needed more than padding
alone without shrinking the whole card further, so the item name/price
base font size on those two cards also dropped 1pt (12→11 / 11→10) —
subsection titles, item descriptions, and the page title itself were
left untouched, per Joe's explicit instruction to only touch "the
largest fonts." The `shrink-1pt` emergency ladder was moved one step
further down (11→10 / 10→9) to match. Top padding on all 4 cards is now
frozen — don't reduce it further without checking with Joe first.

**Gotcha hit while verifying this fix:** a naive fit check done
immediately after page load can read as "fits, no shrink needed" even
when the true (fonts-fully-loaded) answer is "needs the shrink" — Playfair
Display is a variable font and `document.fonts.ready` can resolve slightly
before its metrics have actually settled, so `validate()`'s async
`fonts.ready.then(...)` call may not have run yet at the moment you check
`scrollHeight`/`clientHeight` (or the `shrink-1pt` class) by hand in a
console. Always wait a beat (or explicitly re-check after a short delay)
before trusting a manual fit measurement — see `waitForLayout()` in
`validate.js`, which exists specifically for this.

The four cards, in holder order:

1. **Signature Cocktails**
2. **Spritz Menu** — new. Guests pick any spirit off a list; every
   spritz is the same price. See §1a for its dual-design mechanic.
3. **Spirits & Beer** (Rye/Whiskey/Bourbon, Single Malt Scotch Whisky, Bottled Beer)
4. **Siena Dopa Cena** (Digestivo, Grappa, Ports, Cognac &amp; Calvados, Traditional Italian)

They are produced from **two physical 8.5×11 sheets**, each cut with a
**single vertical cut down the middle**:

| Sheet | Left half | Right half |
|---|---|---|
| **Sheet A** | Signature Cocktails | Spritz Menu |
| **Sheet B** | Spirits & Beer | Siena Dopa Cena |

`template.html` models this directly: two `<div class="sheet">` elements
(8.5×11in each, `page-break-after` between them for print), each
containing two `<div class="page">` halves (4.25×11in) side by side with
a dashed `.cut-guide` down the middle showing staff where to cut.

### Why this matters for printing &amp; reprints

**If only the Spritz Menu changes, reprint Sheet A only** — and if only
Spirits/Dopa Cena change, reprint Sheet B only. This is the whole reason
the two sheets are independent print units instead of one 4-page job.
Build the print UI so a manager can choose:

- **Print both sheets** (default — full new menu set)
- **Print Sheet A only** (Cocktails + Spritz Menu changed)
- **Print Sheet B only** (Spirits & Beer + Dopa Cena changed)

`template.html` already supports this: add `print-sheet-a-only` or
`print-sheet-b-only` to `<body>`'s class list before calling
`window.print()` (see `@media print` rules in the template — the other
sheet gets `display: none`). Remove the class afterward. No class → both
sheets print.

---

## 1a. Spritz Menu — one shared data set, two swappable designs

The Spritz card is not a fixed design — the manager can toggle between
two layouts at any time from a "choose your design" screen in the editor
(not a one-time decision; it stays reachable for as long as the menu
exists):

- **Design A** — single flat list, item name + tasting note, top to bottom.
- **Design B** — the same items grouped under three fixed headings
  ("Bitter & Bright", "Herbal & Aromatic", "Rich & Earthy"), driven by
  each item's `category`.

**Both designs read the exact same `data.spritz.items` array.** There is
only one data set, never two — this is the whole point: toggling designs
is instant and never loses anything the manager typed, because nothing
is duplicated or converted between formats. Design A simply ignores each
item's `category` field; Design B sorts by it. Every item should carry a
`category` anyway (see §3) so switching to Design B never surprises the
manager with an unsorted item.

The header block above the list — "new" kicker, "Spritz Menu" title,
"Choose Your Spirit" subhead, the single price, and the "every spritz is
topped with prosecco and soda" tagline — is **identical between the two
designs** and lives once in the template (`.spritz-kicker`/
`.spritz-subhead`/`.spritz-price`/`.spritz-tagline-wrap`). Only the
item-list portion below it swaps. Don't duplicate the header per design —
if it ever needs to change, it changes once for both.

`render.js` hydrates BOTH designs' list containers every time it runs
(cheap at ≤12 items) and sets which one is visible via a
`spritz-design-b` class on `<body>`, read from `data.spritz.design` — or
overridden via a 3rd `render(doc, data, { spritzDesign: "b" })` argument.
**Build the "choose your design" screen as two separate rendered
instances** (two preview iframes/documents, each given the same
`data.spritz` but a forced `spritzDesign` override) so both can be shown
side by side at once — don't try to show both inside one DOM, since the
non-active one is `display:none` and can't be measured (see §8).

### Price is a page-level exception

Every other price on this menu omits the `$` glyph (see §3). **The
Spritz price is a deliberate, isolated exception** — it prints as `$12`.
This was an explicit owner decision for this one page; don't "fix" it to
match the rest of the menu, and don't let it set a precedent elsewhere.

---

## 1. Constraint model — validate.js + a single 1pt shrink step

**This menu has open-ended item counts.** Managers can add or remove
bourbons, scotches, beers, cocktails, dopa-cena items, or spritzes at
will — there is no hard max (spritz targets 9–12 items, but that's a
layout target, not an enforced ceiling — validate.js is the real limit,
same as everywhere else on this menu). There is also no auto-fit ladder
like the Weekend menu's (no eyebrow/hours line to hide here — these are
dense lists, not a hero layout). Instead:

1. After every edit, render the candidate data into a live preview and
   call `SienaDrinksDessertValidate.validate(previewDoc)`.
2. The validator measures each of the four `.page` cards **independently**
   (they're four separate physical cards — one can overflow while its
   neighbors have slack).
3. **If a page overflows at normal type size**, the validator tries
   exactly **one** fallback: it adds the `shrink-1pt` class to *that page
   only*, which (via CSS already in `template.html`) drops every
   data-driven text run — item names, prices, descriptions — by exactly
   1pt. Page titles and subsection titles are never touched; they're
   static chrome.
4. If the page fits after that single step, the save proceeds — show the
   manager a subtle "this card is now at reduced type" indicator so
   they know it happened.
5. **If it still doesn't fit, block the save.** There is no second shrink
   step and no further ladder. Surface the message using
   `report.pages[i].worstList` — e.g. *"Spirits doesn't fit. Bottled Beer
   is the largest section on that card — remove an item there, or shorten
   / remove a Dopa Cena description elsewhere."* For Spritz, remember this
   only tells you about whichever design is currently active — a count
   that fits Design A might not fit Design B (three subsection titles eat
   some of the vertical budget Design A doesn't spend). If the manager is
   choosing between designs, validate both (see §1a).

This is why item counts have **no printed maximum** in this doc: the real
limit is "however many items fit at full size, plus however many more
fit after the one-step shrink." That number is a moving target as
managers edit descriptions and add/remove items, so validate.js is the
only source of truth — don't hardcode a count into the editor UI.

### Why not an auto-fit ladder (settle.js) like Weekend?

The Weekend menu can shed non-essential chrome (an eyebrow, a day-of-week
line, a footer) to buy vertical space. These four cards don't have
comparable disposable chrome — a Spirits card is just a dense price list
top to bottom. Silently degrading it further than the one approved 1pt
step would make it look broken rather than intentionally condensed. Block
instead, and tell the manager exactly what's too big.

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
  "dopaCena": {
    "digestivo":          [ /* open-ended */ { "id": "dc-d1", "name": "Aperol", "price": "8.00" } ],
    "grappa":              [ /* open-ended — any item MAY carry `desc` */ ],
    "ports":               [ /* open-ended */ ],
    "cognac":              [ /* open-ended */ ],
    "traditionalItalian":  [ /* open-ended */ ]
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
which always renders WITH one** (`"12"` → prints `$12`). This is the one
intentional exception on this menu; see §1a. Everywhere else, store
`"13.00"`, `"7.50"`, `"11"` in the JSON. The card never prints a dollar
sign there, and the renderer also formats for display: a trailing
`".00"` is dropped (`"13.00"` → `"13"`); any other cents are kept
(`"6.50"` stays `"6.50"`). Store full-precision values in the JSON — let
`render.js`'s `formatPrice()`/`formatSpritzPrice()` handle the display
trim; don't pre-strip `.00` or prepend `$` yourself.

### Item shape by list

| List | Fields | Notes |
|---|---|---|
| `cocktails[i]` | `id`, `name`, `desc` (required), `price` (required), `note` (optional) | `note` is the small italic line under the description — e.g. the Siena Margarita's floater upsell. Empty/missing → line removed entirely. |
| `spirits.bourbon\|scotch\|beer[i]` | `id`, `name`, `price` (required) | **No description field exists for Spirits & Beer, by design** — these are name+price only, matching the current printed list. Don't add a `desc` key here; `render.js` doesn't read one. |
| `dopaCena.<subsection>[i]` | `id`, `name`, `price` (required), `desc` (optional) | **Any item in any Dopa Cena subsection may carry `desc`** — it is not reserved for a particular item (the seed happens to put one on "Il Poggione \"Paganelli\"" → Brunello Riserva di Montalcino, but that's just today's content). Empty/missing → line removed. Per the constraint model, adding descriptions eats vertical budget — validate.js will tell the manager when a card runs out of room (see §1). |
| `spritz.items[i]` | `id`, `name`, `desc` (required), `category` (required: `bright`\|`herbal`\|`earthy`) | No per-item price — see `spritz.price` above. `desc` is the tasting note, shown by both designs. `category` only visibly matters in Design B but should still be set for every item — see §1a. |

### IDs

Opaque, stable, mint-once per new item — same convention as the other
Siena handoffs. Never recycle a deleted item's ID for a new one in that
slot.

---

## 4. Editable fields — full reference

| Field | JSON path | Required? | Notes |
|---|---|---|---|
**Font system:** page titles, subsection titles, all prices, and the two
"title" name fields — cocktail name and dolci name — are set in Playfair
Display italic. Spirits & Beer and Dopa Cena item names, plus every
description, are set in Montserrat. Don't reintroduce Montserrat on
cocktail/dolci names, or Playfair on spirits/dopa-cena names.

| Cocktail name | `cocktails[i].name` | required | Playfair italic 16pt (shrinks to 15pt). |
| Cocktail description | `cocktails[i].desc` | required | Montserrat 12pt (shrinks to 11pt), wraps freely. |
| Cocktail price | `cocktails[i].price` | required | Playfair italic. No `$`, trailing `.00` dropped for display. |
| Cocktail note | `cocktails[i].note` | optional | Montserrat. Empty/missing removes the line. |
| Spirits & Beer item name | `spirits.<sub>[i].name` | required | Montserrat semibold 11pt (shrinks to 10pt). Dropped from 12pt in the Aug 2026 corner-clip fix — see §0. |
| Spirits & Beer item price | `spirits.<sub>[i].price` | required | Playfair italic 10pt (shrinks to 9pt), dropped from 11pt same fix. No `$`, trailing `.00` dropped for display. |
| Dopa Cena item name | `dopaCena.<sub>[i].name` | required | Montserrat semibold 11pt (shrinks to 10pt). Dropped from 12pt in the Aug 2026 corner-clip fix — see §0. |
| Dopa Cena item price | `dopaCena.<sub>[i].price` | required | Playfair italic 10pt (shrinks to 9pt), dropped from 11pt same fix. No `$`, trailing `.00` dropped for display. |
| Dopa Cena item description | `dopaCena.<sub>[i].desc` | optional | **Available on every item, every subsection.** Empty/missing removes the line. Governed entirely by validate.js — see §1. |
| Spritz price | `spritz.price` | required | Playfair italic, larger, part of the shared header. **Prints WITH `$`** — the one exception on this menu. Not part of the 1pt shrink (see §1a). |
| Spritz design | `spritz.design` | required | `"a"` or `"b"` — set by the "choose your design" screen, not free text. |
| Spritz item name | `spritz.items[i].name` | required | Montserrat bold, 12pt (11pt in Design B, shrinks 1pt further). |
| Spritz item description | `spritz.items[i].desc` | required | Montserrat, tasting note. Shown by both designs. |
| Spritz item category | `spritz.items[i].category` | required | `"bright"` \| `"herbal"` \| `"earthy"`. Only visibly sorts Design B; still required on every item (see §1a). |

### Add / remove / reorder

Every list above supports add, remove, and reorder — there is no
printed maximum (see §1). The editor:

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
  Beer", "Siena Dopa Cena" — plus their flanking dark rules.
- The entire Spritz header block: the "new" kicker, "Choose Your Spirit"
  subhead, and "every spritz is topped with prosecco and soda" tagline —
  identical in both designs, and in both designs' case the manager can
  only edit `spritz.price` within it, nothing else.
- The three Spritz Design B group headings and their order ("Bitter &
  Bright", "Herbal & Aromatic", "Rich & Earthy") — fixed; the editor
  cannot add, rename, or reorder groups. Only which `category` each item
  carries (and therefore which group it lands in) is editable.
- The eight Spirits/Dopa Cena subsection titles: "Rye / Whiskey / Bourbon",
  "Single Malt Scotch Whisky", "Bottled Beer" (on the Spirits & Beer card);
  "Digestivo", "Grappa · 2.5 oz", "Ports · 2.5 oz", "Cognac &amp;
  Calvados", "Traditional Italian · 2.5 oz" (on the Dopa Cena card).
- The number and order of subsections on Spirits & Beer (always 3, in
  that order) and Dopa Cena (always 5, in that order). The editor cannot
  add a 4th Spirits & Beer category or a 6th Dopa Cena category, rename
  any of them, or reorder them. **Only the items within a subsection are
  editable.**
- The order of the four cards themselves, and which two share a sheet.
- The `.cut-guide` dashed line, all typography, colors, and page padding.
- Fonts, page size (4.25×11in per card / 8.5×11in per printed sheet).

If a manager wants a new subsection, a renamed page title, or a
different card order, that's an owner-level design change — surface it
as a request, don't build it into the editor.

---

## 6. DOM hooks (for renderer reference)

| Slot family | Selector pattern | Field |
|---|---|---|
| Card container | `[data-page-id="cocktails\|spritz\|spirits\|dopacena"]` | validate.js measures this |
| Sheet container | `[data-sheet-id="a\|b"]` | print-scope toggle target |
| Editing-mode flag | `body.is-editing` | see "Dopa Cena editing spacing" below |
| Spritz design flag | `body.spritz-design-b` | set by render.js from `spritz.design` (or an override); absent = Design A |
| Any list | `[data-list-id="…"]` | render.js clears + repopulates; validate.js's `worstList` diagnostic |
| List IDs | `cocktails`, `spirits-bourbon`, `spirits-scotch`, `spirits-beer`, `dopacena-digestivo`, `dopacena-grappa`, `dopacena-ports`, `dopacena-cognac`, `dopacena-traditionalItalian`, `spritz-a`, `spritz-b-bright`, `spritz-b-herbal`, `spritz-b-earthy` | maps 1:1 to the JSON paths in §3 — the four `spritz-*` lists all draw from the one `spritz.items` array (see §1a) |
| Item | `[data-item-id="…"]` | one per JSON item, opaque stable ID |

The renderer uses `textContent` exclusively — no `innerHTML` anywhere in
this menu (no field on this menu needs HTML formatting, unlike the
Weekend menu's `policy_line`).

---

## 7. Editor UI sketch

Four collapsible panels (one per card), each with a live preview pane
that re-renders and re-validates on every edit. Spritz panel also has a
"Change design →" link that opens the choose-your-design screen at any
time — status line: Cocktails / Spritz / Spirits / Dopa Cena, each fits
or "fits (reduced type)"; any failure names the worst list, save is
disabled while any card reports fits:false, and a print dropdown offers
both sheets / Sheet A only / Sheet B only.

The **"choose your design" screen** (opened from the Spritz panel, and
reachable again later — the manager is never locked in) shows Design A
and Design B side by side, each its own `render()` call against the SAME
`spritz` data — one forced to `spritzDesign: "a"`, the other to `"b"`
(see §1a) — each with its own fit status and a "Use this one" button.
Nothing is converted or duplicated between them, so "Use this one" just
writes `spritz.design` and closes the screen.

- Every list item has drag-to-reorder within its list; dragging across
  lists (e.g. a beer into the bourbon list) is blocked.
- On the Dopa Cena panel, each item's description is a **collapsed
  "+ description" toggle by default** (most items don't have one) that
  expands into a textarea when clicked.
- On the Spritz panel, `category` is a required 3-option select (Bitter
  & Bright / Herbal & Aromatic / Rich & Earthy) on every item, regardless
  of which design is currently active.
- Debounce re-render + re-validate ~300–500ms after the last keystroke.
- "Save" is disabled while `report.fits === false` on any card.
- The print control is a small dropdown: "Print both sheets" (default),
  "Print Sheet A only", "Print Sheet B only" — wires to the `body` class
  toggle described in §0.

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
- **The 1pt shrink is per-page, not global.** Spirits can be at reduced
  type while Cocktails, Spritz, and Dopa Cena stay full size. This is
  correct — they're four independent physical cards.
- **No `$` in the JSON — except `spritz.price`.** See §3. This is the #1
  way a first pass at this data gets it wrong (copying the Weekend/Dinner
  convention, which DOES store `$` everywhere) — and the Spritz exception
  is just as easy to get backwards (don't strip `$` there, or add it
  everywhere else).
- **Spirits genuinely has no description field.** Don't add one "for
  consistency" with Dopa Cena — `render.js` has no code path for it and
  the layout wasn't budgeted for it.
- **Spritz's two designs share one data set, not two.** Never introduce
  a second `items` array "for design B" — that's exactly the duplication
  that would make toggling designs lossy. Design B derives its grouping
  from `category` at render time; it doesn't need its own storage.
- **A hidden Spritz design can't be measured.** Within one DOM, the
  inactive design's content is `display:none`, so `scrollHeight`/
  `clientHeight` both read 0 and validate.js would misreport it as
  "fits". To check the other design's fit, re-render with the other
  `spritzDesign` forced and validate that — see §1a and §7.
- **Reprints:** always ask "which sheet(s) changed?" before printing —
  see §0. Printing both sheets on every small edit works but wastes
  paper on the unchanged half.
- **Dopa Cena editing spacing:** the five subsection titles on that card
  carry generous margins by default (that's the printed/preview look).
  Add the `is-editing` class to `<body>` while the manager is actively
  editing that panel to tighten those same gaps for a denser editing
  view; remove it when the panel loses focus / on save. `validate.js`
  ignores this class automatically (it strips it before measuring and
  restores it after) — the fit check always applies to the spread-out
  print spacing, never the tightened editing spacing, so you can't
  accidentally validate a layout that wouldn't actually fit on paper.
- **Special characters:** preserve curly quotes (`'`, `"…"`), en/em
  dashes (`–`, `—`), middle dots (`·`), and accented letters (`è`, `à`).
  Don't ASCII-fold on save.
- **Empty values:** never allow an empty item name anywhere, or an empty
  price on cocktails/spirits/dopa-cena items, or an empty `spritz.price`.
  Cocktail description and every Spritz item's description are required;
  Dopa Cena description and cocktail note are the only two truly
  optional text fields on this menu.

---

## 9. What "done" looks like

- Editor loads all four cards from the seed data, populated exactly as
  in `expected-render.html`.
- Manager adds a 12th bourbon → Spirits card re-renders with 12 rows →
  validator runs → if it still fits, save proceeds; if not, the card
  shows `shrink-1pt` applied automatically and still fits, or the save
  is blocked with a message naming Bottled Beer/Bourbon/Scotch as the
  worst section.
- Manager adds a description to a Cognac item that's never had one →
  Dopa Cena card re-validates; if it now overflows and the 1pt shrink
  doesn't save it, the manager sees a message telling them to remove a
  description or an item.
- Manager removes the Siena Margarita's floater note → the note line
  disappears entirely from the rendered card, not just goes blank.
- Manager reorders cocktails by drag → save → reload → new order
  persists and prints in that order.
- Manager adds a 10th spritz with a new tasting note and category →
  both Design A and Design B re-render from the same data; whichever is
  currently active is what shows and prints.
- Manager opens "choose your design", sees Design A and B rendered side
  by side from current data, picks Design B → `spritz.design` becomes
  `"b"` → live page 2 is now the grouped layout, and reopening the
  screen later still offers both, unchanged.
- Manager selects "Print Sheet B only" after only editing Dopa Cena →
  only the Spirits & Beer + Dopa Cena sheet goes to the printer.
- Snapshot test passes in CI (`snapshot-test.spec.mjs`).
- Owner can demo to a manager in a few minutes.
