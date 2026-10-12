# BUILD-SPEC — Tues/Wed Menu v3

## 1. Page

Single page, 8.5×11 in, portrait. Top to bottom:

1. **Tuesdays Only box**: deep red `#7a1712` 3.25pt border with red ◆ on the side borders. The label sits on the top border. Inside are the dish name with an inline gold price, then the description.
2. **Header (static)**: "Tuesday & Wednesday" (Playfair italic 38pt), then "Chef's Three-Course Menu $45" (22pt, gold price).
3. **Courses I / II / III**: a small gold numeral, the dish name, and a 12pt description.
4. **Add-on** (optional): title, an "Add $XX" pill and a small caps note.
5. **Weekly cells**: four columns with day, headline and detail. There's no section title and no rule above them; the owner removed both, so don't re-add.

`.menu-body` uses `flex:1; justify-content:space-evenly`, so longer copy grows into the gaps. The page only overflows when the gaps are used up (Pattern B).

## 2. Data shape (`menu-data.json`)

```json
{
  "special": { "label": "Tuesdays Only", "title": "…", "price": "25", "desc": "…" },
  "price": "45",
  "courses": [ { "id": "course-1", "title": "…", "desc": "…" }, … ×3 ],
  "addon":   { "title": "…", "desc": "…", "price": "25" },
  "weekly":  [ { "id": "week-1", "day": "…", "headline": "…", "detail": "…" }, … ×4 ]
}
```

Prices are digits only; the `$` is static.

## 3. Editable fields

| Field | Required? | Empty behaviour |
|---|---|---|
| `special.label` | required | the editor must not allow empty |
| `special.title` | required | the editor must not allow empty |
| `special.price` | required | the editor must not allow empty |
| `special.desc` | optional | description line removed |
| `price` (prix fixe) | required | — |
| `courses[n].title` / `.desc` | required | — |
| `addon.title` | optional | **entire add-on block removed** (this is its on/off switch) |
| `addon.price` | optional | "Add $" pill removed |
| `addon.desc` | optional | note line removed |
| `weekly[n].day` / `.headline` | required | — |
| `weekly[n].detail` | optional | detail line removed |

**Fixed counts:** 3 courses and 4 weekly cells. The editor must not let users add, remove or reorder them. There's always exactly one special box, and it has **no on/off toggle** (owner decision).

**Static (not editable):** "Tuesday & Wednesday", "Chef's Three-Course Menu", numerals I/II/III, the `$` glyphs, and "Add $".

DOM hooks: `data-text-id` on every editable slot, `data-section-id` on each measurable section (`special`, `header`, `course-1..3`, `addon`, `weekly`, `week-1..4`).

## 4. Validator — HARD BLOCK

`SienaTuewedValidate.validate(doc)` returns `{ fits, problems[], overflowPx, naturalHeightPx, maxHeightPx, sections, worstSection }`. Save is disabled while `fits === false`. Never auto-shrink text.

| `problems[].code` | Rule | Suggested message |
|---|---|---|
| `page-overflow` | Natural page height (`.page` measured at `height:auto`) > 11in − 6pt. Do NOT use scrollHeight, because the flex gaps hide overflow. | "The menu no longer fits on the page. Try shortening {worstSection}." |
| `label-overflow` | The "Tuesdays Only" label is wider than the box minus 40pt. It must stay on one line on the border. | "The Tuesday box label is too long. Keep it short, like 'Tuesdays Only'." |

`worstSection` is the tallest editable section (`special`, `course-1..3`, `addon`, `week-1..4`) and is only set on page overflow. Map it to a readable name: Tuesday special, Course I/II/III, Add-on, Weekly cell 1–4.

The seed uses about 994 of 1048 px, so there's about 54 px (roughly two lines of description) of room. That's tighter than v2. Expect the validator to block long descriptions.

The validator needs a real layout engine (browser / iframe / headless browser). It can't run in JSDOM. `validate-check.html` runs 8 scenarios.

## 5. Editor UI sketch

- **Tuesday special**: Label, Dish name, Price, Description.
- **Prix fixe**: Price, then Course I/II/III (name + description each).
- **Add-on**: Title (clear to hide), Price, Note.
- **Weekly cells 1–4**: Day, Headline, Detail.
- A live preview on the right, with a validator status bar under it.

## 6. Print

`@page { size: 8.5in 11in; margin: 0 }`. Wait for `document.fonts.ready` before printing (the variable fonts need it), e.g. `document.fonts.ready.then(() => setTimeout(window.print, 500))`.
