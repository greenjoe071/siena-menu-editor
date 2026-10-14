# Spring Menu handoff — Nov 2026 changes

## Contorni can show up to 7 dishes (was fixed at 6)

| File | Change |
|---|---|
| `render.js` | `ADDABLE_SECTIONS = { pasta: true, contorni: true }`. `column_order` logic in `renderSection` (first `ceil(N/2)` visible dishes in the LEFT column) is included — keep it. |
| `validate.js` | `CONTORNI_MAX = 7` (exported). `validateData` enforces per-section caps (`pasta-count` ≤ 8, `contorni-count` ≤ 7). `validateAdds` allows new ids in Pasta and Contorni. Page-2 overflow with >6 Contorni says the 7th Contorni dish doesn't fit. |
| `validate-check.html` | New scenarios: 7th Contorni (pass), 8th Contorni (blocked), 7th Contorni + long Pasta text (blocked), 8 pasta + 7 Contorni (pass). |
| `BUILD-SPEC.md` | Adding-dishes, editable table, validator table updated. |
| `template.html`, `menu-data.json`, `expected-render.html` | **Unchanged.** Seed still has 6 Contorni and no `column_order`, so the snapshot test passes as-is. |

### Layout behavior (no CSS change)
- 7 Contorni → 4 rows; with `column_order: true`, dishes 1–4 left, 5–7 right.
- The building illustration stays 1.3in (never shrinks) and re-centers between the bottom of Contorni and the footnote rule (measured 28px above / 28px below).
- Footnotes (raw-food warning + "No split checks") do not move — same position as with 6 dishes.

### Editor
- Show "Add dish" on Contorni; disable it at 7 visible.
- Server: reject `contorni-count` on PUT `/api/menu`, same as `pasta-count`.
