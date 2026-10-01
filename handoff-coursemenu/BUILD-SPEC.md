# BUILD-SPEC — Generic Course Menu

## 1. Page

- 8.5×11 in, single page. Padding `0.55in 0.65in 0.7in`. The bottom padding is larger because the bottom corners slide into the hard-cover holder. **Don't normalize it.**
- Type: Playfair Display Italic (header, price, numerals, dish names, add-on title), Montserrat (descriptions, add-on price/note, footer).
- Body uses `justify-content: space-evenly`, so spare height spreads between courses. Fewer courses means more air, more courses means tighter spacing. No per-count CSS.

## 2. Editable fields

| Field | Editor control | Required | Rule |
|---|---|---|---|
| `header` | single-line text | yes | Header **and** price must sit on one line (validator `header-wrap`). Placeholder: "Two / Three / Four Course Special" to match the course count. |
| `price` | digits | yes | `$` is static in the template. |
| `description` | single-line text | no | **One line, never wraps** (`white-space: nowrap`). Empty → line removed. Validator `desc-overflow` blocks Save if it would be clipped. |
| `courses[]` | list, add/remove | yes | **2 min, 4 max.** Order sets the numeral (I, II, III, IV). Each has `title` (required) and `desc` (optional; empty → removed). |
| `addon.title` | text | no | The on/off switch. Empty → whole add-on block removed. |
| `addon.price` | digits | no | Renders "Add $XX". Empty → only the price removed. |
| `addon.desc` | text | no | Small-caps note. Empty → only the note removed. |
| `footer.enabled` | toggle | no | Off → footer block removed. |
| `footer.policy_line` | text (inline HTML allowed: `<strong>`) | no | Empty → footer removed. |

Static template chrome, never editable: the `$` glyph, "Add $", Roman numerals, gold chapter rules, and the thin divider above the add-on.

There's **no** menu title, no second price / wine-pairing price, no decorative rule under the header, no rule above the footer, and no weekly-specials footer. All of these were removed in design review. Don't add them back.

## 3. Editor behaviour

- Enforce 2 ≤ `courses.length` ≤ 4: disable "Remove course" at 2 and "Add course" at 4.
- When the course count changes, suggest the matching header placeholder (don't overwrite text the user has typed).

## 4. Constraint model: Pattern B (layout budget), HARD BLOCK

There are no per-field character caps. After every edit:

```js
const doc = previewIframe.contentDocument;            // fresh copy of template.html
const report = await SienaCourseMenuValidate.renderAndValidate(doc, data, SienaCourseMenuRender.render);
saveButton.disabled = !report.fits;
report.issues.forEach(i => showError(i.section, i.message));
```

Re-render into a **fresh** template each time. `render()` removes nodes, so you can't re-run it on an already-rendered document to bring removed blocks back.

| `issue.code` | Meaning | `section` |
|---|---|---|
| `course-count` | Fewer than 2 or more than 4 courses | `null` |
| `header-wrap` | Header too long; the price wrapped or the header broke onto 2 lines | `hero` |
| `desc-overflow` | Description wider than one line (would be clipped) | `description` |
| `page-overflow` | Page taller than 11 in | tallest editable section (`course-N` / `addon` / …) |

Measured headroom with sample text at the maximum (every field on, every dish description at 2 lines): all of 2, 3 and 4 courses fit, and a 4-course menu with every field on still fits with 3-line dish descriptions. `page-overflow` only triggers on very long copy (e.g. 5-line descriptions on all 4 courses ≈ 47px over). The validator must run in a real browser (JSDOM has no layout).

## 5. Snapshot

`expected-render.html` = `'<!DOCTYPE html>' + documentElement.outerHTML` after `render(template, menu-data.json)`. Byte-identical to JSDOM `dom.serialize()`. If you change `template.html`, `render.js` or `menu-data.json`, regenerate `expected-render.html` and commit all of them together.
