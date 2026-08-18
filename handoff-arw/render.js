/**
 * SienaARWRender — UMD renderer for the Austin Restaurant Weeks $50 Dinner Menu.
 * SienaARWRender.render(document, data) — mutates the document in place.
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

  function fillItems(doc, courseData, ids) {
    var items = (courseData && courseData.items) || [];
    var byId = {};
    items.forEach(function (it) { byId[it.id] = it; });
    ids.forEach(function (id) {
      var d = byId[id] || {};
      setText(doc, id + '-name', d.name);

      // The upcharge pill lives INSIDE the desc element (see template.html),
      // so grab a reference to it before clearing textContent (which would
      // otherwise destroy it) and re-attach it afterward.
      var descEl = doc.querySelector('[data-text-id="' + id + '-desc"]');
      var upWrap = doc.querySelector('[data-upcharge-wrap="' + id + '"]');
      if (descEl) {
        descEl.textContent = d.desc || '';
        if (upWrap) descEl.appendChild(upWrap);
      }

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

  // cols = max columns the grid uses when the course is at full cardinality.
  // Shrinks to the visible count when fewer items remain; when the visible
  // count exceeds cols with a remainder, the last visible item spans the
  // full row instead of leaving a gap (mirrors the Antipasti "5th item"
  // treatment in the approved design).
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
      item.style.gridColumn = '';
      if (hasName) visible.push(item);
    });
    var n = visible.length;
    if (n === 0) {
      courseEl.style.display = 'none';
      return;
    }
    courseEl.style.display = '';
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
