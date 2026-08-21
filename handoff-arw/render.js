/**
 * SienaARWRender — UMD renderer for the Austin Restaurant Weeks $50 Dinner Menu.
 * SienaARWRender.render(document, data) — mutates the document in place.
 * Works identically against template.html (Two-Column Classic) and
 * template-left-aligned.html (Left-Aligned) — both share the same data-* hooks,
 * so one dataset renders into whichever style the manager picked.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SienaARWRender = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function setText(doc, id, value) {
    var el = doc.querySelector('[data-text-id="' + id + '"]');
    if (el) el.textContent = value || '';
  }

  // Groups an element's rendered words into visual lines via per-word Range
  // measurement (same technique as validate.js's countLines, one level more
  // granular). Requires real layout — under JSDOM getClientRects() returns
  // nothing useful, so this safely no-ops there (see BUILD-SPEC §9).
  function wordLineGroups(el) {
    var textNode = el.firstChild;
    if (!textNode || textNode.nodeType !== 3) return [];
    var doc = el.ownerDocument;
    var text = textNode.textContent;
    var re = /\S+/g;
    var groups = [];
    var m;
    try {
      while ((m = re.exec(text))) {
        var range = doc.createRange();
        range.setStart(textNode, m.index);
        range.setEnd(textNode, m.index + m[0].length);
        var rects = range.getClientRects();
        if (!rects.length) continue;
        var top = rects[0].top;
        if (top === 0 && rects[0].width === 0) continue;
        var last = groups[groups.length - 1];
        if (last && Math.abs(last.top - top) < 1) {
          last.count++;
        } else {
          groups.push({ top: top, count: 1 });
        }
      }
    } catch (e) {
      // No real layout engine available (e.g. JSDOM's Range.getClientRects is
      // not implemented and throws) — skip the orphan-line fix rather than
      // crashing render(). It's a browser-layout-dependent nice-to-have, not
      // core DOM mutation, so a silent no-op here is the correct fallback.
      return [];
    }
    return groups;
  }

  // Prevents an orphaned 1-2 word wrapped line: if the field wraps and the
  // last visual line has fewer than minWords, glues that many trailing words
  // together with U+00A0 so they move as one unit. Guarantees >= minWords on
  // a wrapped line; in narrow columns a whole extra word from above may also
  // ride down with the glued group (more than minWords is possible, fewer never is).
  // Idempotent: always starts from the field's plain-space text.
  function fixOrphans(doc, id, minWords) {
    minWords = minWords || 3;
    var el = doc.querySelector('[data-text-id="' + id + '"]');
    if (!el) return;
    var text = el.textContent;
    if (!text) return;
    var words = text.trim().split(/ +/);
    if (words.length <= minWords) return;
    var groups = wordLineGroups(el);
    if (groups.length < 2) return; // single line (or unmeasurable) — nothing to fix
    var lastCount = groups[groups.length - 1].count;
    if (lastCount >= minWords) return;

    // Try the SMALLEST glue size first (2 words, then 3, up to minWords)
    // rather than always gluing exactly minWords \u2014 gluing more words than
    // necessary widens the unbreakable unit and can drag an extra word down
    // from the line above it, overshooting past minWords for no reason.
    for (var glueSize = 2; glueSize <= minWords; glueSize++) {
      var glueStart = words.length - glueSize;
      if (glueStart < 0) break;
      var head = words.slice(0, glueStart).join(' ');
      var tail = words.slice(glueStart).join('\u00A0');
      el.textContent = (head ? head + ' ' : '') + tail;
      var newGroups = wordLineGroups(el);
      if (newGroups.length < 2) return; // now fits on one line entirely
      if (newGroups[newGroups.length - 1].count >= minWords) return; // smallest sufficient glue found
    }
    // Nothing smaller worked \u2014 fall back to the full minWords glue.
    var fallbackStart = words.length - minWords;
    var fallbackHead = words.slice(0, fallbackStart).join(' ');
    var fallbackTail = words.slice(fallbackStart).join('\u00A0');
    el.textContent = (fallbackHead ? fallbackHead + ' ' : '') + fallbackTail;
  }

  function fillItems(doc, courseData, ids) {
    var items = (courseData && courseData.items) || [];
    var byId = {};
    items.forEach(function (it) { byId[it.id] = it; });
    ids.forEach(function (id) {
      var d = byId[id] || {};
      setText(doc, id + '-name', d.name);
      setText(doc, id + '-desc', d.desc);
      fixOrphans(doc, id + '-desc', 3);
      var upWrap = doc.querySelector('[data-upcharge-wrap="' + id + '"]');
      var upVal = (d.upcharge || '').toString().trim();
      if (upWrap) {
        if (upVal) {
          upWrap.style.display = '';
          setText(doc, id + '-upcharge', upVal);
        } else {
          upWrap.style.display = 'none';
        }
      }
    });
  }

  function fillCocktail(doc, cocktail) {
    cocktail = cocktail || {};
    var block = doc.querySelector('[data-cocktail-block]');
    var name = (cocktail.name || '').toString().trim();
    if (block) block.style.display = name ? '' : 'none';
    if (!name) return;
    setText(doc, 'cocktail-name', cocktail.name);
    setText(doc, 'cocktail-desc', cocktail.desc);
    fixOrphans(doc, 'cocktail-desc', 3);
    var priceWrap = doc.querySelector('[data-cocktail-price-wrap]');
    var priceVal = (cocktail.price || '').toString().trim();
    if (priceWrap) {
      if (priceVal) {
        priceWrap.style.display = '';
        setText(doc, 'cocktail-price', priceVal);
      } else {
        priceWrap.style.display = 'none';
      }
    }
  }

  // cols = max columns the grid uses when the course is at full cardinality.
  // Shrinks to the visible count when fewer items remain; when the visible
  // count exceeds cols with a remainder, the last visible item spans the
  // full row instead of leaving a gap (mirrors the Antipasti "5th item"
  // treatment in the approved design). Templates with no [data-grid] element
  // (e.g. the Left-Aligned single-column style) simply skip the column math —
  // hide/show is all that style needs.
  function layoutCourse(doc, courseKey, cols, ids) {
    var courseEl = doc.querySelector('[data-course-id="' + courseKey + '"]');
    var grid = doc.querySelector('[data-grid="' + courseKey + '"]');
    var visible = [];
    ids.forEach(function (id) {
      var item = doc.querySelector('[data-item-id="' + id + '"]');
      if (!item) return;
      var nameEl = item.querySelector('[data-text-id="' + id + '-name"]');
      var hasName = nameEl && nameEl.textContent.trim().length > 0;
      item.style.display = hasName ? '' : 'none';
      if (grid) item.style.gridColumn = '';
      if (hasName) visible.push(item);
    });
    var n = visible.length;
    if (n === 0) {
      if (courseEl) courseEl.style.display = 'none';
      return;
    }
    if (courseEl) courseEl.style.display = '';
    if (!grid) return;
    var usedCols = Math.min(cols, n);
    grid.style.gridTemplateColumns = 'repeat(' + usedCols + ', 1fr)';
    if (n > cols && n % cols !== 0) {
      visible[n - 1].style.gridColumn = '1 / -1';
    }
  }

  var ANTIPASTI_IDS = ['antipasti-1', 'antipasti-2', 'antipasti-3', 'antipasti-4', 'antipasti-5'];
  var ENTREE_IDS = ['entree-1', 'entree-2', 'entree-3', 'entree-4', 'entree-5', 'entree-6', 'entree-7', 'entree-8'];
  var DOLCI_IDS = ['dolci-1', 'dolci-2', 'dolci-3'];

  function render(document, data) {
    data = data || {};
    setText(document, 'subtitle', data.subtitle);
    fillCocktail(document, data.cocktail);

    var courses = data.courses || {};
    fillItems(document, courses.antipasti, ANTIPASTI_IDS);
    fillItems(document, courses.entree, ENTREE_IDS);
    fillItems(document, courses.dolci, DOLCI_IDS);

    layoutCourse(document, 'antipasti', 2, ANTIPASTI_IDS);
    layoutCourse(document, 'entree', 2, ENTREE_IDS);
    layoutCourse(document, 'dolci', 3, DOLCI_IDS);
  }

  return {
    render: render,
    ANTIPASTI_IDS: ANTIPASTI_IDS,
    ENTREE_IDS: ENTREE_IDS,
    DOLCI_IDS: DOLCI_IDS
  };
});
