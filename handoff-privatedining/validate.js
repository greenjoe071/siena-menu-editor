/**
 * Siena Private Dining Menu — Layout Validator.
 *
 * Unlike Happy Hour / Drinks & Dessert, the shrink tier here is NOT decided
 * by this validator — it's decided purely by extra-item count (0/1/2), a
 * deterministic rule enforced in render.js/the editor's Add Item cap. The
 * designer's own live measurements showed generous headroom (150px+) at
 * every tier for all 3 menus, even in the worst case (2 extra items + a
 * wrapped 2-line title) — see BUILD-SPEC.md.
 *
 * This validator exists as a SAFETY NET, not a shrink-decider: dish
 * descriptions are free text a manager can edit to any length, which the
 * fixed 2-tier system was never designed to absorb. If a description (or
 * a long course label) genuinely overflows the fixed page, there is no
 * further shrink step to fall back to — report it and let the editor block
 * the save with a "shorten a description" message, the same way Drinks &
 * Dessert blocks when its one-step shrink still isn't enough.
 *
 * Measures the FOOTER'S bottom edge, not `.menu-page`'s scrollHeight —
 * `.menu-page` uses `overflow: hidden`, and scrollHeight is spec'd to never
 * report less than clientHeight, so it can silently read "fits" even when
 * content is shorter OR exactly at the limit. Confirmed while independently
 * verifying the designer's own handoff (they used the same footer-edge
 * technique in their Playwright spec for the same reason).
 *
 * Requires a REAL layout engine (browser, preview iframe, or print window).
 * JSDOM cannot host this — same constraint as every other layout-budget
 * menu in this app.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaPrivateDiningValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function waitForLayout(doc) {
    if (doc && doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') {
      return doc.fonts.ready.then(function () { return undefined; });
    }
    return Promise.resolve();
  }

  function measure(page) {
    var pageTop = page.getBoundingClientRect().top;
    var footer = page.querySelector('.menu-footer');
    var contentBottom = footer.getBoundingClientRect().bottom - pageTop;
    var boxHeight = page.getBoundingClientRect().height;
    return {
      fits: contentBottom <= boxHeight + 1,
      overflowPx: Math.max(0, Math.round(contentBottom - boxHeight))
    };
  }

  /**
   * @param {Document|Element} root - a Document or a container holding the rendered `.menu-page`.
   */
  function validate(root) {
    if (!root) return { fits: false, error: 'No root element', pages: [] };
    var scope = root.querySelectorAll ? root : (root.ownerDocument || null);
    if (!scope) return { fits: false, error: 'Root has no querySelectorAll', pages: [] };
    var page = scope.querySelector('.menu-page');
    if (!page) return { fits: false, error: '.menu-page not found', pages: [] };

    var m = measure(page);
    return {
      fits: m.fits,
      overflowPx: m.overflowPx,
      tier: page.dataset.tier,
      titleWrapped: page.classList.contains('title-wrapped')
    };
  }

  return { validate: validate, waitForLayout: waitForLayout };
});
