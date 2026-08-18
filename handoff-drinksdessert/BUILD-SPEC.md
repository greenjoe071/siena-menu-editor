# Build Spec — Siena Drinks Menu Editor

Read `README.md` first.

## ⚠ Exact-value parity — read this before touching a single number

**`template.html`'s CSS values are not approximate — they are transcribed
1:1, by physical size, from the owner's live design mockup.** The owner
reviews and signs off on that mockup, then expects the printed/live
menu to match it exactly. A previous revision of this package drifted
from the mockup because of two mistakes, both now fixed — know them so
they don't recur:

1. **A px→pt scaling mistake applied to spacing, not just type.**
   Font sizes correctly convert 1:1 from the mockup's px value to this
   stylesheet's pt value (`px * 0.75` — this is an exact physical-size
   conversion at 96px/in and 72pt/in, not an approximation). A prior
   pass mistakenly ran that SAME `× 0.75` formula against margins,
   paddings, gaps, and rule widths too — values that were already in
   `px` and needed no conversion at all, since 1px in the template
   physically equals 1px in the mockup. The result: every scaled
   spacing value printed about 25% smaller than the mockup, which is
   exactly why the Spritz illustration (and other bottom-of-card
   content) sat noticeably higher than the mockup shows — the content
   above it consumed less vertical space than intended, leaving dead
   space below. **Rule going forward: only font-size gets the `×0.75`
   px→pt conversion. Every margin/padding/gap/width value that's in
   `px` or `in` in the mockup gets copied to this stylesheet as the
   exact same number, same unit. Never run spacing through the pt
   conversion.**
2. **A specificity bug silently dropped the Bottled Beer accent
   margin.** `.subsection-title-row--accent`'s margin lost to the more
   specific `.page[data-page-id="spirits"] .subsection-title-row` rule
   defined earlier in the file, so Bottled Beer was actually laid out
   with the GENERIC subsection gap the whole time, never its intended
   large gap. Fixed by scoping the accent margin rule to
   `.page[data-page-id="spirits"] .subsection-title-row--accent`
   specifically (see the CSS comment at that rule). **When you add a
   page-specific override for anything, double-check it actually wins
   the specificity fight against other rules touching the same
   element — a rule that never applies is a silent bug, not an error.**

If what prints ever looks different from the current `Drinks Menu.dc.html`
mockup again, check these two failure modes first before assuming the
content itself changed.

## Changelog — latest revision

This revision fixed the two REAL fit failures a careful re-check (real
content, real browser, `validate.js`) turned up, and added growth
headroom on Cocktails and Spritz:

- **Spirits & Beer genuinely overflowed** with real content (11
bourbon, 11 scotch, 12 beer) — the just-fixed Bottled Beer margin (see
the parity section above) made the page 29–36px too tall for the
physical 11in card, even after the 1pt shrink. Fixed by trimming: every
item row's margin-bottom 4px→2px on Bourbon/Scotch/Beer (Liquori stays
at 3px — it wasn't overflowing), and the Bottled Beer block's shift-down
reduced 0.25in→0.15in with its own heading-to-list gap 19px→13px. Real
content now fits at full type size, no shrink needed (`contentBottomIn`
~9.4–9.8in, comfortable margin under the 9.96in crop line). A follow-up
check also found a small (~14px) DC-only overflow from a margin-collapse
quirk on the Bottled Beer block's wrapper in one rendering environment —
fixed by making that wrapper `display:flex;flex-direction:column` (flex
items never collapse margins) and taking the Bourbon/Scotch/Beer margin
down the extra 1px (3px→2px) for real safety margin, not just a
by-a-hair pass.
- **Spritz Menu was right at the edge** with real content (9 items) —
it only passed by using the one shrink step, with ~0.02in to spare
before the crop line. Not a bug, but no safety margin either.

### Growth headroom — Cocktails (+1) and Spritz (+2)

Cocktails and Spritz must now tolerate modest growth without a design
round: Cocktails up to 8 items, Spritz up to 11 (2 more than today,
added to whichever category group is already tallest — verified worst
case). Spirits & Beer and Liquori are NOT growing — their current exact
counts (Bourbon 11, Scotch 11, Beer 12, Tequila 8, Gin 7, Vodka 13, Rum
5) are a hard ceiling; if those need to change, re-run the fit checks
by hand, don't assume headroom exists.

**Important correction on how the release valve actually works — read
this before touching either threshold:**

