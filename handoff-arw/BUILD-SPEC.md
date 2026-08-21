# Siena Austin Restaurant Weeks Menu — Build Spec

The $50 ARW dinner menu: three courses (Antipasti, Entr&eacute;e, Dolci), each a **fixed set of choices** the guest picks one from, plus one featured cocktail. Fixed cardinality — **5 Antipasti / 8 Entr&eacute;e / 3 Dolci slots** — set once by the restaurant for the run of Austin Restaurant Weeks (Aug 28&ndash;Sep 13, 2026) and not add/removable through the editor.

This package is the developer handoff for the in-house menu editor + print system. The CSS, layout, and all copy **except** the fields listed in §2 are frozen in each template file.

---

## 0. Two styles, one dataset

The editor offers managers **two visual styles** for this same menu:

| Style | File | Look |
|---|---|---|
| Two-Column Classic | `template.html` | Centered hero, dish names/descriptions in a centered 2- (Antipasti/Entr&eacute;e) or 3-column (Dolci) grid. |
| Left-Aligned | `template-left-aligned.html` | Left-aligned hero (logo right), single-column stacked dish list, name — description inline per line. |

**Both templates expose the exact same `data-*` hooks** (§6) and are driven by the exact same `SienaARWRender.render(doc, data)` / `SienaARWValidate.validate(doc)` calls — same `menu-data.json` shape feeds either one. There is no per-style data fork: a manager edits copy once and it's correct in both styles.

**Style selection has no default.** The editor must make the manager explicitly pick Two-Column Classic or Left-Aligned before any editing UI appears — don't pre-select either one. The chosen style is a UI/rendering concern (which template file you mount and re-render on every keystroke); it is not stored in `menu-data.json`.

---

## 1. UMD contract

```js
SienaARWRender.render(document, data);      // render.js — mutates the document in place
SienaARWValidate.validate(documentOrRoot);   // validate.js — layout-budget + line-count check
SienaARWValidate.waitForLayout(document);    // -> Promise, resolves once fonts are ready
```

- Single self-contained UMD files, no imports, no `fetch`, no external deps.
- `render()` is idempotent for a given `(document, data)` pair.
- `render()` works unmodified against either template's DOM — it's driven entirely by the `data-*` hooks, never by template-specific markup assumptions.
- **JSDOM cannot host the validator** — it doesn't compute CSS layout or `getClientRects()`. Run it in a real browser or headless Chromium (Playwright/Puppeteer). `render()` itself is plain DOM mutation and is JSDOM-safe (see snapshot test) — except the orphan-line-fix described in §4a, which silently no-ops under JSDOM for the same reason.

---

## 2. What's editable

**Only** these fields are exposed in the editor, in either style. Everything else — the ARW wordmark, the dates, the $50 price, the section labels ("Antipasti" / "Entr&eacute;e" / "Dolci"), "choice of one", the CTFB logo and impact line, the "Also at Siena" weekly block, and the footnote — is static chrome with no data hook, confirmed with the owner as staying fixed. Don't expose them as fields.

| Field | Cardinality | Notes |
|---|---|---|
| `subtitle` | 1, required | "Three-Course Prix Fixe Dinner". **Must never wrap to 2 lines.** |
| `cocktail.name` | 1, optional | Featured cocktail title. **Must never wrap to 2 lines.** Clearing it hides the entire featured-cocktail block (see §5). |
| `cocktail.desc` | 1, optional | Featured cocktail description. **May wrap to 2 lines, never 3.** |
| `cocktail.price` | 1, optional | Digits only (no currency symbol, no "+" — this is a standalone price, not an upcharge). Empty hides just the price, not the cocktail. |
| `courses.antipasti.items[0..4]` | fixed 5 slots, ids `antipasti-1`…`antipasti-5` | `name`, `desc`, `upcharge` per slot. |
| `courses.entree.items[0..7]` | fixed 8 slots, ids `entree-1`…`entree-8` | same shape. |
| `courses.dolci.items[0..2]` | fixed 3 slots, ids `dolci-1`…`dolci-3` | same shape. |

Each dish slot has:
- `name` (required to show the slot at all) — dish name. **Must never wrap to 2 lines.**
- `desc` — ingredient line. **May wrap to 2 lines, never 3.**
- `upcharge` — digits only, optional. The `+` prefix is rendered statically; empty removes the whole "+N" pill (and the space before it).

**Cardinality is fixed and slot-matched by `id`, never by array position.** The editor must not let the user add a slot beyond the fixed 5/8/3, and must not let them rename/reorder ids. The only "remove" action available on a dish is clearing its `name` (and `desc`/`upcharge` along with it) — see §5.

