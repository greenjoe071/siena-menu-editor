/**
 * Siena Desserts Menu — Layout Validator.
 *
 * Constraint model: the item list is OPEN-ENDED, no hard cap. The card
 * prints two-up (two identical copies, data-copy-id="1"/"2") — since
 * render.js always writes the exact same data into both, they are always
 * the same size, so this validator measures ONLY the primary copy
 * (data-copy-id="1"). Checking one proves both; measuring both would be
 * redundant work.
 *
 * THE ONE-STEP SHRINK: if the primary copy overflows at normal size,
 * this validator tries exactly ONE fallback — adding the `shrink-1pt`
 * class to BOTH data-page-id="dessert" elements together (so the two
 * printed copies never visually disagree), which drops item name/price/
 * description by exactly 1pt via CSS already baked into template.html.
 * If it fits after that, report it as fitting (`shrunk: true`, for a
 * subtle "reduced type" indicator). If it still doesn't fit, block the
 * save — there is no second shrink step and no further ladder.
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
 * Report shape (same shape as ../handoff-drinksdessert/validate.js, one
 * entry since there's only one card):
 *   {
 *     fits: false,
 *     pages: [
 *       { id: "dessert", fits: false, shrunk: true, overflowPx: 22, worstList: "dessert-1" }
 *     ]
 *   }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaDessertValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function waitForLayout(doc) {
    if (doc && doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') {
      return doc.fonts.ready.then(function () { return undefined; });
    }
    return Promise.resolve();
  }

  function measure(el) {
    return {
      fits: el.scrollHeight <= el.clientHeight + 1,
      overflowPx: Math.max(0, Math.round(el.scrollHeight - el.clientHeight))
    };
  }

  // Applies/removes shrink-1pt on BOTH printed copies together — they must
  // never disagree, since they're always the same data at the same size.
  function setShrink(doc, on) {
    doc.querySelectorAll('.page[data-page-id="dessert"]').forEach(function (p) {
      p.classList.toggle('shrink-1pt', on);
    });
  }

  function validate(root) {
    if (!root) return { fits: false, error: 'No root element', pages: [] };
    const scope = root.querySelectorAll ? root : (root.ownerDocument || null);
    if (!scope) return { fits: false, error: 'Root has no querySelectorAll', pages: [] };
    const primary = scope.querySelector('.page[data-copy-id="1"]');
    if (!primary) return { fits: false, error: '.page[data-copy-id="1"] not found', pages: [] };
    const doc = scope.nodeType === 9 ? scope : scope.ownerDocument;

    setShrink(doc, false);
    let m = measure(primary);
    if (m.fits) return { fits: true, pages: [{ id: 'dessert', fits: true, shrunk: false, overflowPx: 0, worstList: null }] };

    setShrink(doc, true);
    m = measure(primary);
    if (m.fits) return { fits: true, pages: [{ id: 'dessert', fits: true, shrunk: true, overflowPx: 0, worstList: null }] };

    return { fits: false, pages: [{ id: 'dessert', fits: false, shrunk: true, overflowPx: m.overflowPx, worstList: 'dessert-1' }] };
  }

  function renderAndValidate(doc, data, renderFn) {
    if (typeof renderFn === 'function') renderFn(doc, data);
    return waitForLayout(doc).then(function () { return validate(doc); });
  }

  return { validate: validate, waitForLayout: waitForLayout, renderAndValidate: renderAndValidate };
});
