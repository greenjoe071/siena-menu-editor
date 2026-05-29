/**
 * Siena Weekend Specials — Auto-Fit Ladder ("settle")
 * ===================================================
 *
 * The Weekend menu has variable content: 1–4 starters, 1–4 entrees, an
 * optional dessert, plus long or short descriptions. Rather than block the
 * chef with rigid per-field caps, the page SELF-FITS: when the content would
 * run past the bottom of the 8.5×11 page, this helper sheds non-essential
 * chrome one step at a time until the page fits.
 *
 * Owner-approved ladder order (least painful first):
 *   1. v-eyebrow  — drop the "Chef's Suggestions" eyebrow
 *   2. v-days     — drop the "Thursday ◆ Friday ◆ Saturday" line
 *   3. v-tight    — tighten section / dish / footer spacing
 *   4. v-weekly   — drop the "Throughout the Week" footer  (last resort)
 *
 * The page is NEVER hard-blocked. The only configs that reach step 4 are the
 * dense ones (dessert on + both course sections at 3–4 dishes, or unusually
 * long descriptions at high counts). See BUILD-SPEC.md §"Constraint model".
 *
 * WHERE THIS RUNS:
 *   • The /preview iframe — call settle() after EVERY render() (debounced).
 *   • The /print page — call settle() before window.print().
 *   • This file also AUTO-RUNS once on load (after document.fonts.ready) if it
 *     finds a `.page`, so a statically-served page fits with no extra wiring.
 *
 * WHERE THIS DOES NOT RUN:
 *   • The snapshot test (JSDOM). JSDOM has no layout engine, so it can't
 *     measure overflow. expected-render.html is therefore the PRE-settle DOM
 *     (full content, no v-* classes). That is correct and intended.
 *
 * MEASUREMENT NOTE (important): measure overflow at the `.page` level
 * (`page.scrollHeight > page.clientHeight`). Do NOT measure `.menu-body` or a
 * column — with `flex: 1` those grow to fill and never report overflow.
 *
 * Usage (browser):
 *   SienaWeekendSettle.settle();              // finds the first .page
 *   SienaWeekendSettle.settle(pageEl);        // or pass a specific .page / root
 *   const report = SienaWeekendSettle.settle();
 *   // report = { applied: ['v-eyebrow','v-days'], fits: true }
 *   //        or { applied: [...all], fits: false, overflowPx: 37 }  (shouldn't happen in practice)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaWeekendSettle = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VALVES = ['v-eyebrow', 'v-days', 'v-tight', 'v-weekly'];

  function fits(page) {
    return page.scrollHeight <= page.clientHeight + 2;
  }

  function resolvePage(target) {
    if (target && target.classList && target.classList.contains('page')) return target;
    var doc =
      (target && target.querySelector && target) ||
      (target && target.ownerDocument) ||
      (typeof document !== 'undefined' ? document : null);
    return doc ? doc.querySelector('.page') : null;
  }

  /**
   * Apply the ladder to a page until it fits (or the ladder is exhausted).
   * Idempotent: clears any previously-applied valves first, so it's safe to
   * call repeatedly as the editor re-renders.
   */
  function settle(target) {
    var page = resolvePage(target);
    if (!page) return null;

    // Reset — start from the full layout every time.
    VALVES.forEach(function (v) { page.classList.remove(v); });
    if (fits(page)) return { applied: [], fits: true };

    var applied = [];
    for (var i = 0; i < VALVES.length; i++) {
      page.classList.add(VALVES[i]);
      applied.push(VALVES[i]);
      if (fits(page)) return { applied: applied, fits: true };
    }
    // Exhausted the ladder and still overflowing. With realistic content this
    // does not occur; if it does, the editor can surface a soft warning.
    return {
      applied: applied,
      fits: false,
      overflowPx: Math.round(page.scrollHeight - page.clientHeight)
    };
  }

  function autorun() {
    if (typeof document === 'undefined') return;
    var run = function () { setTimeout(function () { settle(); }, 60); };
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(run);
    } else if (document.readyState === 'complete') {
      run();
    } else {
      window.addEventListener('load', run);
    }
  }

  autorun();

  return { settle: settle, VALVES: VALVES };
});
