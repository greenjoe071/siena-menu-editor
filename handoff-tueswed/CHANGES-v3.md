# CHANGES — v2 → v3 (Oct 2026)

**Breaking data-shape change.** Migrate saved v2 menus before rendering them with v3. v2 menus printed from Past Menus must keep using the v2 package.

## Layout
- New **Tuesdays Only** box at the top of the page: red border, label on the border, dish + price + description.
- Title is now **"Tuesday & Wednesday"**, with "Chef's Three-Course Menu $45" under it. The v2 hero (title + rule + "Prix Fixe · Tuesdays & Wednesdays") is gone.
- Chapter-rule numerals were replaced by small gold numerals above each dish name. Dish names are 19pt (v2: 22pt). Descriptions stay at 12pt.
- Weekly cells stay, but the "Throughout the Week at Siena" title and its rule are removed.
- The "No split checks · Gratuity" footnote is removed.

## Data
- **Added** `special` `{label, title, price, desc}`. It's always shown, with no toggle.
- **Added** `weekly[4]` `{id, day, headline, detail}`. The cells were static in v2 and are editable now.
- **Removed** `policy_line`.
- `price`, `courses[3]` and `addon` are unchanged.

## Validator
- Page fit is now measured at `height:auto` (natural content height) against 11in − 6pt. v2's `scrollHeight` check missed overflow that the flex gaps were hiding.
- New `label-overflow` check for the Tuesday box label.
- New `problems[]` array; `worstSection` now also covers `special` and `week-1..4`.

## Copy
- Monday cell: "Roman pasta classic" → "Sicilian pasta classic".
