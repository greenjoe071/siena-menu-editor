# Build Spec: Private Dining Menus

Adapted from the designer's handoff (`design_handoff_private_dining_menus`, received 2026-07-22).
Their reference `render.js` (pure derivation functions, no DOM) and `template.html` (12 static
demo states, no `<template>` blueprints) were ported into this folder's actual
`render(document, data)` + single reusable `.menu-page` skeleton, matching every other menu in
this app. Their `TIER_FONT_SIZES` / `shrinkTier` / `courseListMarginTop` / `mergeCourseDishes`
values are preserved exactly — see render.js.

## The 3 menus — structure (confirmed with client, then independently verified live)
No price is ever shown on the printed page for any menu — this is a fixed banquet menu, not an
a-la-carte priced one. Every dish is a name + optional description only.

- **San Gimignano** ($55 internal ref) — 3 course groups: Antipasto (1 dish) · Secondi Piatti,
  Choice of One (4 dishes) · Dolci (1 dish)
- **Firenze** ($75 internal ref) — 4 course groups: Antipasti, Family Style (1 dish) · Primi
  Piatti, Choice of One (2 dishes) · Secondi Piatti, Choice of One (5 dishes) · Dolci, Choice of
  One (1 dish)
- **Siena** ($85 internal ref) — 4 course groups: Antipasti, Family Style (2 dishes) · Primi
  Piatti, Choice of One (4 dishes) · Secondi Piatti, Choice of One (4 dishes) · Dolci, Choice of
  One (1 dish)

San Gimignano's Antipasto/Dolci sections intentionally have no "Family Style"/"Choice of One"
qualifier, unlike Firenze/Siena's equivalent sections — confirmed with the client to leave as-is
even though an alternate could add a 2nd dish there without an explicit choice/family-style
label. Not a bug.

**The menu label ("Firenze") and internalPriceRef ("$75") are for the STAFF picking a menu in
the editor only — confirmed with the client neither is ever rendered on the printed page.**

## Event fields are print-time-only, not part of a menu or alternate
`eventTitle`, `eventDate`, and `logoUrl` are entered fresh each time a menu is printed for a
specific event — they are NOT stored as part of a menu's default content or a saved alternate.
(The designer's original `menu-data.json` bundled a sample event onto each menu purely for their
own demo convenience; that's not carried into this app's schema — see `privatedining-schema.ts`.)

## 1. Alternates: a named library, not a single toggle
Each of the 3 menus supports an arbitrary number of saved, named alternates (e.g. "Vegetarian
Alt", "Holiday Alt" against the same Firenze menu). This is a one-to-many relationship
(menu → alternates[]), never a single fixed "the alternate." Alternates are stored completely
separately from the menu's default/draft/publish content — editing, adding, or deleting an
alternate never touches the live default menu.

- An alternate renders the same course/dish structure as its parent menu, plus whatever
  `extraItems` it carries (each item targets one course via `courseIndex`).
- **Cap: 2 extra items total per alternate, across all its courses combined** — not 2 per
  section. Enforce the cap in the Add Item control itself (disable once reached), not just
  visually — see `AlternateSchema` in `privatedining-schema.ts` (`.max(2, ...)`).

## 2. Two shrink tiers
Adding items steps the dish name and description type size down in two tiers, uniformly across
the whole menu (not per-section). Course-group spacing, rule weight, header, and footer stay
fixed at every tier.

| Tier | Trigger | Dish name (Playfair Display italic) | Dish description (Montserrat) |
|---|---|---|---|
| 0 (default) | 0 extra items | 20px | 14px |
| 1 | 1 extra item | 18px | 12.5px |
| 2 (cap) | 2 extra items | 16px | 11.5px |

Tier is decided purely by extra-item COUNT (render.js's `shrinkTier()`), never by a live fit
measurement. `validate.js` in this folder is a safety net, not a shrink-decider — see its header
comment for why one is still needed despite the tiers being deterministic.

### Page box is fixed
`.menu-page` is a fixed 8.5in x 11in box (`overflow: hidden`), never a `min-height` box. The
designer verified fit live against this real box (not eyeballed) and I independently
re-verified it by loading their handoff in a real browser and measuring the footer's bottom edge
directly:

| State | Headroom (measured) |
|---|---|
| San Gimignano, default | 467px |
| San Gimignano, 2 extra items | 455px |
| San Gimignano, 2 extra items + wrapped title (worst case) | 459px |
| Firenze, default | 257px |
| Firenze, 2 extra items | 258px |
| Firenze, 2 extra items + wrapped title (worst case) | 262px |
| Siena, default | 153px |
| Siena, 2 extra items | 171px |
| Siena, 2 extra items + wrapped title (worst case) | 175px |

All comfortably positive — no overflow risk from the tier system itself. The remaining risk is an
unusually long dish description, which `validate.js` catches at print/preview time.

## 3. Warning note — placement and copy
When an alternate has ≥1 extra item (tier 1 or 2), a short persistent note shows automatically
via CSS (`.menu-page[data-extra-count="1"] .alt-warning` / `[data-extra-count="2"]`):

> "Adding items shrinks the type to fit — 2 max."

No JS show/hide wiring needed — it's driven entirely by the `data-extra-count` attribute
render.js sets on `.menu-page`.

## 4. Event title overflow
The event title wraps within its existing width (not wider) instead of clipping. When it wraps
to 2 lines, `applyTitleWrapAdjustment()` in render.js measures the rendered title and toggles
`.title-wrapped` on `.menu-page`, which collapses the header-to-course-list spacing from 24px to
14px via CSS. This must run in a real browser (preview iframe or print window) — JSDOM cannot
measure real text wrapping, same constraint as `validate.js`.

## 5. Logo upload
The logo slot is fixed at 64x64px, inline with and to the left of the event title block, and
never changes size regardless of whether a logo is present. Upload/storage/cropping is entirely
a developer feature (see the editor UI and API routes) — when no logo is present, the slot is
simply empty; no placeholder graphic or dashed outline appears on the printed page (the dashed
outline some design mockups show is an editor-only affordance).

## Design tokens
- Colors: `#faf6ef` page bg · `#2a1408` dish name · `#4a2f14` dish desc · `#3a1a06` course label ·
  `#6b4c2a` event title · `#8a6a44` event date · `#c9a87a` rules/footer wordmark ·
  `#8a5a10` warning note
- Type: Playfair Display Italic (event title, dish names, self-hosted — see `fonts/`) ·
  Montserrat (everything else, Google Fonts CDN)
- Page box: fixed 8.5in x 11in (`overflow: hidden`), padding 40px 70px 22px
- Spacing: course-group divider 7px margin/padding · dish-to-dish gap 2px · course-label bottom
  margin 6px · course-list top margin 24px (14px when title wraps) · footer top margin 10px ·
  dish-desc max-width 560px, line-height 1.4

## Files in this package
- `template.html` — the real single-page template + `<template>` dish/course-group blueprints
- `render.js` — UMD module: `render(document, data)` + the designer's ported pure functions
- `validate.js` — safety-net fit check (footer-bottom-edge technique, no auto-shrink)
- `expected-render.html` — golden default-state render for `menu-data.json`'s seed content
- `menu-data.json` — seed data: 3 menus, course/dish structure, one sample alternate each, no
  prices, no event fields
- `snapshot-test.spec.js` — vitest snapshot + pure-logic tests
- `fonts/` — self-hosted Playfair Display (regular + italic variable fonts)
