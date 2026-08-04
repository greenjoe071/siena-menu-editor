# Siena Drinks Menu — Developer Handoff

Four insert cards (Signature Cocktails, Spritz Menu, Spirits & Beer, Siena
Dopa Cena) produced from two physical 8.5×11 sheets, each cut in half.
Dolci is no longer part of this package — it's its own standalone insert
now (see `../Dessert Menu.dc.html`). Same brand and font stack as the
other Siena menu handoffs in this project (`../handoff/`,
`../handoff-happyhour-v2/`, `../handoff-monday/`, `../handoff-tueswed/`,
`../handoff-weekend/`) — **structurally different** from all of them.
Read `BUILD-SPEC.md` §0 before you do anything else, and §1a for the new
Spritz Menu's dual-design mechanic.

## Files

| File | Purpose |
|---|---|
| `template.html` | Two print sheets, four cards, `data-*` hooks, plus the four `<template>` item blueprints the renderer clones. Do not edit unless the design is changing. |
| `render.js` | UMD module. `render(document, data)` hydrates every list in place. Exports `module.exports` (Node/CommonJS) and `SienaDrinksDessertRender` (browser). Never checks fit. |
| `validate.js` | UMD module. `validate(document)` measures each of the 4 cards, tries the one-step 1pt shrink, and reports `fits`/`overflowPx`/`worstList` per card. Requires a real browser — cannot run in the snapshot test. |
| `menu-data.json` | Seed data — cocktails, spritz (placeholder items — see below), spirits, dopa cena, every list populated. |
| `expected-render.html` | `render(template, menu-data.json)` output. Snapshot baseline. |
| `snapshot-test.spec.mjs` | Vitest test: snapshot match, optional-field behavior (cocktail note, dopa-cena desc), open-ended cardinality, and the Spritz shared-data/dual-design contract. Resolves paths from its own file location, not CWD. |
| `BUILD-SPEC.md` | Full spec — physical product, constraint model, data shape, editable fields, gotchas. **Read this before writing the editor.** |
| `fonts/` | Self-hosted Playfair Display variable fonts (regular + italic). Montserrat loads from Google Fonts at runtime. |

## Quickstart

1. Read `BUILD-SPEC.md` §0 (physical product / sheets) and §1a (Spritz
   Menu's shared-data dual-design toggle) — both are unlike the other
   Siena menu handoffs.
2. Stand up four editor panels, one per card, each backed by an
   open-ended array (or, for Spirits/Dopa Cena, a fixed set of
   open-ended sub-arrays — see §5, subsections are fixed, items are not).
3. Wire `SienaDrinksDessertRender.render()` to a live preview iframe.
4. Build the Spritz "choose your design" screen as two separate
   `render()` calls against the same `spritz` data, one forced to each
   design — see §1a and §7.
5. Wire `SienaDrinksDessertValidate.validate()` to run after every
   render (debounced) and before save. Block save on `fits: false`;
   surface `report.pages[i].worstList` in the error message.
6. Build the print control with three options — both sheets / Sheet A
   only / Sheet B only — per §0's reprint guidance.
7. Wire `snapshot-test.spec.mjs` into CI. Block merges on failure.
8. When the menu changes: edit `menu-data.json`, re-render through the
   same DOMParser pipeline used to build `expected-render.html`, overwrite
   it, commit both together. **Note:** the Spritz `items`/`desc`/
   `category` in the current `menu-data.json` are placeholder content —
   the manager will replace them with the real 9–12-liquor list.

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
  cuttable sheets**, **every list open-ended**, **no chrome to shed** —
  so it uses `validate.js` (like Happy Hour) but adds a single 1pt shrink
  step before blocking (unlike Happy Hour, which has no shrink step at
  all). It's also the only Siena menu with a page that has two
  interchangeable designs sharing one data set (Spritz Menu, see §1a).
  This is the only Siena menu where the printed output is more than one
  physical page and where reprints can target half the job.

Keep this as its own editor surface. Don't reuse the Weekend menu's
auto-fit-ladder editor code, and don't reuse Happy Hour's fixed-count
list UI — every list here needs add/remove.
