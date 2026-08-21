/**
 * SienaARWValidate — line-count + page-fit validator for the ARW menu.
 * SienaARWValidate.validate(documentOrRoot) -> report
 * Call after SienaARWRender.render() and after fonts are ready (see
 * waitForLayout). Requires a real browser layout engine — not JSDOM.
 * Works against either template (Two-Column Classic or Left-Aligned).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SienaARWValidate = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Counts rendered line boxes of an element's text via getClientRects —
  // reliable across wrapped inline/box-orient text, independent of
  // line-height math or -webkit-line-clamp visual truncation.
  function countLines(el) {
    if (!el || !el.firstChild) return 0;
    var doc = el.ownerDocument;
    try {
      var range = doc.createRange();
      range.selectNodeContents(el);
      var rects = range.getClientRects();
      var tops = [];
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (r.width === 0 && r.height === 0) continue;
        var found = false;
        for (var j = 0; j < tops.length; j++) {
          if (Math.abs(tops[j] - r.top) < 1) { found = true; break; }
        }
        if (!found) tops.push(r.top);
      }
      if (tops.length) return tops.length;
    } catch (e) {
      // No real layout engine (e.g. JSDOM) — fall through to the text-presence guess below.
    }
    return el.textContent.trim() ? 1 : 0;
  }

  function waitForLayout(doc) {
    return (doc.fonts && doc.fonts.ready) ? doc.fonts.ready : Promise.resolve();
  }

  var ALL_ITEM_IDS = (function () {
    var ids = [];
    for (var i = 1; i <= 5; i++) ids.push('antipasti-' + i);
    for (var i = 1; i <= 8; i++) ids.push('entree-' + i);
    for (var i = 1; i <= 3; i++) ids.push('dolci-' + i);
    return ids;
  })();

  var BANNED_WORDS = ['extravaganza'];

  function checkBannedWords(doc, violations) {
    var textEls = doc.querySelectorAll('[data-text-id]');
    for (var i = 0; i < textEls.length; i++) {
      var el = textEls[i];
      var val = (el.textContent || '').toLowerCase();
      for (var j = 0; j < BANNED_WORDS.length; j++) {
        if (val.indexOf(BANNED_WORDS[j]) !== -1) {
          violations.push({
            field: el.getAttribute('data-text-id'),
            rule: 'banned-word:' + BANNED_WORDS[j],
            lines: null
          });
        }
      }
    }
  }

  function validate(docOrRoot) {
    var doc = docOrRoot.nodeType === 9 ? docOrRoot : docOrRoot.ownerDocument;
    var violations = [];

    var subtitle = doc.querySelector('[data-text-id="subtitle"]');
    if (subtitle && subtitle.textContent.trim() && countLines(subtitle) > 1) {
      violations.push({ field: 'subtitle', rule: 'max-1-line', lines: countLines(subtitle) });
    }

    ALL_ITEM_IDS.forEach(function (id) {
      var nameEl = doc.querySelector('[data-text-id="' + id + '-name"]');
      var descEl = doc.querySelector('[data-text-id="' + id + '-desc"]');
      if (nameEl && nameEl.textContent.trim() && countLines(nameEl) > 1) {
        violations.push({ field: id + '-name', rule: 'max-1-line', lines: countLines(nameEl) });
      }
      if (descEl && descEl.textContent.trim() && countLines(descEl) > 2) {
        violations.push({ field: id + '-desc', rule: 'max-2-lines', lines: countLines(descEl) });
      }
    });

    // Cocktail: same shape as a dish (name max 1 line, desc max 2), plus
    // price is digits-only (like an upcharge, but never removes a course —
    // clearing cocktail.name hides the whole featured-cocktail block instead).
    var cocktailName = doc.querySelector('[data-text-id="cocktail-name"]');
    var cocktailDesc = doc.querySelector('[data-text-id="cocktail-desc"]');
    var cocktailPrice = doc.querySelector('[data-text-id="cocktail-price"]');
    if (cocktailName && cocktailName.textContent.trim() && countLines(cocktailName) > 1) {
      violations.push({ field: 'cocktail-name', rule: 'max-1-line', lines: countLines(cocktailName) });
    }
    if (cocktailDesc && cocktailDesc.textContent.trim() && countLines(cocktailDesc) > 2) {
      violations.push({ field: 'cocktail-desc', rule: 'max-2-lines', lines: countLines(cocktailDesc) });
    }
    if (cocktailPrice && cocktailPrice.textContent.trim() && !/^\d{1,3}$/.test(cocktailPrice.textContent.trim())) {
      violations.push({ field: 'cocktail-price', rule: 'digits-only', lines: null });
    }

    checkBannedWords(doc, violations);

    var page = doc.querySelector('.page');
    var overflowPx = 0;
    var pageFits = true;
    if (page) {
      overflowPx = Math.max(0, page.scrollHeight - page.clientHeight);
      pageFits = overflowPx <= 1;
    }

    return {
      fits: pageFits && violations.length === 0,
      overflowPx: overflowPx,
      violations: violations,
      worstField: violations.length ? violations[0].field : null
    };
  }

  return { validate: validate, waitForLayout: waitForLayout, countLines: countLines };
});