---

## 3. Removing a dish — reflow rules

Clearing a slot's `name` to empty removes that dish from the printed page. `render()` handles the reflow automatically:

- **A slot with an empty `name` is hidden** (`display:none`) and excluded from the grid/list — no gap is left behind.
- **If every slot in a course ends up empty, the entire course — rule, numeral, title, "choice of one", and the (now-empty) grid/list — is hidden.** The page reflows around the missing course (the `.menu-body` wrapper is `flex:1; justify-content:center`, so it re-centers between the hero and the footer automatically).
- **Two-Column Classic only — grid columns rebalance to the visible count.** Antipasti and Entr&eacute;e use a 2-column base grid; Dolci uses 3. When the visible count is less than or equal to the base column count, the grid uses exactly that many columns. When the visible count exceeds the base column count with a remainder (only possible for the 2-column courses, since Dolci never exceeds 3 items), the **last visible item spans the full row** instead of sitting alone in a half-empty row.
- **Left-Aligned has no grid** — it's a single stacked column, so clearing a slot just removes its line; nothing else to rebalance.

This logic lives in `layoutCourse()` in `render.js` — it is generic across all three courses and both templates (it detects the absence of a `[data-grid]` element and skips the column math for Left-Aligned); don't special-case any one course or style.

---

## 4. Constraint model — per-field line caps + page-fit

Two layers, both enforced by `validate.js`:

1. **Line caps per field** (hard block):
   - `subtitle`: **max 1 line.**
   - `cocktail-name`: **max 1 line.**
   - `cocktail-desc`: **max 2 lines.**
   - `cocktail-price`: digits only (1–3 digits), same rule as an upcharge.
   - every dish `*-name` field: **max 1 line.**
   - every dish `*-desc` field: **max 2 lines.**

   The validator counts rendered line boxes via `Range.getClientRects()` on the live element (not a character count — line-wrap depends on the actual rendered width/font, so this is the only reliable signal). Both templates also carry defensive CSS (`white-space:nowrap` + ellipsis on 1-line fields, `-webkit-line-clamp:2` on descriptions) so a runaway value degrades to a visibly-truncated preview rather than breaking layout — but that CSS is a safety net, not the validation mechanism. The validator is what blocks Save.

2. **Page fit** (hard block, same mechanism as prior Siena menu handoffs): after any edit, `.page.scrollHeight` must not exceed `.page.clientHeight`. Because every field is already line-capped, this should only ever trip in pathological combinations — it's a safety net behind the per-field caps, not the primary constraint.

3. **Banned word:** `extravaganza` — block submission anywhere it appears (case-insensitive) in any `data-text-id` field, per standing owner direction on all Siena menu copy. `validate.js` checks every editable field automatically.

### 4a. Orphan-word line fix (both templates, all description fields)

When a `*-desc` or `cocktail-desc` field wraps to a second line, `render()` prevents that second line from stranding just 1–2 words: it re-measures the rendered text and, if the wrapped line has fewer than 3 words, glues the trailing words together with a non-breaking space (`\u00A0`) so they move as one unit. This **guarantees at least 3 words on a wrapped line** — in a narrow column, an extra whole word from above may occasionally ride down with the glued group too (more than 3 is possible; fewer than 3 never is). It re-derives from the field's plain-space text on every render, so it's safe to call repeatedly as the manager types.

This requires real layout (`getClientRects()`), same as the validator — it silently does nothing under JSDOM, which is why the snapshot test's baseline has no glued (`\u00A0`) text: it's exercising the DOM-mutation path only, not the layout-dependent fix. Test the actual gluing behavior in a real browser or Playwright, not in the JSDOM suite.

### Editor integration

```js
SienaARWRender.render(iframeDoc, candidateData);
await SienaARWValidate.waitForLayout(iframeDoc);
var report = SienaARWValidate.validate(iframeDoc);
// report -> { fits, overflowPx, violations: [{field, rule, lines}, ...], worstField }
if (!report.fits) {
  // HARD BLOCK — disable Save. report.violations names each offending field
  // (e.g. "entree-4-desc" with rule "max-2-lines", or "cocktail-price" with
  // rule "digits-only") so the UI can point at it directly.
}
```

**Hard block, no soft-warn fallback** — matches the constraint model used on the other Siena menu handoffs. Run this against **whichever template the manager currently has open** — validating one style does not guarantee the other fits, since they use different type sizes and line lengths. In practice: re-run `render()` + `validate()` against both template documents before allowing Save, and block on either failing.

### Optional soft paste-guards (recommended, not required)

