# Siena Drinks &amp; Dessert Menu — Developer Handoff

Four insert cards (Signature Cocktails, Spirits & Beer, Siena Dopa Cena, Dolci)
produced from two physical 8.5×11 sheets, each cut in half. Same brand
and font stack as the other Siena menu handoffs in this project
(`../handoff/`, `../handoff-happyhour-v2/`, `../handoff-monday/`,
`../handoff-tueswed/`, `../handoff-weekend/`) — **structurally different**
from all of them. Read `BUILD-SPEC.md` §0 before you do anything else.

## Files

| File | Purpose |
|---|---|
| `template.html` | Two print sheets, four cards, `data-*` hooks, plus the four `<template>` item blueprints the renderer clones. Do not edit unless the design is changing. |
| `render.js` | UMD module. `render(document, data)` hydrates every list in place. Exports `module.exports` (Node/CommonJS) and `SienaDrinksDessertRender` (browser). Never checks fit. |
| `validate.js` | UMD module. `validate(document)` measures each of the 4 cards, tries the one-step 1pt shrink, and reports `fits`/`overflowPx`/`worstList` per card. Requires a real browser — cannot run in the snapshot test. |
| `menu-data.json` | Seed data — the current real menu copy, every list populated. |
| `expected-render.html` | `render(template, menu-data.json)` output. Snapshot baseline. |
| `snapshot-test.spec.mjs` | Vitest test: snapshot match, optional-field behavior (cocktail note, dopa-cena desc), open-ended cardinality. Resolves paths from its own file location, not CWD. |
| `BUILD-SPEC.md` | Full spec — physical product, constraint model, data shape, editable fields, gotchas. **Read this before writing the editor.** |
| `fonts/` | Self-hosted Playfair Display variable fonts (regular + italic). Montserrat loads from Google Fonts at runtime. |

## Quickstart

1. Read `BUILD-SPEC.md` §0 (physical product / sheets) and §1 (constraint
   model) — both are unlike the other Siena menu handoffs.
2. Stand up four editor panels, one per card, each backed by an
   open-ended array (or, for Spirits/Dopa Cena, a fixed set of
   open-ended sub-arrays — see §5, subsections are fixed, items are not).
3. Wire `SienaDrinksDessertRender.render()` to a live preview iframe.
4. Wire `SienaDrinksDessertValidate.validate()` to run after every
   render (debounced) and before save. Block save on `fits: false`;
   surface `report.pages[i].worstList` in the error message.
5. Build the print control with three options — both sheets / Sheet A
   only / Sheet B only — per §0's reprint guidance.
6. Wire `snapshot-test.spec.mjs` into CI. Block merges on failure.
7. When the menu changes: edit `menu-data.json`, re-render through the
   same JSDOM pipeline used to build `expected-render.html`, overwrite
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
- **Drinks &amp; Dessert (this package)** — **four separate physical
  cards from two cuttable sheets**, **every list open-ended**, **no
  chrome to shed** — so it uses `validate.js` (like Happy Hour) but adds
  a single 1pt shrink step before blocking (unlike Happy Hour, which has
  no shrink step at all). This is the only Siena menu where the printed
  output is more than one physical page and where reprints can target
  half the job.

Keep this as its own editor surface. Don't reuse the Weekend menu's
auto-fit-ladder editor code, and don't reuse Happy Hour's fixed-count
list UI — every list here needs add/remove.