`render.js` toggles `.hide-image` on a card once its item count crosses
a threshold (`COCKTAILS_HIDE_IMAGE_AT = 8`, `SPRITZ_COMPACT_AT = 9` — corrected
from the delivered `10` on 2026-08-18: at `10`, today's real 9-item baseline
stayed in non-compact spacing and failed the crop line by ~0.24in; verified
`9` fits with ~2.9in to spare. See BUILD-SPEC §8a-style note — flag to the
designer so their next handoff doesn't regress it back to 10).
This was the developer's original ask, but testing with real browser
layout (not a visual mockup comparison) showed it does NOT work the same
way on both cards, because `validate.js`'s `contentBottomIn` (the holder
crop-line check) deliberately SKIPS `[data-decorative]` elements —
which is exactly what these bottom illustrations are marked as (see §5).
Hiding a decorative image can never move the crop-line number, because
it was never counted there in the first place.

- **Cocktails' growth problem is the OTHER check** — plain bottom-of-
  11in-card overflow (`scrollHeight` vs `clientHeight`), which is NOT
  decorative-exempt. At 8 items, the card + illustration together
  physically exceed 11in by ~22px. Hiding the illustration removes that
  22px outright — this fix genuinely works, confirmed in-browser.
- **Spritz's growth problem IS the crop line**, so hiding its
  illustration alone does nothing measurable. The real fix is
  `.spritz-compact` (added alongside `.hide-image` at the same
  threshold): tighter header/item spacing and reverting the +1pt bump
  added earlier this revision, for THIS state only. Confirmed in-browser
  at 11 items (worst case: 2 new items both landing in the already-
  tallest "Herbal & Aromatic" group): `fits: true`, `contentBottomIn`
  ~7.6–8.8in — comfortable margin, no shrink needed.
- The graphic being hidden alongside the Spritz compaction is a
  cosmetic pairing (denser list, less need for the decorative flourish
  at the bottom), not the fix itself — don't treat `.hide-image` as
  interchangeable with `.spritz-compact` on this card.

