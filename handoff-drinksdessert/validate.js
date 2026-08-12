/**
 * Siena Drinks Menu — Layout Validator.
 *
 * Constraint model: Cocktails, Spirits & Beer, and Spritz item counts and
 * descriptions are OPEN-ENDED — no hard per-field or per-section cap.
 * Liquori is curated by hand instead (see BUILD-SPEC.md §1c) but is
 * still measured here like any other card. Every save runs through this
 * validator, which is the single source of truth for "does this fit?"
 * It measures each of the four `.page` cards independently (they are
 * four separate physical insert cards — one can overflow while its
 * neighbors have room). Dolci is not part of this package.
 *
 * TWO INDEPENDENT CHECKS PER PAGE:
 *   1. "Fits the card" — normal bottom-of-11in-card overflow, same model
 *      as always. See "THE ONE-STEP SHRINK" below.
 *   2. "Clears the holder crop line" (`cropLineOk`) — a NEW, stricter
 *      check. The physical menu holder hides everything below 9.96in
 *      from the top of any card, a fixed hardware constant (see
 *      template.html's "PHYSICAL PRODUCT" comment and BUILD-SPEC.md
 *      §1b). A page can pass check 1 (it doesn't overflow the 11in card)
 *      and still fail check 2 (its last line sits in the hidden zone).
 *      The 1pt shrink step is applied for BOTH checks together — shrink
 *      once, then re-check both; there's still only one shrink step.
 *
 * SPRITZ MENU NOTE: the spritz `.page` has two swappable designs, but
 * only ONE renders into the DOM's layout at a time (the other's content
 * is `display:none` via the `spritz-design-b` body class — see
 * render.js). This validator always measures whichever design is
 * currently active. To check the OTHER design's fit, call `render()`
 * again with the other design forced (`opts.spritzDesign`), then re-run
 * `validate()` — don't try to measure both at once in one DOM, since the
 * hidden one reports a false "fits" (0-height).
 *
 * THE ONE-STEP SHRINK: if a page fails check 1 or check 2 at normal size,
 * this validator tries exactly ONE fallback — adding the `shrink-1pt`
 * class to that page, which drops every dynamic text run (item names,
 * prices, descriptions — never titles/chrome) by 1pt via CSS already
 * baked into template.html. If the page passes both checks after that,
 * report it as fitting (with `shrunk: true` so the editor can show a
 * subtle "reduced type" indicator). If it STILL fails either check,
 * block the save — there is no second shrink step and no further ladder.
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
 *       { id: "cocktails", fits: true,  shrunk: false, overflowPx: 0,  cropLineOk: true,  contentBottomIn: 9.72, worstList: null },
 *       { id: "spirits",   fits: false, shrunk: true,  overflowPx: 34, cropLineOk: false, contentBottomIn: 10.1, worstList: "spirits-beer" },
 *       { id: "spritz",    fits: true,  shrunk: false, overflowPx: 0,  cropLineOk: true,  contentBottomIn: 8.9,  worstList: null },
 *       { id: "liquori",   fits: true,  shrunk: false, overflowPx: 0,  cropLineOk: true,  contentBottomIn: 9.94, worstList: null }
 *     ]
 *   }
 *
 * A page's `fits` is only true when BOTH the bottom-of-card check and
 * `cropLineOk` pass. `worstList` is the `data-list-id` of the tallest
 * list on a failing page — use it to point the manager at the right
 * subsection, e.g. "Spirits doesn't fit — Bottled Beer is the largest
 * section. Remove an item or move it to another list."
 *
 * SPRITZ TAGLINE (NOT part of this handoff's contract — see render.js's
 * file header): the Spritz page also fails if its owner-editable tagline
 * wraps to a second line, regardless of the other two checks. When that's
 * the failure, `worstList` is the literal string `"spritz-tagline"` rather
 * than a `data-list-id`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaDrinksDessertValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Fixed hardware constant — see template.html's "PHYSICAL PRODUCT"
  // comment and BUILD-SPEC.md §1b. Do NOT derive this from any card's
  // current content; it does not move if Cocktails' copy changes.
  var CROP_LINE_IN = 9.96;
  var PX_PER_IN = 96; // CSS "in" is always 96px/in, independent of screen DPI.

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

  // Distance from the page's top edge to the bottom-most VISIBLE pixel of
  // content inside it, ignoring collapsed/display:none elements (e.g. the
  // inactive Spritz design) AND elements marked [data-decorative] (e.g.
  // the Spritz card's static bottom illustration) — a decorative image is
  // exempt from the holder crop line on purpose; it doesn't carry text a
  // guest needs to read, so it's fine if it sits partly in the hidden
  // zone. See template.html's ".spritz-image" and BUILD-SPEC.md §1a/§5.
  // This is independent of overflow: a page can be well within its 11in
  // height and still cross the crop line.
  function contentBottomIn(page) {
    const top = page.getBoundingClientRect().top;
    let maxBottom = top;
    const all = page.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i].hasAttribute && all[i].hasAttribute('data-decorative')) continue;
      const r = all[i].getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.bottom > maxBottom) maxBottom = r.bottom;
    }
    return (maxBottom - top) / PX_PER_IN;
  }

  // Spritz tagline is owner-editable free text but the design requires it
  // stay on one line — its font is never touched by shrink-1pt (see
  // template.html), so if it's wrapped at normal size it's wrapped, period.
  // Not part of this handoff's contract; added per owner request (see
  // render.js's file header) — compares rendered height against its own
  // line-height rather than guessing a character count, since letter
  // widths vary too much for a static cap to be reliable.
  function isTaglineWrapped(page) {
    const el = page.querySelector('.spritz-tagline');
    if (!el) return false;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 0;
    if (!lineHeight) return false;
    return el.getBoundingClientRect().height > lineHeight * 1.4;
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

  // validate() always measures the print/preview state, never any
  // transient editor-only tightening class a future page might add — see
  // BUILD-SPEC.md §8 for the pattern (Dopa Cena used to do this; no
  // current page does, but keep this hook if one is reintroduced).
  function withEditingSuspended(doc, fn) {
    const body = doc && doc.body;
    const wasEditing = !!(body && body.classList && body.classList.contains('is-editing'));
    if (wasEditing) body.classList.remove('is-editing');
    try {
      return fn();
    } finally {
      if (wasEditing) body.classList.add('is-editing');
    }
  }

  function checkBoth(page) {
    const m = measure(page);
    const bottomIn = contentBottomIn(page);
    const cropLineOk = bottomIn <= CROP_LINE_IN + 0.02; // small float-rounding epsilon
    return { fits: m.fits && cropLineOk, overflowPx: m.overflowPx, cropLineOk: cropLineOk, contentBottomIn: Math.round(bottomIn * 100) / 100 };
  }

  function validatePage(page) {
    const id = page.getAttribute('data-page-id');
    // Tagline never shrinks (see isTaglineWrapped comment) — computed once,
    // outside the shrink loop, same as the fixed cropLine check.
    const tagWrapped = id === 'spritz' && isTaglineWrapped(page);

    page.classList.remove('shrink-1pt');
    let r = checkBoth(page);
    if (r.fits && !tagWrapped) return { id: id, fits: true, shrunk: false, overflowPx: 0, cropLineOk: true, contentBottomIn: r.contentBottomIn, worstList: null };

    page.classList.add('shrink-1pt');
    r = checkBoth(page);
    if (r.fits && !tagWrapped) return { id: id, fits: true, shrunk: true, overflowPx: 0, cropLineOk: true, contentBottomIn: r.contentBottomIn, worstList: null };

    return { id: id, fits: false, shrunk: true, overflowPx: r.overflowPx, cropLineOk: r.cropLineOk, contentBottomIn: r.contentBottomIn, worstList: tagWrapped ? 'spritz-tagline' : worstList(page) };
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

    const doc = scope.nodeType === 9 ? scope : scope.ownerDocument;
    const pages = withEditingSuspended(doc, function () {
      return Array.from(pageEls).map(validatePage);
    });
    return { fits: pages.every(function (p) { return p.fits; }), pages: pages };
  }

  function renderAndValidate(doc, data, renderFn) {
    if (typeof renderFn === 'function') renderFn(doc, data);
    return waitForLayout(doc).then(function () { return validate(doc); });
  }

  return { validate: validate, waitForLayout: waitForLayout, renderAndValidate: renderAndValidate, CROP_LINE_IN: CROP_LINE_IN };
});