The validator is the source of truth. These are just paste-safety caps to stop someone dropping a paragraph into a field before the live validator even gets a chance to lay it out:

- `subtitle`: 45 chars
- `cocktail.name`: 40 chars
- `cocktail.desc`: 140 chars
- `cocktail.price`: 3 digits
- `*-name`: 40 chars
- `*-desc`: 140 chars
- `upcharge`: 3 digits

---

## 5. Optional-field toggle rules (renderer behaviour)

| Field state | Renderer behaviour |
|---|---|
| dish `name` empty | Slot hidden (`display:none`), excluded from grid/list flow and column math. `desc`/`upcharge` are ignored when `name` is empty. |
| dish `upcharge` empty (name set) | The `[data-upcharge-wrap]` span (the leading space + "+N" pill) is removed; the description reads as a clean line with no trailing price. |
| all slots in a course empty | Whole `[data-course-id]` block hidden. |
| `cocktail.name` empty | Whole `[data-cocktail-block]` hidden — the "Featured Cocktail" label, name, dash, description, and price all disappear together. |
| `cocktail.price` empty (name set) | Just the `[data-cocktail-price-wrap]` span is removed; name/description still show. |

A "filled" value means the trimmed string is non-empty. `null`, `undefined`, `""`, and whitespace-only all count as empty.

---

## 6. DOM hooks

| Slot | Selector | Field |
|---|---|---|
| Subtitle | `[data-text-id="subtitle"]` | `subtitle` |
| Cocktail block | `[data-cocktail-block]` | hidden when `cocktail.name` is empty |
| Cocktail name | `[data-text-id="cocktail-name"]` | `cocktail.name` |
| Cocktail desc | `[data-text-id="cocktail-desc"]` | `cocktail.desc` |
| Cocktail price wrap | `[data-cocktail-price-wrap]` | removed when `cocktail.price` empty |
| Cocktail price value | `[data-text-id="cocktail-price"]` | `cocktail.price` (textContent), no currency symbol |
| Course wrapper | `[data-course-id="antipasti\|entree\|dolci"]` | hidden when the course has 0 visible items |
| Dish grid (Two-Column Classic only) | `[data-grid="antipasti\|entree\|dolci"]` | `style.gridTemplateColumns` set by `layoutCourse()`; absent on Left-Aligned |
| Dish slot | `[data-item-id="<id>"]` | hidden (`display:none`) when empty; `style.gridColumn` set to `1 / -1` on Two-Column Classic when it's the odd item out |
| Dish name | `[data-text-id="<id>-name"]` | `name` (textContent) |
| Dish desc | `[data-text-id="<id>-desc"]` | `desc` (textContent) |
| Upcharge wrap | `[data-upcharge-wrap="<id>"]` | removed when `upcharge` empty |
| Upcharge value | `[data-text-id="<id>-upcharge"]` | `upcharge` (textContent), no `+` — the `+` is static markup |

`textContent` for every field — no HTML fields on this menu (unlike prior handoffs' `policy_line`, this menu has no HTML-allowed field).

### Validator diagnostic hooks

Any `field` string in `report.violations` is one of: `"subtitle"`, `"cocktail-name"`, `"cocktail-desc"`, `"cocktail-price"`, or `"<id>-name"` / `"<id>-desc"` for one of the 16 fixed dish ids (`antipasti-1`…`antipasti-5`, `entree-1`…`entree-8`, `dolci-1`…`dolci-3`). A banned-word hit reports `rule: "banned-word:extravaganza"` on whichever field contained it.

---

## 7. Static / not editable

- **All chrome**: ARW wordmark image, the "August 28 &ndash; September 13, 2026" date line, the "$50" price and "Three-Course Prix Fixe Dinner" *label position* (the text itself is editable per §2, the surrounding chrome is not), "Featured Cocktail" label and the dash separator, the Roman numerals `I` / `II` / `III`, "Antipasti" / "Entr&eacute;e" / "Dolci", "choice of one", the CTFB circle badge and its impact line, the "Also at Siena" weekly block and its three promos, and the footnote.
- **All typography** (Playfair Display Italic for display, Montserrat for UI/body), **all colors** (gold `#b8821e`, browns `#5a2e0e` / `#3a1a06`, rule `#c9a87a`), **all spacing**, **page padding** — per style, each frozen independently.
- **Cardinality**: exactly 5 Antipasti / 8 Entr&eacute;e / 3 Dolci slots, 1 featured cocktail. No slot can be added. A slot can only be cleared (see §5) or edited.
- **Banned word:** `extravaganza` — block submission anywhere it appears (case-insensitive), per standing owner direction on all Siena menu copy.

---

## 8. Files in this handoff

| File | Purpose |
|---|---|
| `template.html` | Frozen Two-Column Classic layout with `data-*` hooks. |
| `template-left-aligned.html` | Frozen Left-Aligned layout with the identical `data-*` hooks. |
| `render.js` | UMD renderer — JSON → DOM, shared by both templates. Course-removal reflow, cocktail toggle, orphan-line fix. |
| `validate.js` | UMD validator — per-field line-count caps, cocktail-price digit check, banned-word check, page-fit. Shared by both templates. |
| `menu-data.json` | Seed data — the current, approved ARW menu copy, including the featured cocktail. Matches both templates' baked-in content exactly. |
| `expected-render.html` | Snapshot baseline: `render(template.html, menu-data.json)` output. Identical to `template.html` here because the seed data matches the template's default content 1:1. (Left-Aligned has no separate baseline file — it's covered by a lighter smoke test in `snapshot-test.spec.mjs`, since it shares the exact same renderer and data.) |
| `snapshot-test.spec.mjs` | Vitest test, runs the renderer in JSDOM against both templates and diffs the Classic output against the baseline. |
| `images/` | `arw-wordmark.png` (cropped to content), `ctfb-circle.png`. |
| `fonts/` | Self-hosted Playfair Display variable + italic variable. |

