# Siena — Course Menu (generic 2–4 courses) · Developer Handoff

A single 8.5×11 in print menu the menu editor can use for any one-off course menu ("Two Course Special", "Tasting Menu", etc.). It's built from the Tues/Wed v2 prix-fixe page: chapter-rule Roman numerals, one dish per course.

## Files

| File | Purpose |
|---|---|
| `template.html` | Static markup + CSS. The source of truth for layout. |
| `render.js` | UMD `SienaCourseMenuRender.render(doc, data)`. Fills in the template's content fields and removes unused/optional blocks. |
| `validate.js` | UMD `SienaCourseMenuValidate`. Layout checks: **hard block** on Save. Needs a real browser. |
| `menu-data.json` | Seed data (3 courses, everything on). |
| `expected-render.html` | `render(template, seed)` serialized. Snapshot target. |
| `snapshot-test.spec.mjs` | Vitest + JSDOM: byte-exact snapshot + slot/optional-block tests. |
| `validator-harness.html` | Open in a browser (served over http) to see the validator on 2/3/4-course and failure cases. |
| `fonts/` | Self-hosted Playfair Display (roman + italic variable). Montserrat loads from Google Fonts. |
| `BUILD-SPEC.md` | Field-by-field editor spec + integration steps. |

## Quick start

```bash
npx vitest run snapshot-test.spec.mjs
npx serve .   # then open /validator-harness.html
```

Print: open the rendered page with `?print=1`. It waits for `document.fonts.ready`, then calls `print()`.
