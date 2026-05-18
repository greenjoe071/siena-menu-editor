/**
 * Siena Happy Hour — Layout Validator
 *
 * The v2 handoff replaces v1's per-field character caps with a single
 * layout rule: **after any edit, the rendered page must still fit on
 * 8.5×14".** This module is the validator the editor calls to enforce
 * that rule.
 *
 * It runs in a real DOM (a browser, an editor preview iframe, or a
 * headless browser like Puppeteer/Playwright). JSDOM does NOT compute
 * CSS layout, so JSDOM cannot host this validator — you need a real
 * rendering engine.
 *
 * Usage in the editor:
 *
 *   1. Render the template against the candidate edit:
 *        const doc = previewIframe.contentDocument;
 *        SienaHappyhourRender.render(doc, candidateData);
 *   2. (Wait for fonts to load — see `waitForLayout` below.)
 *   3. Validate:
 *        const report = SienaHappyhourValidate.validate(doc);
 *        if (!report.fits) showError(report);
 *
 * The validator returns a structured report so the editor can point
 * the user at the specific column / section that's pushing the page
 * over budget.
 *
 *   {
 *     fits: false,
 *     columns: [
 *       { index: 0, overflowPx: 24, sections: { "small-plates": 612, "wines": 188 } },
 *       { index: 1, overflowPx: 0,  sections: { "cocktails": 580,    "beers": 200 } }
 *     ],
 *     worstColumn: 0,
 *     worstSection: "small-plates"
 *   }
 *
 * The editor can use `worstSection` to scroll the user there with
 * a message like: "Your edit makes Small Plates too tall — try
 * shortening a description."
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaHappyhourValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Wait for fonts to load before measuring. Variable fonts can shift
   * line heights significantly when they swap in — measuring before
   * fonts are ready gives unreliable results.
   *
   * Returns a Promise. Callers can `await` it before validate().
   */
  function waitForLayout(doc) {
    if (doc && doc.fonts && typeof doc.fonts.ready?.then === 'function') {
      return doc.fonts.ready.then(() => undefined);
    }
    return Promise.resolve();
  }

  /**
   * Validate the rendered page fits on 8.5×14".
   *
   * The `.page` element is the only thing with a FIXED height (14in)
   * and `overflow: hidden`. Its content can exceed that height; when
   * it does, `page.scrollHeight > page.clientHeight`, and that is the
   * authoritative overflow signal.
   *
   * We also measure each `[data-section-id]` element's rendered height
   * for diagnostics, so the editor can tell the user WHICH section
   * is the biggest contributor to the overflow.
   *
   * (Earlier versions of this function measured at the `.col` level.
   * That was wrong: `.col` has no fixed height, so it grows with its
   * content and `scrollHeight === clientHeight` always. Use `.page`.)
   *
   * @param {Document|Element} root - Document or a container element
   *        that holds the rendered .page.
   * @returns {ValidationReport}
   */
  function validate(root) {
    if (!root) {
      return { fits: false, error: 'No root element', columns: [] };
    }
    const page = root.querySelector ? root.querySelector('.page') : null;
    if (!page) {
      return { fits: false, error: '.page not found', columns: [] };
    }

    // Authoritative overflow signal: page scrollHeight vs clientHeight.
    const overflowPx = Math.max(0, page.scrollHeight - page.clientHeight);
    const fits = overflowPx === 0;

    // Diagnostic: measure each column's sections so we can name the
    // worst contributor.
    const cols = root.querySelectorAll('.body-grid > .col');
    const columns = [];
    let worstColumn = -1;
    let worstSection = null;
    let worstSectionH = 0;
    let worstColumnTotal = 0;

    cols.forEach((col, index) => {
      const sectionEls = col.querySelectorAll('[data-section-id]');
      const sections = {};
      let colSectionTotal = 0;
      sectionEls.forEach((s) => {
        const id = s.getAttribute('data-section-id');
        const h = Math.round(s.getBoundingClientRect().height);
        sections[id] = h;
        colSectionTotal += h;
        if (!fits && h > worstSectionH) {
          worstSectionH = h;
          worstSection = id;
        }
      });
      columns.push({ index, sections });
      if (!fits && colSectionTotal > worstColumnTotal) {
        worstColumnTotal = colSectionTotal;
        worstColumn = index;
      }
    });

    return {
      fits,
      overflowPx,
      pageHeightPx: page.scrollHeight,
      maxHeightPx: page.clientHeight,
      columns,
      worstColumn,
      worstSection,
    };
  }

  /**
   * Convenience: render + validate in one call.
   *
   * Caller supplies the renderer (so this module doesn't depend on
   * `SienaHappyhourRender` being globally available).
   *
   *   const report = await SienaHappyhourValidate.renderAndValidate(
   *     iframe.contentDocument,
   *     candidateData,
   *     SienaHappyhourRender.render
   *   );
   */
  function renderAndValidate(doc, data, renderFn) {
    if (typeof renderFn === 'function') renderFn(doc, data);
    return waitForLayout(doc).then(() => validate(doc));
  }

  return { validate, waitForLayout, renderAndValidate };
});