---

## 9. Gotchas

- **Line-count validation needs a real layout engine.** `Range.getClientRects()` returns nothing meaningful in JSDOM — validate in the live preview iframe or a headless browser, never in the same process as the snapshot test. The same is true of the orphan-line fix in §4a. Both `render.js` and `validate.js` wrap their `getClientRects()` calls in `try/catch` specifically because JSDOM's `Range.prototype.getClientRects` throws rather than returning an empty list — without the guard, `render()` crashes outright under JSDOM/server-side rendering. Don't remove those guards.
- **The upcharge pill markup must be a sibling of its dish's `-desc` element, never nested inside it**, in both templates. `render()` sets `-desc`'s `textContent` directly; if the pill's `data-upcharge-wrap` span is a descendant of that element, the assignment deletes it from the DOM before the upcharge logic ever runs, and the pill can never display. All 16 dish slots in both templates carry the wrap markup now (hidden via inline `display:none` for the 12 that start with no upcharge), so any slot can take an upcharge later without a template change.
- **Wait for `document.fonts.ready`** before validating — Playfair Display is a variable font; measuring before it swaps in can miscount lines by one.
- **Don't special-case any single course or style in `layoutCourse()`.** The column-rebalance + span-last-if-remainder logic only runs when a `[data-grid]` element exists, which is what makes it generic across Two-Column Classic's Antipasti/Entr&eacute;e (2-col base) and Dolci (3-col base) *and* silently correct on Left-Aligned (no grid at all).
- **The orphan-line fix is a heuristic, not a hard guarantee of exactly 3 words** — it guarantees *at least* 3 on a wrapped line, but a very narrow column can still pull a 4th or 5th word down with the glued group. That's expected; don't "fix" it further without checking with design first.
- **Validate against whichever template is currently open**, and re-validate both if you persist a Save that should be safe in either style later.
- **The word `extravaganza` is banned** in any Siena menu copy, per standing owner direction.
- **Don't ASCII-fold smart punctuation** — the curly apostrophe in "Entr&eacute;e", the en dash in the date range, the em dash before every description, and accented characters (`&egrave;`, `&eacute;`) are intentional.

---

## 10. Verified against the real, approved menu content (not placeholders)

Both templates were re-checked in a real browser (not JSDOM) with the full, real `menu-data.json` — all 5 Antipasti, all 8 Entr&eacute;e, all 3 Dolci, and the featured cocktail, after `document.fonts.ready`:

| Template | `.page.scrollHeight` | `.page.clientHeight` | Fits? |
|---|---|---|---|
| `template.html` (Two-Column Classic) | 1056px | 1056px | Yes, exactly. |
| `template-left-aligned.html` (Left-Aligned) | 1056px | 1056px | Yes, exactly. |

`validate()` returns `{ fits: true, overflowPx: 0, violations: [] }` for both. "Torta di Cioccolato"'s description ("Chocolate & Pistachio Torte, Orange Marmalade, Whipped Cream") renders on exactly **2 lines** in Two-Column Classic — at the cap, not over it.

No spacing/type-size changes were needed to hit this. The two real bugs reported alongside this request (upcharge pill nested inside `-desc`, and `render()` crashing under JSDOM via unguarded `getClientRects()`) are fixed in this revision — see the first two bullets of §9 — and `expected-render.html` has been regenerated to match the fixed `template.html`.

