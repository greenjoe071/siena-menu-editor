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
corners that grip each card individually.

The four cards, in holder order:

1. **Signature Cocktails**
2. **Spirits** (Rye/Whiskey/Bourbon, Single Malt Scotch Whisky, Bottled Beer)
3. **Siena Dopa Cena** (Digestivo, Grappa, Ports, Cognac &amp; Calvados, Traditional Italian)
4. **Dolci**

They are produced from **two physical 8.5×11 sheets**, each cut with a
**single vertical cut down the middle**:

| Sheet | Left half | Right half |
|---|---|---|
| **Sheet A** | Signature Cocktails | Spirits |
| **Sheet B** | Siena Dopa Cena | Dolci |

`template.html` models this directly: two `<div class="sheet">` elements
(8.5×11in each, `page-break-after` between them for print), each
containing two `<div class="page">` halves (4.25×11in) side by side with
a dashed `.cut-guide` down the middle showing staff where to cut.

### Why this matters for printing &amp; reprints

**If only Dolci changes, reprint Sheet B only** — Sheet A (Cocktails +
Spirits) does not need to come off the printer again. This is the whole
reason the two sheets are independent print units instead of one 4-page
job. Build the print UI so a manager can choose:

- **Print both sheets** (default — full new menu set)
- **Print Sheet A only** (Cocktails + Spirits changed)
- **Print Sheet B only** (Dopa Cena + Dolci changed)

`template.html` already supports this: add `print-sheet-a-only` or
`print-sheet-b-only` to `<body>`'s class list before calling
`window.print()` (see `@media print` rules in the template — the other
sheet gets `display: none`). Remove the class afterward. No class → both
sheets print.

---

## 1. Constraint model — validate.js + a single 1pt shrink step

