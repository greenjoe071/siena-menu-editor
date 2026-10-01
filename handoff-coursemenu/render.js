/**
 * Siena Course Menu Renderer — JSON → HTML hydrator.
 *
 * Generic 2–4 course menu (chapter-rule Roman numerals, Pattern B
 * layout-budget constraint model). Mutates the template DOM in place.
 *
 * Usage (browser):
 *   const doc = new DOMParser().parseFromString(templateHtml, 'text/html');
 *   SienaCourseMenuRender.render(doc, menuData);
 *
 * Usage (node, for tests): see snapshot-test.spec.mjs.
 *
 * Data shape (see menu-data.json):
 *   {
 *     "header":      "Three Course Special",   // required, plain text, ONE line incl. price
 *     "price":       "55",                     // digits only; "$" is static
 *     "description": "…",                      // optional, ONE line max; empty → removed
 *     "courses": [ { "id", "title", "desc" } ], // 2–4 entries; ORDER sets numeral I–IV
 *     "addon":  { "title", "price", "desc" },  // optional; empty title → block removed
 *     "footer": { "enabled", "policy_line" }   // optional; disabled/empty → block removed
 *   }
 *
 * Removal is real DOM removal (not display:none) so the page reflows.
 * Courses beyond courses.length are removed (both the numeral rule and
 * the dish body). Numerals I–IV are static template chrome tied to slot
 * position — the editor never sets them.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaCourseMenuRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_COURSES = 2, MAX_COURSES = 4;

  function isFilled(v) { return v != null && String(v).trim() !== ''; }

  function setText(doc, textId, value, allowHtml) {
    var els = doc.querySelectorAll('[data-text-id="' + textId + '"]');
    for (var i = 0; i < els.length; i++) {
      if (allowHtml) els[i].innerHTML = String(value);
      else els[i].textContent = String(value);
    }
  }

  function removeAll(doc, selector) {
    var els = doc.querySelectorAll(selector);
    for (var i = 0; i < els.length; i++) els[i].remove();
  }

  function renderCourses(doc, courses) {
    var list = Array.isArray(courses) ? courses.slice(0, MAX_COURSES) : [];
    for (var slot = 1; slot <= MAX_COURSES; slot++) {
      var c = list[slot - 1];
      if (!c) { removeAll(doc, '[data-course-slot="' + slot + '"]'); continue; }
      setText(doc, 'course-' + slot + '-title', isFilled(c.title) ? c.title : '');
      if (isFilled(c.desc)) setText(doc, 'course-' + slot + '-desc', c.desc);
      else removeAll(doc, '[data-text-id="course-' + slot + '-desc"]');
    }
  }

  function renderAddon(doc, addon) {
    var block = doc.querySelector('[data-addon]');
    if (!block) return;
    if (!addon || !isFilled(addon.title)) { block.remove(); return; }
    setText(doc, 'addon-title', addon.title);
    var pill = block.querySelector('.addon-price');
    if (isFilled(addon.price)) setText(doc, 'addon-price', addon.price);
    else if (pill) pill.remove();
    var note = block.querySelector('[data-text-id="addon-desc"]');
    if (isFilled(addon.desc)) setText(doc, 'addon-desc', addon.desc);
    else if (note) note.remove();
  }

  function renderFooter(doc, footer) {
    var wrap = doc.querySelector('[data-footnotes]');
    if (!wrap) return;
    if (!footer || footer.enabled === false || !isFilled(footer.policy_line)) { wrap.remove(); return; }
    setText(doc, 'policy-line', footer.policy_line, true);
  }

  function render(doc, data) {
    if (!data) return;
    setText(doc, 'header', isFilled(data.header) ? data.header : '');
    if (isFilled(data.price)) setText(doc, 'price', data.price);
    if (isFilled(data.description)) setText(doc, 'description', data.description);
    else removeAll(doc, '[data-hero-desc]');
    renderCourses(doc, data.courses);
    renderAddon(doc, data.addon);
    renderFooter(doc, data.footer);
  }

  return { render: render, MIN_COURSES: MIN_COURSES, MAX_COURSES: MAX_COURSES };
});
