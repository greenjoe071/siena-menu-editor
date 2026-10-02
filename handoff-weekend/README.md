# Siena Weekend Specials Menu — Developer Handoff (v2, Oct 2026)

**v2 replaces `../handoff-weekend/` (v1).** Do not build from v1 — its
two-column layout, colors, data shape and ladder order are all superseded.

This package is everything a developer needs to build the CMS editor for the
Weekend Specials menu (*Specialità del Capo Cuoco*, Thursday–Saturday).

## What changed from v1

- **Single centered column.** Every dish stacks full-width; descriptions run
  margin to margin. The v1 2-column grid and `cnt-1`/`cnt-3` orphan classes
  are gone.
- **Dish name on the true center line, price hanging to its right**
  (`.dish-head` is a `1fr auto 1fr` grid).
- **No "Starters"/"Entrees" subtitles** and **no "Throughout the Week at
  Siena" title** — both removed from the template AND the data model.
- **Eyebrow now reads "Weekend Specials"** (static).
- **Palette:** deep red `#7a1712` (section titles, dish names, bold policy
  text), dark brown `#3a1a06` (eyebrow, day line, prices), black descriptions.
  Gold `#b8821e` is now decorative rules only. Weekly footer colors unchanged.
- **Dish block vertically centered** between the hero and the weekly footer.
- **5-word last-line bind:** `render.js` joins the last 5 words of every
  description (8+ words) with no-break spaces so a wrapped line never holds
  fewer than 5 words.
- **New ladder order:** day line → spacing → eyebrow → weekly footer.

## Files

| File | Purpose |
|---|---|
| `template.html` | Layout + `data-*` hooks + `<template id="dish-template">` blueprint. Do not edit unless the design changes. |
| `render.js` | UMD (`SienaWeekendRender`). `render(document, data)` hydrates content; also exports `bindLastWords()`. |
| `settle.js` | UMD (`SienaWeekendSettle`). Auto-fit ladder — call after every preview render and before printing. Auto-runs on load. |
| `menu-data.json` | Seed data (4 starters + 4 entrees + dessert). |
| `expected-render.html` | `render(template, menu-data.json)` output — the snapshot. |
| `snapshot-test.spec.mjs` | Vitest / `node --test`. Snapshot + optional-dessert + last-words-bind tests. |
| `BUILD-SPEC.md` | Full spec. **Read before writing the editor.** |
| `fonts/` | Self-hosted Playfair Display variable fonts. Montserrat loads from Google Fonts. |

## Quickstart

1. Read `BUILD-SPEC.md`.
2. Build the editor; starters/entrees each support 1–4 dishes.
3. Wire `settle.js` into preview (after every render) and `/print` (before `window.print()`).
4. Wire `snapshot-test.spec.mjs` into CI; block merges on failure.
5. When the seed changes: re-render, overwrite `expected-render.html`, commit both together.
