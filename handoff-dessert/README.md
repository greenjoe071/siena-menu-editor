# Siena Dessert Menu — Developer Handoff

One physical 8.5×11 sheet, cut in half into two DIFFERENT insert cards —
Dolci (left) and Siena Dopa Cena (right). Same size and holder as the 4
cards in `../handoff-drinksdessert/`. This package used to be a single
Dolci card printed twice (two identical copies to save paper); it is NOT
that anymore — read `BUILD-SPEC.md` §0 before touching anything, and §2
for Dolci's static illustration and deliberately non-centered list.

## Files

| File | Purpose |
|---|---|
| `template.html` | One sheet, two different cards, `data-*` hooks, plus the two `<template>` item blueprints the renderer clones. Do not edit unless the design is changing. |
| `render.js` | UMD module. `render(document, data)` hydrates every list in place. Never checks fit. |
| `validate.js` | UMD module. `validate(document)` measures the Dolci and Dopa Cena cards independently, tries the one-step 1pt shrink, and reports `fits`/`overflowPx`/`cropLineOk`/`worstList` per card. Requires a real browser. |
| `menu-data.json` | Seed data — `dolci` list and the 5 `dopaCena` subsection lists. |
| `expected-render.html` | `render(template, menu-data.json)` output. Snapshot baseline. |
| `snapshot-test.spec.mjs` | Node test: snapshot match, optional-field behavior (`dopaCena` `sub`), and open-ended cardinality. |
| `BUILD-SPEC.md` | Full spec — physical product, constraint model, data shape, editable fields, gotchas. **Read this before writing the editor.** |
| `assets/dolci-affogato-sketch.png` | The static Dolci-card illustration — not a data field, see BUILD-SPEC §2. |
| `fonts/` | Self-hosted Playfair Display variable fonts (regular + italic). Montserrat loads from Google Fonts at runtime. |

## Quickstart

1. Read `BUILD-SPEC.md` §0 (physical product — two different cards, not
   two copies; the cut guide never prints), §1b (the holder crop line,
   shared with the Drinks Menu), and §2 (Dolci's static illustration and
   non-centered list).
2. Stand up two editor panels — Dolci (one open-ended list) and Dopa
   Cena (5 fixed subsections, each open-ended).
3. Wire `SienaDessertRender.render()` to a live preview iframe.
4. Wire `SienaDessertValidate.validate()` to run after every render
   (debounced) and before save. Block save on `fits: false`; both the
   ordinary overflow check and `cropLineOk` must pass for each card.
5. Wire `snapshot-test.spec.mjs` into CI. Block merges on failure.
6. When the menu changes: edit `menu-data.json`, re-render through the
   same DOMParser pipeline used to build `expected-render.html`, overwrite
   it, commit both together.

## Relationship to the other menu handoffs

- **Drinks Menu** (`../handoff-drinksdessert/`) — 4 cards from 2
  cuttable sheets, shares this package's constraint model, the holder
  crop line, and the same font/color system. Siena Dopa Cena used to be
  on that package's 4th card; it now lives here.
- **Spring dinner / Monday / Tue–Wed / Happy Hour / Weekend menus** —
  see `../handoff-drinksdessert/README.md`'s comparison table; this
  package is closest in spirit to the Drinks Menu, just with one sheet
  instead of two and no dual-design mechanic.

Keep this as its own editor surface — it shares conventions with the
Drinks Menu but is a separate save/print unit.
