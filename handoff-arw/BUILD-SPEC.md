# Siena Austin Restaurant Weeks Menu — Build Spec

The $50 ARW dinner menu: three courses (Antipasti, Entr&eacute;e, Dolci), each a **fixed set of choices** the guest picks one from. Fixed cardinality — **5 Antipasti / 8 Entr&eacute;e / 3 Dolci slots** — set once by the restaurant for the run of Austin Restaurant Weeks (Aug 28&ndash;Sep 13, 2026) and not add/removable through the editor.

This package is the developer handoff for the in-house menu editor + print system. The CSS, layout, and all copy **except** the fields listed in §2 are frozen in `template.html`.

---

## 1. UMD contract

```js
SienaARWRender.render(document, data);      // render.js — mutates the document in place
SienaARWValidate.validate(documentOrRoot);   // validate.js — layout-budget + line-count check
SienaARWValidate.waitForLayout(document);    // -> Promise, resolves once fonts are ready
```

- Single self-contained UMD files, no imports, no `fetch`, no external deps.
- `render()` is idempotent for a given `(document, data)` pair.
- **JSDOM cannot host the validator** — it doesn't compute CSS layout or `getClientRects()`. Run it in a real browser or headless Chromium (Playwright/Puppeteer). `render()` itself is plain DOM mutation and is JSDOM-safe (see snapshot test).

---

## 2. What's editable

**Only** these fields are exposed in the editor. Everything else on the page — the ARW wordmark, the dates, the $50 price, the section labels ("Antipasti" / "Entr&eacute;e" / "Dolci"), "choice of one", the CTFB logo and impact line, the "Also at Siena" weekly block, and the footnote — is static chrome with no data hook. Don't expose them as fields.

| Field | Cardinality | Notes |
|---|---|---|
| `subtitle` | 1, required | "Three-Course Prix Fixe Dinner". **Must never wrap to 2 lines.** |
| `courses.antipasti.items[0..4]` | fixed 5 slots, ids `antipasti-1`…`antipasti-5` | `name`, `desc`, `upcharge` per slot. |
| `courses.entree.items[0..7]` | fixed 8 slots, ids `entree-1`…`entree-8` | same shape. |
| `courses.dolci.items[0..2]` | fixed 3 slots, ids `dolci-1`…`dolci-3` | same shape. |

Each item slot has:
- `name` (required to show the slot at all) — dish name. **Must never wrap to 2 lines.**
- `desc` — ingredient line. **May wrap to 2 lines, never 3.**
- `upcharge` — digits only, optional. The `+` prefix is rendered statically; empty removes the whole "+N" pill (and the space before it).

**Cardinality is fixed and slot-matched by `id`, never by array position.** The editor must not let the user add a slot beyond the fixed 5/8/3, and must not let them rename/reorder ids. The only "remove" action available is clearing a slot's `name` (and `desc`/`upcharge` along with it) — see §3.

---

## 3. Removing a dish — reflow rules

Clearing a slot's `name` to empty removes that dish from the printed page. `render()` handles the reflow automatically:

- **A slot with an empty `name` is hidden** (`display:none`) and excluded from the grid — no gap is left behind.
- **If every slot in a course ends up empty, the entire course — rule, numeral, title, "choice of one", and the (now-empty) grid — is hidden.** The page reflows around the missing course (the footer settles higher, same `margin-top:auto` mechanism already in the layout).
- **Grid columns rebalance to the visible count.** Antipasti and Entr&eacute;e use a 2-column base grid; Dolci uses 3. When the visible count is less than or equal to the base column count, the grid uses exactly that many columns (so items evenly fill the row — no dead space). When the visible count exceeds the base column count with a remainder (only possible for the 2-column courses, since Dolci never exceeds 3 items), the **last visible item spans the full row** instead of sitting alone in a half-empty row — the same treatment already used for Bruschetta (the 5th Antipasti item) in the shipped design.

This logic lives in `layoutCourse()` in `render.js` — it is generic across all three courses; don't special-case any one course.

---

## 4. Constraint model — per-field line caps + page-fit

Two layers, both enforced by `validate.js`:

1. **Line caps per field** (hard block):
   - `subtitle`: **max 1 line.**
   - every `*-name` field: **max 1 line.**
   - every `*-desc` field: **max 2 lines.**

   The validator counts rendered line boxes via `Range.getClientRects()` on the live element (not a character count — line-wrap depends on the actual rendered width/font, so this is the only reliable signal). `template.html` also carries defensive CSS (`white-space:nowrap` + ellipsis on 1-line fields, `-webkit-line-clamp:2` on descriptions) so a runaway value degrades to a visibly-truncated preview rather than breaking layout — but that CSS is a safety net, not the validation mechanism. The validator is what blocks Save.

2. **Page fit** (hard block, same mechanism as prior Siena menu handoffs): after any edit, `.page.scrollHeight` must not exceed `.page.clientHeight`. Because every field is already line-capped, this should only ever trip in pathological combinations (e.g. every remaining description maxed to 2 lines at once) — it's a safety net behind the per-field caps, not the primary constraint.

### Editor integration

```js
SienaARWRender.render(iframeDoc, candidateData);
await SienaARWValidate.waitForLayout(iframeDoc);
var report = SienaARWValidate.validate(iframeDoc);
// report -> { fits, overflowPx, violations: [{field, rule, lines}, ...], worstField }
if (!report.fits) {
  // HARD BLOCK — disable Save. report.violations names each offending field
  // (e.g. "entree-4-desc" with rule "max-2-lines") so the UI can point at it directly.
}
```