All four required acceptance scenarios were verified in a real browser
against `validate.js` (fonts and images awaited before measuring — a
race on either gives false readings, see Gotchas §8):
1. Today's real content, all 4 cards — `fits: true`.
2. Cocktails at 8 (today's 7 + 1 realistic entry) — `fits: true` via
   `.hide-image`.
3. Spritz at 11 (today's 9 + 2 in the tallest group) — `fits: true` via
   `.spritz-compact` + `.hide-image`.
4. Both simultaneously — `fits: true`.

Earlier revision (still current) fixed the exact-value parity bugs
above and touched **Signature Cocktails and Spritz Menu**:

- **Cocktails**: titles and item list shifted down an additional 1/8in
  (12px) below the page title. A new static illustration,
  `assets/cocktails-martini-sketch.png` (`.cocktails-image`), was added
  at the bottom of the card — same static/decorative treatment and
  position pattern as the Spritz card's illustration (not a data field,
  not editable, exempt from the holder crop line).
- **Spritz Menu**: every item name, description, and group heading
  AFTER the "every spritz is topped with prosecco and soda" tagline
  went up 1pt (both Design A's flat list and Design B's three grouped
  sections). To make room without overflowing, spacing inside the list
  was tightened: item gap 9px→5px, group-heading margin 6px→4px each
  side, group-to-group gap 4px→2px, and the bottom illustration's own
  top margin 18px→8px. The seed data's default `spritz.design` also
  changed `"a"` → `"b"` (grouped) to match the mockup, which has always
  shown the grouped layout — Design A still exists and still works, the
  manager can still switch to it.

Earlier revision (still current) touched **Signature Cocktails and
Spirits & Beer**:

- "Aperol Spritz" removed from `menu-data.json`'s `cocktails` list — it's
  redundant now that Spritz has its own dedicated card. Confirmed against
  the designer's original print proof, which never included it there.
- The Signature Cocktails card shifted down 0.5in (`padding-top` 0.3in →
  0.8in on `.page[data-page-id="cocktails"]`). Net effect of the removal
  + the shift: ~0.5in of slack now exists above the holder crop line
  (§1b) — enough for a short one-line addition, but **not** a full new
  drink with a two-line description without trimming something else
  first. Flag this to whoever adds the next cocktail.
- Spirits & Beer's "Bottled Beer" section got a full layout change: items
  are now centered with the price inline after the name, separated by an
  em dash ("Bud Light — 6.50"), instead of the name-left/price-right row
  Bourbon and Scotch use. The heading itself is now bold (weight 700, was
  600) with extra clearance before the first item. The whole block
  (heading + list) is also shifted down 0.25in via its own top margin.
  **This 0.25in shift is deliberately exempt from the holder crop line
  (§1b)** — the owner's call, because this block's text is centered, so
  even if its bottom edge crept past 9.96in it wouldn't be clipped by the
  holder's corner grips the way a flush-left/right line would. Don't
  have `validate.js` flag this block against the crop line. See §5.
- On Spritz Menu, the "new" kicker now has 0.5in of clearance above it
  (shifting the whole card's content down within the fixed-height card),
  and the bottom illustration sits slightly lower (margin-top 10px →
  13.5px) — both from a couple of rounds of "nudge the graphic vs. nudge
  the content" requests. Treat these two as coupled if either is touched
  again.

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
  edit `spritz.price` within it. The tagline ("every spritz is topped
  with prosecco and soda") is set in italic; it no longer has a rule
  beneath it.
- The 1pt type bump on Design B's "Herbal & Aromatic" and "Rich &
  Earthy" groups relative to "Bitter & Bright" (heading, item name, and
  description all +1pt) — a deliberate, current design decision.
- The Spritz card's static bottom illustration
  (`assets/spritz-garnish-sketch.png`, `.spritz-image`, marked
  `data-decorative`) — not a data field, no editor control. It's exempt
  from the holder crop-line check (§1b) since it carries no text a guest
  needs to read; `validate.js`'s `contentBottomIn` skips any
  `[data-decorative]` element on purpose.
- The three Spritz Design B group headings and their order ("Bitter &
  Bright", "Herbal & Aromatic", "Rich & Earthy"), each flanked by small
  ornamental rules — fixed; the editor cannot add, rename, reorder, or
  restyle them. Only which `category` each item carries is editable.
- The Spirits & Beer subsection titles: "Rye / Whiskey / Bourbon" and
  "Single Malt Scotch Whisky" are plain text. **"Bottled Beer" is a
  visually distinct accent treatment** — larger, bold type (~15pt/700 vs
  ~10.5pt/600) with small flanking rules, unlike its two siblings. This
  asymmetry is intentional; don't normalize all three to look the same.
  **Bottled Beer's item list is also laid out differently**: centered,
  name and price inline separated by an em dash ("Bud Light — 6.50"),
  vs. Bourbon/Scotch's name-left/price-right row. Same underlying
  `item-name`/`item-price` DOM (`plain-item-template`, `renderPlainList`)
  — only CSS on `[data-list-id="spirits-beer"]` differs. Don't refactor
  this into a separate template; it's a CSS-only variant.
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
- **Wait for fonts AND images before validating.** Call
  `await SienaDrinksDessertValidate.waitForLayout(doc)` before
  `validate(doc)` — Playfair is a variable font and shifts line-heights
  slightly when it swaps in, which can flip a borderline fit/no-fit call.
  This matters even more now that Spritz item names are Playfair too.
  **Also wait for both illustration `<img>`s to finish loading/decoding**
  — an unloaded image can report zero intrinsic height, silently passing
  a check that would fail once the image's real height is in. Neither
  wait is optional; a revision this session initially looked fine on a
  quick check and only failed once both waits were added properly.
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

- **Cocktails and Spritz have growth headroom; Spirits & Beer and
  Liquori do not.** Cocktails tolerates up to 8 items, Spritz up to 11,
  each via an automatic `.hide-image` / `.spritz-compact` toggle in
  `render.js` (see the changelog above for the exact thresholds and why
  the mechanism differs between the two cards). Don't assume the same
  release valve exists on Spirits & Beer or Liquori — it doesn't; their
  current counts are a hard ceiling.

## 8a. Owner customizations layered on top of this handoff (NOT our contract)

These live in `template.html`/`render.js`/`validate.js` but are not part of
the design we deliver — they're additions Joe asked for directly, applied on
top of every install since. **A wholesale file swap silently drops all
three** (it's happened on every install so far) — re-apply them on every
future install until/unless they're formally folded into the handoff:

1. **`.cut-guide { display: none; }`** inside `@media print` (near the top
   of `template.html`'s print block). Without it, the on-screen sheet-cutting
   guide line prints down the middle of the physical card.
2. **`[data-crop-exempt]`** — an attribute (see `template.html`'s file
   header) that excludes an element's whole subtree from the holder
   crop-line check in `validate.js`'s `contentBottomIn()`. Currently only on
   Bottled Beer's heading row + item list on Spirits & Beer, because that
   block's text is centered and isn't at the corner-clip risk the crop line
   protects against. Don't add it elsewhere without checking with Joe first.
   (This round's BUILD-SPEC §5 now documents the *rationale* for this in
   prose — good — but the actual attribute + validate.js logic still aren't
   in the delivered files. Keep re-applying both halves together until they
   are.)
3. **Spritz `showNew` / `tagline`** — `data.spritz.showNew` (boolean, toggles
   the "new" kicker above the Spritz title) and `data.spritz.tagline` (free
   text, replaces the static tagline, must render on one line) are
   owner-editable fields with logic in `render.js` (sets kicker
   display/tagline text) and `validate.js` (`isTaglineWrapped()` — a wrapped
   tagline fails validation with `worstList: "spritz-tagline"`, independent
   of the normal fit/crop checks and never affected by the 1pt shrink step,
   and unaffected by `.spritz-compact` since compact mode never touches the
   tagline's own font-size/line-height).

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
