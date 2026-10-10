# Spring Menu — October 2026 update

Read this first if you built against the earlier handoff. Full detail lives in `BUILD-SPEC.md` (sections marked "Oct 2026").

## Files changed
| File | Change |
|---|---|
| `template.html` | Non-Alcoholic box CSS (below) + lone-dish centering CSS. No markup changes. |
| `render.js` | Dish hide/show, hidden-dish removal, Pasta add (new slots), empty container/section cleanup. Same `SienaRender.render(doc, data)` API. |
| `menu-data.json` | Every dish now has `"enabled": true`. |
| `expected-render.html` | Regenerated from the above. Snapshot test unchanged — must pass. |
| `validate.js` | **NEW.** Fit validator, `SienaSpringValidate`. HARD BLOCK on Save. |
| `validate-check.html` | **NEW.** Open in Chrome via a local server; 7 scenarios showing pass/block. |
| `BUILD-SPEC.md`, `README.md` | Updated to match. |

## 1. Non-Alcoholic box (CSS only)
- Border **3.25pt** solid deep red `#7a1712` (was 1.25pt gold), padding `13pt 14pt 9pt`, `position: relative`.
- Red diamonds centered on left/right borders (`.drinks-panel::before/::after`, white halo).
- "Non-Alcoholic Beverages" sits **on the top border** (absolutely positioned, white background behind the text); its side rules are hidden.
- "Mocktails" now uses the same Montserrat 700 9pt caps as the title; both titles + the Mocktails rules are red.

## 2. Dish hide/show — every section
- `sections.<id>.items[*].enabled` (absent = true). Hidden = removed from the DOM; later dishes shift back one slot. Not a delete — data is kept.
- A section with exactly ONE visible dish centers it (CSS). Odd last rows stay left — don't center them.
- Editor: show/hide switch on every dish row; hidden rows stay listed, greyed.

## 3. Adding dishes — Pasta only, max 8 visible
- Push a new dish into `sections.pasta.items` (fresh `d-xxxx` id). `render.js` builds the slot.
- No "Add dish" anywhere else.

## 4. Add-on lines — salad & steak now work like pasta
- All three lines: editable names, prices, add/remove/reorder items, per-item and per-line show/hide.
- **One-line rule is now a HARD BLOCK on all three** (replaces pasta's ≤70-char warning). Measured from layout, not characters.

## 5. Page-fit HARD BLOCK (new)
- Pages are fixed 8.5×11 with `overflow: hidden`, so overflow would be silently clipped in print.
- After every edit: render → `await SienaSpringValidate.waitForLayout(doc)` → `validate(doc, { data })`. If `fits === false`, disable Save and show `problems[].message`. Never auto-shrink.
- Checks: page overflow (6pt safety margin), add-on line wrap, Pasta > 8, new dish outside Pasta.
- JSDOM can't run it (no layout). Test in Chrome.
- Server-side: run `validateData(data)` on PUT `/api/menu`.

## Verify
1. Run the snapshot test — should pass as-is.
2. Open `validate-check.html` from a local server — seed shows "Fits"; the "blocked" scenarios block.