**This menu has open-ended item counts.** Managers can add or remove
bourbons, scotches, beers, cocktails, dopa-cena items, or dolci at will —
there is no hard max. There is also no auto-fit ladder like the Weekend
menu's (no eyebrow/hours line to hide here — these are dense lists, not a
hero layout). Instead:

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
   / remove a Dopa Cena description elsewhere."*

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
  "dolci": [ /* open-ended */ {
    "id": "dl-1", "name": "Sorbetti di Frutta", "price": "11",
    "desc": "Mango, Raspberry, Lemon"     // REQUIRED on every dolci item
  } ]
}
```

### Price convention

**Prices never include the `$` glyph in the JSON.** Store `"13.00"`,
`"7.50"`, `"11"` — the renderer prepends `$` at render time for every
price on the page. `"$13.00"` in the JSON would render `"$$13.00"`.

### Item shape by list

| List | Fields | Notes |
|---|---|---|
| `cocktails[i]` | `id`, `name`, `desc` (required), `price` (required), `note` (optional) | `note` is the small italic line under the description — e.g. the Siena Margarita's floater upsell. Empty/missing → line removed entirely. |
| `spirits.bourbon\|scotch\|beer[i]` | `id`, `name`, `price` (required) | **No description field exists for Spirits, by design** — these are name+price only, matching the current printed list. Don't add a `desc` key here; `render.js` doesn't read one. |
| `dopaCena.<subsection>[i]` | `id`, `name`, `price` (required), `desc` (optional) | **Any item in any Dopa Cena subsection may carry `desc`** — it is not reserved for a particular item (the seed happens to put one on "Il Poggione \"Paganelli\"" → Brunello Riserva di Montalcino, but that's just today's content). Empty/missing → line removed. Per the constraint model, adding descriptions eats vertical budget — validate.js will tell the manager when a card runs out of room (see §1). |
| `dolci[i]` | `id`, `name`, `price` (required), `desc` (required) | Every dolci item has a description in the current design; treat it as required — don't allow an empty save. |

### IDs

Opaque, stable, mint-once per new item — same convention as the other
Siena handoffs. Never recycle a deleted item's ID for a new one in that
slot.

---

## 4. Editable fields — full reference

| Field | JSON path | Required? | Notes |
|---|---|---|---|
| Cocktail name | `cocktails[i].name` | required | Playfair italic 16pt (shrinks to 15pt). |
| Cocktail description | `cocktails[i].desc` | required | Montserrat 12pt (shrinks to 11pt), wraps freely. |
| Cocktail price | `cocktails[i].price` | required | No `$` in the data. |
| Cocktail note | `cocktails[i].note` | optional | Empty/missing removes the line. |
| Spirits item name | `spirits.<sub>[i].name` | required | Playfair italic 12pt (shrinks to 11pt). |
| Spirits item price | `spirits.<sub>[i].price` | required | No `$` in the data. |
| Dopa Cena item name | `dopaCena.<sub>[i].name` | required | Playfair italic 12pt (shrinks to 11pt). |
| Dopa Cena item price | `dopaCena.<sub>[i].price` | required | No `$` in the data. |
| Dopa Cena item description | `dopaCena.<sub>[i].desc` | optional | **Available on every item, every subsection.** Empty/missing removes the line. Governed entirely by validate.js — see §1. |
| Dolci name | `dolci[i].name` | required | Playfair italic 16.5pt (shrinks to 15.5pt). |
| Dolci price | `dolci[i].price` | required | No `$`. Dolci prices in the current menu have no decimals (`"11"`, not `"11.00"`) — either convention renders fine, but stay consistent with the seed. |
| Dolci description | `dolci[i].desc` | required | Montserrat 12pt (shrinks to 11pt), centered, wraps freely. |

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

- The four page titles: "Signature Cocktails", "Spirits", "Siena Dopa
  Cena", "Dolci" — plus their flanking gold rules.
- The eight subsection titles: "Rye / Whiskey / Bourbon", "Single Malt
  Scotch Whisky", "Bottled Beer" (on the Spirits card); "Digestivo",
  "Grappa · 2.5 oz", "Ports · 2.5 oz", "Cognac &amp; Calvados",
  "Traditional Italian · 2.5 oz" (on the Dopa Cena card).
- The number and order of subsections on Spirits (always 3, in that
  order) and Dopa Cena (always 5, in that order). The editor cannot add
  a 4th Spirits category or a 6th Dopa Cena category, rename any of them,
  or reorder them. **Only the items within a subsection are editable.**
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
| Card container | `[data-page-id="cocktails\|spirits\|dopacena\|dolci"]` | validate.js measures this |
| Sheet container | `[data-sheet-id="a\|b"]` | print-scope toggle target |
| Any list | `[data-list-id="…"]` | render.js clears + repopulates; validate.js's `worstList` diagnostic |
| List IDs | `cocktails`, `spirits-bourbon`, `spirits-scotch`, `spirits-beer`, `dopacena-digestivo`, `dopacena-grappa`, `dopacena-ports`, `dopacena-cognac`, `dopacena-traditionalItalian`, `dolci` | maps 1:1 to the JSON paths in §3 |
| Item | `[data-item-id="…"]` | one per JSON item, opaque stable ID |

The renderer uses `textContent` exclusively — no `innerHTML` anywhere in
this menu (no field on this menu needs HTML formatting, unlike the
Weekend menu's `policy_line`).

---

## 7. Editor UI sketch

Four collapsible panels (one per card), each with a live preview pane
that re-renders and re-validates on every edit:

```
┌────────────────────────────┬───────────────────────────────────┐
│ EDITOR PANE                │ PREVIEW PANE (per-card, or all 4) │
│                            │                                    │
│ ▾ Signature Cocktails      │  [ rendered card(s), true size ]  │
│    ≡ Godfather        [×]  │                                    │
│      [name][desc][price]   │  Status per card:                 │
│      ( no note )           │  ✓ Cocktails — fits                │
│    ≡ Siena Margarita  [×]  │  ✓ Spirits — fits (reduced type)   │
│      [name][desc][price]   │  ✓ Dopa Cena — fits                │
│      [note]                │  ✓ Dolci — fits                    │
│    [+ Add cocktail]        │                                    │
│                            │  ⚠ if any card fails:              │
│ ▸ Spirits                  │    "Spirits doesn't fit. Bottled    │
│   ≡ Rye/Whiskey/Bourbon    │     Beer is the largest section —  │
│     … [+ Add]              │     remove an item there, or       │
│   ≡ Single Malt Scotch     │     shorten/remove a Dopa Cena      │
│     … [+ Add]              │     description elsewhere."         │
│   ≡ Bottled Beer           │                                    │
│     … [+ Add]              │  [ Save ]  (disabled while any     │
│                            │   card reports fits:false)         │
│ ▸ Siena Dopa Cena          │                                    │
│   ≡ Digestivo … [+ Add]    │  [ Print both sheets ▾ ]           │
│   ≡ Grappa                 │     Print Sheet A only              │
│     ≡ Il Poggione…         │     Print Sheet B only              │
│       [name][price]        │                                    │
│       [+ description ▾]    │                                    │
│   …                        │                                    │
│                            │                                    │
│ ▸ Dolci                    │                                    │
│   … [+ Add]                │                                    │
└────────────────────────────┴───────────────────────────────────┘
```

- Every list item has drag-to-reorder within its list; dragging across
  lists (e.g. a beer into the bourbon list) is blocked.
- On the Dopa Cena panel, each item's description is a **collapsed
  "+ description" toggle by default** (most items don't have one) that
  expands into a textarea when clicked.
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
  type while Cocktails, Dopa Cena, and Dolci stay full size. This is
  correct — they're four independent physical cards.
- **No `$` in the JSON.** See §3. This is the #1 way a first pass at this
  data gets it wrong (copying the Weekend/Dinner convention, which DOES
  store `$` in the JSON).
- **Spirits genuinely has no description field.** Don't add one "for
  consistency" with Dopa Cena — `render.js` has no code path for it and
  the layout wasn't budgeted for it.
- **Reprints:** always ask "which sheet(s) changed?" before printing —
  see §0. Printing both sheets on every small edit works but wastes
  paper on the unchanged half.
- **Special characters:** preserve curly quotes (`'`, `"…"`), en/em
  dashes (`–`, `—`), middle dots (`·`), and accented letters (`è`, `à`).
  Don't ASCII-fold on save.
- **Empty values:** never allow an empty item name or price anywhere.
  Dolci description is required; cocktail description is required;
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
- Manager selects "Print Sheet B only" after only editing Dolci → only
  the Dopa Cena + Dolci sheet goes to the printer.
- Snapshot test passes in CI (`snapshot-test.spec.mjs`).
- Owner can demo to a manager in a few minutes.
