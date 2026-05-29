# Siena Weekend Specials Menu — Developer Handoff

This package is everything a developer needs to build a CMS editor that
drives the Weekend Specials menu (*Specialità del Capo Cuoco* —
Chef's Suggestions, Thursday through Saturday). Same pattern as the
Monday $26 menu handoff in `../handoff-monday/` and the Spring dinner
menu handoff in `../handoff/`.

## Files

| File | Purpose |
|---|---|
| `template.html` | The menu layout with `data-*` hooks the renderer targets, plus the `<template id="dish-template">` blueprint the renderer clones for each dish. Do not edit unless the design is changing. |
| `render.js` | UMD module. `render(document, data)` hydrates the template DOM in place (content only). Exports as `module.exports` (Node/CommonJS) and as `SienaWeekendRender` on the root (browser). |
| `settle.js` | UMD module (`SienaWeekendSettle`). The **auto-fit ladder** — runs in the browser after layout and sheds page chrome (eyebrow → day line → spacing → weekly footer) only while the page would overflow. Call after every preview render and before printing. Auto-runs on load. Not used by the snapshot test (needs a real layout engine). |
| `menu-data.json` | Seed data — the canonical starting point. Ships with the **maximum** configuration (4 starters + 4 entrees) so the developer sees the full range. |
| `expected-render.html` | The output of `render(template, menu-data.json)`. The snapshot test compares against this. |
| `snapshot-test.spec.js` | Vitest- or node-test–compatible test that fails loudly on any unintended rendering drift. |
| `BUILD-SPEC.md` | Full spec — data model, editable fields, character limits, cardinality rules, gotchas. **Read this before writing the editor.** |
| `fonts/` | Self-hosted Playfair Display variable fonts (regular + italic). Montserrat is loaded from Google Fonts at runtime. |

## Quickstart

1. Read `BUILD-SPEC.md` — especially the **Constraint model** section
   (auto-fit ladder, not rigid character caps) and the **variable
   cardinality** rules.
2. Stand up the editor as described there. Starters and entrees each
   support 1–4 dishes; `render.js` rebuilds the `.dish-grid` from the
   JSON `items` array on every render, and stamps `cnt-1` / `cnt-3` for
   odd counts so a lone dish centers.
3. Wire `settle.js` into the preview (call after each render) and the
   `/print` page (call before `window.print()`). It also auto-runs on a
   statically-served page.
4. Wire `snapshot-test.spec.js` into CI. Block merges on test failure.
5. When the chef rotates dishes for a new weekend: save the new
   `menu-data.json`, re-render to refresh `expected-render.html`,
   commit both together.

## Relationship to the other menu handoffs

This is a separate, parallel package alongside `../handoff/` (Spring
dinner menu) and `../handoff-monday/` (Monday $26 prix-fixe). The three
menus share a brand and a font stack — nothing else structurally:

- **Spring dinner menu** — 3 pages, large fixed-count sections.
- **Monday menu** — 1 page, fixed cardinality (2 + 4), prices optional
  (prix fixe).
- **Weekend menu** — 1 page, **variable cardinality (1..4 + 1..4)**,
  **prices required** (à la carte), static masthead, **auto-fit ladder**
  (`settle.js`) instead of rigid character caps.

Keep them as three distinct editor surfaces in your app. The Weekend
menu's variable-cardinality renderer behavior is the most significant
behavioral difference — don't paste the Monday editor over this one.
