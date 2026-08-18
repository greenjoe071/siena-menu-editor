# Siena Drinks Menu — Developer Handoff

**Latest revision touched Signature Cocktails and Spirits & Beer, plus a
small Spritz Menu nudge** — "Aperol Spritz" removed from Cocktails, that
card shifted down 0.5in, "Bottled Beer" restyled with a bold heading and
a centered inline-price item layout, and the Spritz card's top kicker/
bottom illustration nudged. See `BUILD-SPEC.md`'s changelog note at the
top. Liquori and the Dessert Menu package are unchanged.

Four insert cards (Signature Cocktails, Spritz Menu, Spirits & Beer,
Liquori) produced from two physical 8.5×11 sheets, each cut in half.
Dolci is not part of this package — it's its own standalone insert (see
`../Dessert Menu.dc.html`). Same brand and font stack as the other Siena
menu handoffs in this project (`../handoff/`, `../handoff-happyhour-v2/`,
`../handoff-monday/`, `../handoff-tueswed/`, `../handoff-weekend/`) —
**structurally different** from all of them. Read `BUILD-SPEC.md` §0
before you do anything else, §1a for the Spritz Menu's dual-design
mechanic, §1b for a physical constraint unique to this menu (the holder
crop line), and §1c for why Liquori isn't edited like the other cards.

## Files

| File | Purpose |
|---|---|
| `template.html` | Two print sheets, four cards, `data-*` hooks, plus the four `<template>` item blueprints the renderer clones. Do not edit unless the design is changing. |
| `render.js` | UMD module. `render(document, data)` hydrates every list in place. Exports `module.exports` (Node/CommonJS) and `SienaDrinksDessertRender` (browser). Never checks fit. |
| `validate.js` | UMD module. `validate(document)` measures each of the 4 cards, tries the one-step 1pt shrink, and reports `fits`/`overflowPx`/`worstList` per card. Requires a real browser — cannot run in the snapshot test. |
| `menu-data.json` | Seed data — cocktails, spritz, spirits, liquori, every list populated. |
| `expected-render.html` | `render(template, menu-data.json)` output. Snapshot baseline. |
| `snapshot-test.spec.mjs` | Vitest test: snapshot match, optional-field behavior (cocktail note), open-ended cardinality, the Liquori fixed-category contract, and the Spritz shared-data/dual-design contract. Resolves paths from its own file location, not CWD. |
| `BUILD-SPEC.md` | Full spec — physical product, constraint model, data shape, editable fields, gotchas. **Read this before writing the editor.** |
| `assets/spritz-garnish-sketch.png` | Static illustration pinned to the bottom of the Spritz card — not a data field, see BUILD-SPEC §5. |
| `fonts/` | Self-hosted Playfair Display variable fonts (regular + italic). Montserrat loads from Google Fonts at runtime. |

## Quickstart

1. Read `BUILD-SPEC.md` §0 (physical product / sheets), §1a (Spritz
   Menu's shared-data dual-design toggle), §1b (the holder crop line —
   a second fit constraint beyond the card's own 11in), and §1c (why
   Liquori is curated, not open-ended).
2. Stand up four editor panels, one per card. Cocktails, Spirits & Beer,
   and Spritz are backed by open-ended arrays (or, for Spirits, a fixed
   set of open-ended sub-arrays — subsections are fixed, items are not).
   Liquori's four category arrays exist but aren't a plain add/remove UI
   — see §1c.
3. Wire `SienaDrinksDessertRender.render()` to a live preview iframe.
4. Build the Spritz "choose your design" screen as two separate
   `render()` calls against the same `spritz` data, one forced to each
   design — see §1a and §7.
5. Wire `SienaDrinksDessertValidate.validate()` to run after every
   render (debounced) and before save. Block save on `fits: false`;
   surface `report.pages[i].worstList` in the error message. Remember
   `fits` requires BOTH the bottom-of-card check and `cropLineOk` (§1b).
6. Build the print control with three options — both sheets / Sheet A
   only / Sheet B only — per §0's reprint guidance.
7. Wire `snapshot-test.spec.mjs` into CI. Block merges on failure.
8. When the menu changes: edit `menu-data.json`, re-render through the
   same DOMParser pipeline used to build `expected-render.html`, overwrite
   it, commit both together.

## Relationship to the other menu handoffs

- **Spring dinner menu** (`../handoff/`) — 3 pages, one physical sheet
  set, large fixed-count sections.
- **Monday menu** — 1 page, fixed cardinality, prices optional.
- **Tue–Wed prix fixe** — 1 page, fixed cardinality.
- **Happy Hour v2** — 1 page (8.5×14), fixed cardinality per section,
  page-fit validator (`validate.js`) governs description length only.
- **Weekend Specials** — 1 page, variable cardinality (1–4 per section),
  auto-fit ladder (`settle.js`) sheds chrome.
- **Drinks (this package)** — **four separate physical cards from two
  cuttable sheets**, **most lists open-ended** (Liquori is curated, see
  §1c), **no chrome to shed** — so it uses `validate.js` (like Happy
  Hour) but adds a single 1pt shrink step before blocking (unlike Happy
  Hour, which has no shrink step at all). It's also the only Siena menu
  with a page that has two interchangeable designs sharing one data set
  (Spritz Menu, see §1a), and the only one with a second, stricter fit
  constraint below the card's own physical bottom (the holder crop line,
  §1b). This is the only Siena menu where the printed output is more
  than one physical page and where reprints can target half the job.

Keep this as its own editor surface. Don't reuse the Weekend menu's
auto-fit-ladder editor code, and don't reuse Happy Hour's fixed-count
list UI — every list here needs add/remove.
