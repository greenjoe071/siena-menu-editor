/**
 * Siena Drinks & Dessert Menu — Layout Validator.
 *
 * Constraint model: item counts and descriptions are OPEN-ENDED. There is
 * no hard per-field or per-section cap. Instead, every save runs through
 * this validator, which is the single source of truth for "does this
 * fit?" It measures each of the four `.page` cards independently (they
 * are four separate physical insert cards — one can overflow while its
 * neighbors have room).
 *
 * THE ONE-STEP SHRINK: if a page overflows at normal size, this validator
 * tries exactly ONE fallback — adding the `shrink-1pt` class to that page,
 * which drops every dynamic text run (item names, prices, descriptions —
 * never titles/chrome) by 1pt via CSS already baked into template.html.
 * If the page fits after that, report it as fitting (with `shrunk: true`
 * so the editor can show a subtle "reduced type" indicator). If it STILL
 * doesn't fit, block the save — there is no second shrink step and no
 * further ladder. The user must remove an item or shorten/remove a
 * description.
 *
 * Requires a REAL layout engine (browser, editor preview iframe, or
 * headless Chromium via Puppeteer/Playwright). JSDOM does not compute CSS
 * layout and cannot host this module — the snapshot test only exercises
 * render.js, never this file.
 *
 * Usage in the editor:
 *   SienaDrinksDessertRender.render(previewDoc, candidateData);
 *   await SienaDrinksDessertValidate.waitForLayout(previewDoc);
 *   const report = SienaDrinksDessertValidate.validate(previewDoc);
 *   if (!report.fits) showError(report);
 *
 * Report shape:
 *   {
 *     fits: false,
 *     pages: [
 *       { id: "cocktails", fits: true,  shrunk: false, overflowPx: 0,   worstList: null },
 *       { id: "spirits",   fits: false, shrunk: true,  overflowPx: 34,  worstList: "spirits-beer" },
 *       { id: "dopacena",  fits: true,  shrunk: false, overflowPx: 0,   worstList: null },
 *       { id: "dolci",     fits: true,  shrunk: false, overflowPx: 0,   worstList: null }
 *     ]
 *   }
 *
 * `worstList` is the `data-list-id` of the tallest list on an overflowing
 * page — use it to point the manager at the right subsection, e.g.
 * "Spirits doesn't fit — Bottled Beer is the largest section. Remove an
 * item or move it to another list."
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaDrinksDessertValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

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

  function validatePage(page) {
    const id = page.getAttribute('data-page-id');

    page.classList.remove('shrink-1pt');
    let m = measure(page);
    if (m.fits) return { id: id, fits: true, shrunk: false, overflowPx: 0, worstList: null };

    page.classList.add('shrink-1pt');
    m = measure(page);
    if (m.fits) return { id: id, fits: true, shrunk: true, overflowPx: 0, worstList: null };

    return { id: id, fits: false, shrunk: true, overflowPx: m.overflowPx, worstList: worstList(page) };
  }

  /**
   * @param {Document|Element} root - a Document or a container holding the
   *        rendered `.page` elements.
   */
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

  return { validate: validate, waitForLayout: waitForLayout, renderAndValidate: renderAndValidate };
});
