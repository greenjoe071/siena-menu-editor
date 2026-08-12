/**
 * Siena Dessert Menu — Layout Validator.
 *
 * Constraint model: every list is OPEN-ENDED. This validator measures
 * the Dolci and Dopa Cena `.page` cards INDEPENDENTLY — they are two
 * different physical cards sharing one sheet, not two identical copies
 * (an earlier version of this package used a "measure one, trust both"
 * shortcut; that no longer applies).
 *
 * TWO INDEPENDENT CHECKS PER PAGE, same model as
 * ../handoff-drinksdessert/validate.js:
 *   1. "Fits the card" — normal bottom-of-11in-card overflow. Applies to
 *      BOTH pages.
 *   2. "Clears the holder crop line" (`cropLineOk`) — the physical menu
 *      holder (shared with the Drinks Menu's 4 cards) hides everything
 *      below 9.96in from the top of ANY card. Fixed hardware constant —
 *      see ../handoff-drinksdessert/template.html's "PHYSICAL PRODUCT"
 *      comment for the full rationale. Keep this constant in sync with
 *      that file if it's ever revised; don't let the two drift apart.
 *
 *      ⚠️ EXCEPTION (confirmed with the owner, Aug 2026): this check does
 *      NOT gate `fits` for the "dolci" page. Dolci's affogato illustration
 *      is deliberately pinned to the bottom of the card and always lands
 *      past 9.96in, regardless of list content — that's inherent to the
 *      layout (see template.html's `.dolci-image` comment), not overflow.
 *      The owner confirmed against the physical holder that its corner
 *      grip doesn't reach that spot on this insert, unlike the Drinks
 *      Menu cards. `cropLineOk`/`contentBottomIn` are still measured and
 *      reported for "dolci" (diagnostic only) — see `checkBoth()`.
 *
 * THE ONE-STEP SHRINK: if a page fails either check at normal size, this
 * validator adds `shrink-1pt` to THAT page only and re-checks both. If
 * it now passes, report `shrunk: true`. If it still fails, block the
 * save — no second shrink step. The Dolci illustration is a fixed-size
 * static asset and is unaffected by the shrink class.
 *
 * Requires a REAL layout engine (browser, editor preview iframe, or
 * headless Chromium via Puppeteer/Playwright). JSDOM does not compute CSS
 * layout and cannot host this module — the snapshot test only exercises
 * render.js, never this file.
 *
 * Usage in the editor:
 *   SienaDessertRender.render(previewDoc, candidateData);
 *   await SienaDessertValidate.waitForLayout(previewDoc);
 *   const report = SienaDessertValidate.validate(previewDoc);
 *   if (!report.fits) showError(report);
 *
 * Report shape (same shape as ../handoff-drinksdessert/validate.js):
 *   {
 *     fits: false,
 *     pages: [
 *       { id: "dolci",     fits: true,  shrunk: false, overflowPx: 0,  cropLineOk: true,  contentBottomIn: 8.4, worstList: null },
 *       { id: "dopacena",  fits: false, shrunk: true,  overflowPx: 12, cropLineOk: true,   contentBottomIn: 10.0, worstList: "dopacena-grappa" }
 *     ]
 *   }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaDessertValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Must match ../handoff-drinksdessert/validate.js's CROP_LINE_IN — same
  // physical holder, same constant. Do not derive this from either
  // card's current content.
  var CROP_LINE_IN = 9.96;
  var PX_PER_IN = 96;

  function waitForLayout(doc) {
    if (doc && doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') {
      return doc.fonts.ready.then(function () { return undefined; });
    }
    return Promise.resolve();
  }

  function measure(page) {
    return {
      fits: page.scrollHeight <= page.clientHeight + 1,
      overflowPx: Math.max(0, Math.round(page.scrollHeight - page.clientHeight))
    };
  }

  function contentBottomIn(page) {
    const top = page.getBoundingClientRect().top;
    let maxBottom = top;
    const all = page.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      const r = all[i].getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.bottom > maxBottom) maxBottom = r.bottom;
    }
    return (maxBottom - top) / PX_PER_IN;
  }

  function worstList(page) {
    const lists = page.querySelectorAll('[data-list-id]');
    let worstId = null;
    let worstH = 0;
    lists.forEach(function (l) {
      const h = l.getBoundingClientRect().height;
      if (h > worstH) {
        worstH = h;
        worstId = l.getAttribute('data-list-id');
      }
    });
    return worstId;
  }

  // Dolci's affogato illustration is deliberately pinned to the bottom of
  // the card (flex-pushed against the bottom padding), which puts its
  // bottom edge past CROP_LINE_IN on every render regardless of list
  // content — that's a structural property of the layout, not overflow.
  // Confirmed against the physical holder (Aug 2026): the corner grip on
  // this side of the Dessert insert does NOT reach that spot, unlike the
  // Drinks Menu cards. So the crop line does not gate `fits` for "dolci" —
  // only the ordinary bottom-of-11in-card overflow check applies there.
  // Dopa Cena (dense text, no pinned illustration) keeps both checks.
  function checkBoth(page, id) {
    const m = measure(page);
    const bottomIn = contentBottomIn(page);
    const cropLineOk = bottomIn <= CROP_LINE_IN + 0.02;
    const cropLineApplies = id !== 'dolci';
    return { fits: m.fits && (cropLineOk || !cropLineApplies), overflowPx: m.overflowPx, cropLineOk: cropLineOk, contentBottomIn: Math.round(bottomIn * 100) / 100 };
  }

  function validatePage(page) {
    const id = page.getAttribute('data-page-id');

    page.classList.remove('shrink-1pt');
    let r = checkBoth(page, id);
    if (r.fits) return { id: id, fits: true, shrunk: false, overflowPx: 0, cropLineOk: r.cropLineOk, contentBottomIn: r.contentBottomIn, worstList: null };

    page.classList.add('shrink-1pt');
    r = checkBoth(page, id);
    if (r.fits) return { id: id, fits: true, shrunk: true, overflowPx: 0, cropLineOk: r.cropLineOk, contentBottomIn: r.contentBottomIn, worstList: null };

    return { id: id, fits: false, shrunk: true, overflowPx: r.overflowPx, cropLineOk: r.cropLineOk, contentBottomIn: r.contentBottomIn, worstList: worstList(page) };
  }

  function validate(root) {
    if (!root) return { fits: false, error: 'No root element', pages: [] };
    const scope = root.querySelectorAll ? root : (root.ownerDocument || null);
    if (!scope) return { fits: false, error: 'Root has no querySelectorAll', pages: [] };
    const pageEls = scope.querySelectorAll('.page');
    if (!pageEls.length) return { fits: false, error: '.page elements not found', pages: [] };

    const pages = Array.from(pageEls).map(validatePage);
    return { fits: pages.every(function (p) { return p.fits; }), pages: pages };
  }

  function renderAndValidate(doc, data, renderFn) {
    if (typeof renderFn === 'function') renderFn(doc, data);
    return waitForLayout(doc).then(function () { return validate(doc); });
  }

  return { validate: validate, waitForLayout: waitForLayout, renderAndValidate: renderAndValidate, CROP_LINE_IN: CROP_LINE_IN };
});