**Hard block, no soft-warn fallback** — matches the constraint model used on the other Siena menu handoffs.

### Optional soft paste-guards (recommended, not required)

The validator is the source of truth. These are just paste-safety caps to stop someone dropping a paragraph into a field before the live validator even gets a chance to lay it out:

- `subtitle`: 45 chars
- `*-name`: 40 chars
- `*-desc`: 140 chars
- `upcharge`: 3 digits

---

## 5. Optional-field toggle rules (renderer behaviour)

| Field state | Renderer behaviour |
|---|---|
| item `name` empty | Slot hidden (`display:none`), excluded from grid flow and column math. `desc`/`upcharge` are ignored when `name` is empty. |
| item `upcharge` empty (name set) | The `[data-upcharge-wrap]` span (the leading space + "+N" pill) is removed; the description reads as a clean line with no trailing price. |
| all slots in a course empty | Whole `[data-course-id]` block hidden. |

A "filled" value means the trimmed string is non-empty. `null`, `undefined`, `""`, and whitespace-only all count as empty.

---

## 6. DOM hooks

| Slot | Selector | Field |
|---|---|---|
| Subtitle | `[data-text-id="subtitle"]` | `subtitle` |
| Course wrapper | `[data-course-id="antipasti\|entree\|dolci"]` | hidden when the course has 0 visible items |
| Dish grid | `[data-grid="antipasti\|entree\|dolci"]` | `style.gridTemplateColumns` set by `layoutCourse()` |
| Dish slot | `[data-item-id="<id>"]` | hidden (`display:none`) when empty; `style.gridColumn` set to `1 / -1` when it's the odd item out |
| Dish name | `[data-text-id="<id>-name"]` | `name` (textContent) |
| Dish desc | `[data-text-id="<id>-desc"]` | `desc` (textContent) |
| Upcharge wrap | `[data-upcharge-wrap="<id>"]` | removed when `upcharge` empty |
| Upcharge value | `[data-text-id="<id>-upcharge"]` | `upcharge` (textContent), no `+` — the `+` is static markup |

`textContent` for every field — no HTML fields on this menu (unlike prior handoffs' `policy_line`, this menu has no HTML-allowed field).

### Validator diagnostic hooks

Any `field` string in `report.violations` is either `"subtitle"` or `"<id>-name"` / `"<id>-desc"` for one of the 16 fixed ids (`antipasti-1`…`antipasti-5`, `entree-1`…`entree-8`, `dolci-1`…`dolci-3`).

---

## 7. Static / not editable

- **All chrome**: ARW wordmark image, the "August 28 &ndash; September 13, 2026" date line, the "$50" price and "Three-Course Prix Fixe Dinner" *label position* (the text itself is editable per §2, the surrounding chrome is not), the Roman numerals `I` / `II` / `III`, "Antipasti" / "Entr&eacute;e" / "Dolci", "choice of one", the CTFB circle badge and its impact line, the "Also at Siena" weekly block and its three promos, and the footnote.
- **All typography** (Playfair Display Italic for display, Montserrat for UI/body), **all colors** (gold `#b8821e`, browns `#5a2e0e` / `#3a1a06`, rule `#c9a87a`), **all spacing**, **page padding**.
- **Cardinality**: exactly 5 Antipasti / 8 Entr&eacute;e / 3 Dolci slots. No slot can be added. A slot can only be cleared (see §3) or edited.
- **Banned word:** `extravaganza` — block submission anywhere it appears (case-insensitive), per standing owner direction on all Siena menu copy.

---

## 8. Files in this handoff

| File | Purpose |
|---|---|
| `template.html` | Frozen layout with `data-*` hooks. Self-hosts Playfair from `fonts/`; loads Montserrat from Google; images from `images/`. |
| `render.js` | UMD renderer — JSON → DOM, including the course-removal reflow logic. |
| `validate.js` | UMD validator — per-field line-count caps + page-fit. |
| `menu-data.json` | Seed data — the current, approved ARW menu copy. Matches `template.html`'s baked-in content exactly. |
| `expected-render.html` | Snapshot baseline: `render(template, menu-data.json)` output. Identical to `template.html` here because the seed data matches the template's default content 1:1. |
| `snapshot-test.spec.mjs` | Vitest test, runs the renderer in JSDOM and diffs against the baseline. |
| `images/` | `arw-wordmark.png` (cropped to content), `ctfb-circle.png`. |
| `fonts/` | Self-hosted Playfair Display variable + italic variable. |

---

## 9. Gotchas

- **Line-count validation needs a real layout engine.** `Range.getClientRects()` returns nothing meaningful in JSDOM — validate in the live preview iframe or a headless browser, never in the same process as the snapshot test.
- **Wait for `document.fonts.ready`** before validating — Playfair Display is a variable font; measuring before it swaps in can miscount lines by one.
- **Don't special-case any single course in `layoutCourse()`.** The column-rebalance + span-last-if-remainder logic is intentionally generic across Antipasti/Entr&eacute;e (2-col base) and Dolci (3-col base, which — because its cardinality is only 3 — never actually hits the "remainder" branch, but the code doesn't need to know that).
- **The word `extravaganza` is banned** in any Siena menu copy, per standing owner direction.
- **Don't ASCII-fold smart punctuation** — the curly apostrophe in "Entr&eacute;e", the en dash in the date range, and accented characters (`&egrave;`, `&eacute;`) are intentional.
