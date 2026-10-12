/**
 * Siena Tuesday/Wednesday Menu — Layout Validator (v3)
 *
 * Severity: HARD BLOCK. If report.fits === false the editor disables Save.
 *
 * Checks (in a REAL rendering engine — browser / preview iframe /
 * Puppeteer. JSDOM has no layout engine and cannot host this):
 *
 *   1. page-overflow — the page's natural content height (measured with
 *      .page set to height:auto, NOT scrollHeight: the flex:1 body and
 *      space-evenly gaps would hide overflow) must be ≤ 11in minus a 6pt
 *      safety margin.
 *   2. label-overflow — the "Tuesdays Only" label sits on the box's top
 *      border on ONE line (white-space:nowrap). It must be narrower than
 *      the box minus 40pt so it never runs into the corners.
 *
 * Report:
 *   {
 *     fits: false,
 *     problems: [{ code: 'page-overflow', overflowPx: 28 },
 *                { code: 'label-overflow', section: 'special' }],
 *     overflowPx: 28, naturalHeightPx: 1078, maxHeightPx: 1050,
 *     sections: { special: 140, header: 98, 'course-1': 82, …, 'week-4': 70 },
 *     worstSection: 'course-2'     // tallest EDITABLE section, or null
 *   }
 *
 * worstSection only ever names editable sections: special, course-1..3,
 * addon, week-1..4. The "header" (title + Chef's Three-Course line) is
 * not a candidate — the only editable thing in it is the price digits.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaTuewedValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PX_PER_IN = 96;
  const PX_PER_PT = 96 / 72;
  const SAFETY_PX = 6 * PX_PER_PT;
  const EDITABLE = ['special', 'course-1', 'course-2', 'course-3', 'addon', 'week-1', 'week-2', 'week-3', 'week-4'];

  function waitForLayout(doc) {
    if (doc && doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') {
      return doc.fonts.ready.then(() => undefined);
    }
    return Promise.resolve();
  }

  function validate(root) {
    if (!root) return { fits: false, error: 'No root element', problems: [], sections: {} };
    const page = root.querySelector ? root.querySelector('.page') : null;
    if (!page) return { fits: false, error: '.page not found', problems: [], sections: {} };

    const problems = [];

    // 1. Page fit — measure natural height.
    const prevH = page.style.height;
    page.style.height = 'auto';
    const naturalHeightPx = page.getBoundingClientRect().height;
    page.style.height = prevH;
    const maxHeightPx = 11 * PX_PER_IN - SAFETY_PX;
    const overflowPx = Math.max(0, Math.ceil(naturalHeightPx - maxHeightPx));
    if (overflowPx > 0) problems.push({ code: 'page-overflow', overflowPx });

    // 2. Label must fit on the top border.
    const box = root.querySelector('[data-section-id="special"]');
    const label = root.querySelector('[data-text-id="special-label"]');
    if (box && label) {
      const room = box.getBoundingClientRect().width - 40 * PX_PER_PT;
      if (label.getBoundingClientRect().width > room) problems.push({ code: 'label-overflow', section: 'special' });
    }

    // Diagnostics (measured at the real fixed page height).
    const sections = {};
    let worstSection = null, worstH = 0;
    root.querySelectorAll('[data-section-id]').forEach((el) => {
      const id = el.getAttribute('data-section-id');
      const h = Math.round(el.getBoundingClientRect().height);
      sections[id] = h;
      if (overflowPx > 0 && EDITABLE.indexOf(id) !== -1 && h > worstH) { worstH = h; worstSection = id; }
    });

    return {
      fits: problems.length === 0,
      problems,
      overflowPx,
      naturalHeightPx: Math.round(naturalHeightPx),
      maxHeightPx: Math.round(maxHeightPx),
      sections,
      worstSection,
    };
  }

  function renderAndValidate(doc, data, renderFn) {
    if (typeof renderFn === 'function') renderFn(doc, data);
    return waitForLayout(doc).then(() => validate(doc));
  }

  return { validate, waitForLayout, renderAndValidate };
});
