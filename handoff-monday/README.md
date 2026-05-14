# Siena Monday $26 Menu — Developer Handoff

This package is everything a developer needs to build a CMS editor that drives the Monday $26 specials menu. Same pattern as the Spring dinner menu handoff in `../handoff/`.

## Files

| File | Purpose |
|---|---|
| `template.html` | The menu layout with `data-*` hooks the renderer targets. Do not edit unless the design is changing. |
| `render.js` | UMD module. `render(document, data)` hydrates the template DOM in place. |
| `menu-data.json` | Seed data — the canonical starting point. Every editable field is present. |
| `expected-render.html` | The output of `render(template, menu-data.json)`. The snapshot test compares against this. |
| `snapshot-test.spec.js` | Vitest- or node-test–compatible test that fails loudly on any unintended rendering drift. |
| `BUILD-SPEC.md` | Full spec — data model, editable fields, character limits, gotchas. **Read this before writing the editor.** |
| `fonts/` | Self-hosted Playfair Display variable fonts (regular + italic). Montserrat is loaded from Google Fonts at runtime. |

## Quickstart

1. Read `BUILD-SPEC.md`.
2. Stand up the editor as described there.
3. Wire `snapshot-test.spec.js` into CI. Block merges on test failure.
4. When the owner edits content: save the new `menu-data.json`, re-render to refresh `expected-render.html`, commit both together.

## Relationship to the dinner menu handoff

This is a separate, parallel package. The Monday menu and the Spring dinner menu have different layouts, different sections, and different cardinality. They share a brand and a font stack — nothing else structurally. Keep them as two distinct editor surfaces in your app.
