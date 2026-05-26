/**
 * Siena Tuesday/Wednesday Prix-Fixe — Layout Validator
 *
 * v2 replaces the v1 per-field character caps with a single layout
 * rule: **after any edit, the rendered page must still fit on
 * 8.5×11".** This module is the validator the editor calls to
 * enforce that rule.
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
 *        SienaTuewedRender.render(doc, candidateData);
 *   2. (Wait for fonts to load — see `waitForLayout` below.)
 *   3. Validate:
 *        const report = SienaTuewedValidate.validate(doc);
 *        if (!report.fits) showError(report);
 *
 * The validator returns a structured report so the editor can point
 * the user at the specific section that's pushing the page over budget:
 *
 *   {
 *     fits: false,
 *     overflowPx: 28,
 *     pageHeightPx: 1084,
 *     maxHeightPx: 1056,
 *     sections: {
 *       "hero": 132,
 *       "course-1": 108,
 *       "course-2": 162,         ← tallest
 *       "course-3": 124,
 *       "addon": 56,
 *       "weekly": 168,
 *       "footnotes": 22
 *     },
 *     worstSection: "course-2"
 *   }
 *
 * The editor can use `worstSection` to scroll the user there with
 * a message like: "Your edit makes Course II too tall — try
 * shortening the description."
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaTuewedValidate = factory();
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
   * Validate the rendered page fits on 8.5×11".
   *
   * The `.page` element is the only thing with a FIXED height (11in)
   * and `overflow: hidden`. Its content can exceed that height; when
   * it does, `page.scrollHeight > page.clientHeight`, and that is the
   * authoritative overflow signal.
   *
   * We also measure each `[data-section-id]` element's rendered height
   * for diagnostics, so the editor can tell the user WHICH section
   * is the biggest contributor to the overflow.
   *
   * @param {Document|Element} root - Document or container element
   *        that holds the rendered .page.
   * @returns {ValidationReport}
   */
  function validate(root) {
    if (!root) {
      return { fits: false, error: 'No root element', sections: {} };
    }
    const page = root.querySelector ? root.querySelector('.page') : null;
    if (!page) {
      return { fits: false, error: '.page not found', sections: {} };
    }

    // Authoritative overflow signal: page scrollHeight vs clientHeight.
    const overflowPx = Math.max(0, page.scrollHeight - page.clientHeight);
    const fits = overflowPx === 0;

    // Diagnostic: measure each tagged section's rendered height so we
    // can name the worst contributor when the page overflows.
    const sectionEls = root.querySelectorAll('[data-section-id]');
    const sections = {};
    let worstSection = null;
    let worstSectionH = 0;

    sectionEls.forEach((s) => {
      const id = s.getAttribute('data-section-id');
      const h = Math.round(s.getBoundingClientRect().height);
      sections[id] = h;
      // The hero, weekly footer, and footnotes are fully static — they
      // are not user-editable, so naming them as the "worst section"
      // gives the editor nothing useful to act on. Only consider
      // user-editable sections as candidates for `worstSection`.
      const isEditable = id === 'course-1' || id === 'course-2' || id === 'course-3' || id === 'addon';
      if (!fits && isEditable && h > worstSectionH) {
        worstSectionH = h;
        worstSection = id;
      }
    });

    return {
      fits,
      overflowPx,
      pageHeightPx: page.scrollHeight,
      maxHeightPx: page.clientHeight,
      sections,
      worstSection,
    };
  }

  /**
   * Convenience: render + validate in one call.
   *
   * Caller supplies the renderer (so this module doesn't depend on
   * `SienaTuewedRender` being globally available).
   *
   *   const report = await SienaTuewedValidate.renderAndValidate(
   *     iframe.contentDocument,
   *     candidateData,
   *     SienaTuewedRender.render
   *   );
   */
  function renderAndValidate(doc, data, renderFn) {
    if (typeof renderFn === 'function') renderFn(doc, data);
    return waitForLayout(doc).then(() => validate(doc));
  }

  return { validate, waitForLayout, renderAndValidate };
});
