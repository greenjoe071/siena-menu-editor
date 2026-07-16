# Siena Menu Editor — Handoff to Claude Code

You are building a small web app that lets restaurant managers edit the content of the Siena Ristorante menu and print/PDF the result. The current printed menu (`template.html`) has been carefully tuned over multiple design rounds. **Preserving its exact print fidelity is the top priority of this project.**

---

## RULES — READ BEFORE WRITING ANY CODE

1. **`template.html` is the golden master.** Do not modify its CSS, HTML structure, or layout. The only things that legitimately change inside it at runtime are: text content of marked elements (`[data-text-id]`), text content inside dish slots (`[data-dish-id]`), and the *order* of dish elements within a section container.

2. **Do not rebuild the menu in a framework.** Do not use React/Vue/Svelte to recreate the printed menu. Use the provided **DOM hydration** approach: parse `template.html`, mutate via the provided `render.js`, serialize back to HTML.

3. **`render.js` is the only path from JSON to HTML.** If you need to change how rendering works, change `render.js` and re-run the snapshot test. The editor's "Preview" pane and the "Print" page must both call this same function. No separate rendering paths.

4. **The snapshot test must pass on every commit.** It verifies that `render(template.html, menu-data.json)` produces byte-identical output to `expected-render.html`. If you break formatting, the test fails. CI must reject merges with a failing snapshot.

5. **Self-hosted fonts must ship to production.** The `fonts/` directory contains `PlayfairDisplay-VariableFont_wght.ttf` and `PlayfairDisplay-Italic-VariableFont_wght.ttf`. These must be served from `/fonts/` on the deployed app and resolvable from the printed menu page. Montserrat loads from Google Fonts (already in the `<head>` of `template.html`); leave that as-is. **Verify print output in Chrome before declaring deploy-ready** — open the Print page, open the browser print dialog, save as PDF, open the PDF, confirm Playfair Display Italic renders for headlines and Montserrat renders for body text.

6. **Print testing uses Chrome's print dialog.** The CSS in `template.html` is tuned for Chromium. Test prints from Chrome only. If a future developer wants Firefox/Safari fidelity, that's a separate project.

---

## Stack decisions already made

- **No login.** Anyone with the URL can edit. (Pilot phase. Add auth later.)
- **Data store:** your choice — single JSON file with an API route, or a tiny database (Supabase free tier, Vercel KV, etc.). The owner is fine with either. **Recommend a database** so edits can be rolled back if a manager wipes a field; the JSON-file approach offers no history.
- **Editor layout:** form fields on the left, **live preview of the rendered menu on the right** (in an iframe pointing at the Preview route, or the rendered HTML injected into a sandboxed iframe). Live preview, not click-to-preview.
- **Export:** the manager clicks "Print Menu" → opens the rendered menu in a new tab → automatically triggers the Chrome print dialog → manager chooses "Save as PDF" or sends to printer. **Do not implement a server-side PDF generator** — browser print is the highest-fidelity option and matches the current workflow exactly.

---

## What's in this folder

| File | Purpose |
|---|---|
| `README.md` | This file — start here. |
| `BUILD-SPEC.md` | Detailed data model, edit constraints, UI sketch, edge cases. |
| `template.html` | Golden-master menu. CSS and structure frozen. |
| `expected-render.html` | Snapshot baseline. `render(template, seed-data)` must equal this. |
| `menu-data.json` | Seed data for initial DB population (or default JSON file). |
| `render.js` | The renderer. Single source of truth for JSON → HTML. |
| `snapshot-test.spec.js` | The safety net. Must pass on every commit. |
| `fonts/` | Self-hosted Playfair Display .ttf files. Ship to `/fonts/` on prod. |

---

## Minimal route map (suggested)

```
/                  Editor UI — forms left, live preview iframe right
/api/menu  GET     Returns current menu-data.json
/api/menu  PUT     Accepts updated JSON, validates, saves
/preview           Reads current JSON, renders, serves rendered HTML
                   (used inside the editor's iframe; no auto-print)
/print             Same as /preview but appends a small <script> that calls
                   window.print() on load, after fonts are ready
```

The editor pane on the right is simply `<iframe src="/preview">` — re-load it on each save (debounce 300ms) or expose a postMessage update channel.

---

## Build sequence

1. Read `BUILD-SPEC.md` end-to-end.
2. Stand up the data store. Seed it from `menu-data.json`.
3. Implement `/api/menu` GET + PUT.
4. Implement `/preview` and `/print`. Verify they render correctly against `template.html`.
5. Wire up the snapshot test. Run it locally and in CI. Confirm it fails when you break things on purpose, then revert.
6. Build the editor UI. Form fields for each editable field. Drag-to-reorder for dishes within a section.
7. Deploy. Test print from production. Verify fonts.
8. Hand back the URL and a one-page user guide.

---

## Out of scope for v1

- Authentication / per-user accounts (owner will add later if needed)
- Adding/removing **dishes** (layout cannot accept extra dishes safely). The pasta add-on **items** are a separate, variable-cardinality list and CAN be edited — see BUILD-SPEC.
- Adding/removing **salad or steak add-on items** — those cardinalities are fixed. (Their toggles + prices are editable, but the set of items is locked.)
- Adding/removing sections (each section's page placement is part of the design)
- Moving dishes between sections (a Pasta in the Secondi column would mis-frame)
- Editing the CSS, fonts, or page-break structure of `template.html`
- Photo uploads, allergen tags, dietary icons (none of this exists in current menu)
- Multi-language support
- Audit log / revision history (recommended but not required for v1)

If any of those are requested later, treat them as separate scoped projects.
