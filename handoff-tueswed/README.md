# Siena Tues/Wed Menu — Handoff (v3, Oct 2026)

Developer handoff for the **Tuesday & Wednesday** menu: a "Tuesdays Only" special box on top, then the Chef's Three-Course $45 prix fixe, an optional add-on, and four weekly cells at the bottom. The CSS and layout are frozen. The editor edits data only.

**v3 replaces v2.** The data shape has changed (new `special` and `weekly`, `policy_line` removed). Read `CHANGES-v3.md` first.

## Quickstart

```bash
npm install
npx vitest run snapshot-test.spec.mjs   # template + render.js + seed + expected-render in sync
open template.html                       # renders standalone with seed-equivalent defaults
open validate-check.html                 # 8 validator scenarios (needs a local web server for fetch())
```

## Files

| File | Purpose |
|---|---|
| **`BUILD-SPEC.md`** | Data shape, editable fields, validator, editor UI. **Start here.** |
| **`CHANGES-v3.md`** | What changed from v2. |
| `template.html` | Frozen layout. Playfair self-hosted from `fonts/`, Montserrat from Google Fonts. |
| `render.js` | UMD `SienaTuewedRender.render(document, data)`. The name keeps its v1 typo, so don't rename it. |
| `validate.js` | UMD `SienaTuewedValidate`. HARD BLOCK layout validator. |
| `validate-check.html` | Browser harness with 8 scenarios. All should show ✓. |
| `menu-data.json` | Seed data = the live menu. |
| `expected-render.html` | Snapshot baseline (byte-exact `render(template, seed)` output). |
| `snapshot-test.spec.mjs` | Vitest + JSDOM snapshot test (unchanged format). |

## Editor contract

1. On every edit (debounced): `render(previewDoc, candidate)`, then `await SienaTuewedValidate.waitForLayout(previewDoc)`, then `const report = SienaTuewedValidate.validate(previewDoc)`.
2. If `report.fits === false`, disable Save and show the message for each `report.problems[]` entry (see BUILD-SPEC §4).
3. On save, persist the `menu-data.json` shape exactly as it is.

## Changing template or seed

Re-render `expected-render.html` from the template + seed and commit all three together.
