/**
 * Siena Course Menu — Layout Validator (Pattern B, HARD BLOCK).
 *
 * After every edit the editor renders the candidate data into a live
 * preview iframe and calls validate(doc). If report.fits === false,
 * Save is disabled and report.issues explains why.
 *
 * Needs a real layout engine (browser / Playwright). JSDOM cannot run it.
 *
 * Rules checked:
 *   1. course-count  — 2 to 4 courses rendered.
 *   2. header-wrap   — header + price must sit on ONE line.
 *   3. desc-overflow — optional header description must fit on ONE line
 *                      (it is nowrap + overflow:hidden, so overflow = clipped text).
 *   4. page-overflow — whole page must fit 8.5×11 (.page scrollHeight).
 *
 * Report:
 *   { fits, overflowPx, courseCount, issues:[{code, section, message}],
 *     sections:{id:heightPx}, worstSection }
 * worstSection only ever names editable sections.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaCourseMenuValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EDITABLE = ['course-1', 'course-2', 'course-3', 'course-4', 'addon', 'description', 'footer'];
  var NUMERALS = ['I', 'II', 'III', 'IV'];

  function waitForLayout(doc) {
    if (doc && doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') {
      return doc.fonts.ready.then(function () { return undefined; });
    }
    return Promise.resolve();
  }

  function validate(root) {
    if (!root || !root.querySelector) return { fits: false, error: 'No root element', issues: [], sections: {} };
    var page = root.querySelector('.page');
    if (!page) return { fits: false, error: '.page not found', issues: [], sections: {} };
    var issues = [];

    var courseCount = root.querySelectorAll('.course-body[data-course-slot]').length;
    if (courseCount < 2 || courseCount > 4) {
      issues.push({ code: 'course-count', section: null, message: 'A menu needs 2 to 4 courses (currently ' + courseCount + ').' });
    }

    var head = root.querySelector('[data-text-id="header"]');
    var prices = root.querySelector('.hero-title .prices');
    if (head && prices) {
      var hr = head.getBoundingClientRect(), pr = prices.getBoundingClientRect();
      var lineH = parseFloat(getComputedStyle(head).fontSize) || 48;
      if (hr.height > lineH * 1.5 || pr.top > hr.top + hr.height / 2) {
        issues.push({ code: 'header-wrap', section: 'hero', message: 'The header is too long — it and the price must fit on one line.' });
      }
    }

    var desc = root.querySelector('[data-hero-desc]');
    if (desc && desc.scrollWidth > desc.clientWidth + 1) {
      issues.push({ code: 'desc-overflow', section: 'description', message: 'The description must fit on one line — shorten it.' });
    }

    var overflowPx = Math.max(0, page.scrollHeight - page.clientHeight);
    var sections = {}, worstSection = null, worstH = 0;
    var els = root.querySelectorAll('[data-section-id]');
    for (var i = 0; i < els.length; i++) {
      var id = els[i].getAttribute('data-section-id');
      var h = Math.round(els[i].getBoundingClientRect().height);
      sections[id] = h;
      if (overflowPx > 0 && EDITABLE.indexOf(id) !== -1 && h > worstH) { worstH = h; worstSection = id; }
    }
    if (overflowPx > 0) {
      var label = /^course-(\d)$/.test(worstSection || '') ? 'Course ' + NUMERALS[+worstSection.slice(-1) - 1] : (worstSection || 'the page');
      issues.push({ code: 'page-overflow', section: worstSection, message: 'The menu is ' + overflowPx + 'px too tall for the page — try shortening ' + label + '.' });
    }

    return {
      fits: issues.length === 0,
      overflowPx: overflowPx,
      pageHeightPx: page.scrollHeight,
      maxHeightPx: page.clientHeight,
      courseCount: courseCount,
      issues: issues,
      sections: sections,
      worstSection: worstSection
    };
  }

  function renderAndValidate(doc, data, renderFn) {
    if (typeof renderFn === 'function') renderFn(doc, data);
    return waitForLayout(doc).then(function () { return validate(doc); });
  }

  return { validate: validate, waitForLayout: waitForLayout, renderAndValidate: renderAndValidate };
});
