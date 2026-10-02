/**
 * Siena Weekend Specials — Auto-Fit Ladder ("settle") — v2
 * ========================================================
 *
 * When the content would run past the bottom of the 8.5×11 page, this helper
 * sheds non-essential chrome one step at a time until the page fits.
 *
 * v2 ladder order (owner-approved Oct 2026 — CHANGED from v1):
 *   1. v-days     — drop the "Thursday ◆ Friday ◆ Saturday" line
 *   2. v-tight    — tighten section / dish spacing
 *   3. v-eyebrow  — drop the "Weekend Specials" eyebrow
 *   4. v-weekly   — drop the weekly specials footer (last resort)
 *
 * The eyebrow moved from first-to-go to third because it now reads
 * "Weekend Specials" and carries real meaning.
 *
 * The page is NEVER hard-blocked. If even step 4 doesn't fit (only possible
 * with the 4+4+dessert maximum AND long descriptions), settle() returns
 * fits:false and the editor should show a SOFT warning ("shorten a
 * description or remove a dish") — not block save.
 *
 * WHERE THIS RUNS:
 *   • The preview iframe — call settle() after EVERY render() (debounced).
 *   • The /print page — call settle() before window.print().
 *   • Auto-runs once on load (after document.fonts.ready) if it finds a .page.
 *
 * NOT in the snapshot test — JSDOM has no layout engine. expected-render.html
 * is the PRE-settle DOM (no v-* classes). That is correct.
 *
 * MEASURE AT .page (scrollHeight > clientHeight). Never .menu-body — it is
 * flex:1 and grows to fill, so it never reports overflow.
 *
 * Usage:
 *   SienaWeekendSettle.settle();          // first .page in document
 *   SienaWeekendSettle.settle(pageEl);    // or a specific .page / root
 *   // → { applied: ['v-days'], fits: true }
 *   // → { applied: [...all], fits: false, overflowPx: 37 }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaWeekendSettle = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VALVES = ['v-days', 'v-tight', 'v-eyebrow', 'v-weekly'];

  function fits(page) { return page.scrollHeight <= page.clientHeight + 2; }

  function resolvePage(target) {
    if (target && target.classList && target.classList.contains('page')) return target;
    var doc =
      (target && target.querySelector && target) ||
      (target && target.ownerDocument) ||
      (typeof document !== 'undefined' ? document : null);
    return doc ? doc.querySelector('.page') : null;
  }

  /** Idempotent: clears previously-applied valves first. */
  function settle(target) {
    var page = resolvePage(target);
    if (!page) return null;
    VALVES.forEach(function (v) { page.classList.remove(v); });
    if (fits(page)) return { applied: [], fits: true };
    var applied = [];
    for (var i = 0; i < VALVES.length; i++) {
      page.classList.add(VALVES[i]);
      applied.push(VALVES[i]);
      if (fits(page)) return { applied: applied, fits: true };
    }
    return { applied: applied, fits: false, overflowPx: Math.round(page.scrollHeight - page.clientHeight) };
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
