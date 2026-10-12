/**
 * Siena Tuesday/Wednesday Menu Renderer — JSON → HTML hydrator.
 *
 * v3 (Oct 2026): "Tuesdays Only" special box on top, "Tuesday & Wednesday"
 * title, Chef's Three-Course prix fixe, optional add-on, four editable
 * weekly cells. Layout-budget constraint model (see validate.js).
 *
 * UMD export name stays `SienaTuewedRender` (typo inherited from v1 —
 * do not rename; the editor's calling code depends on it).
 *
 * Usage (browser):
 *   const doc = new DOMParser().parseFromString(templateHtml, 'text/html');
 *   SienaTuewedRender.render(doc, menuData);
 *   const html = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
 *
 * Data shape (see menu-data.json):
 *   {
 *     "special": {                   // ALWAYS shown (no on/off toggle)
 *       "label": "Tuesdays Only",    //   required; sits on the top border
 *       "title": "…",                //   required
 *       "price": "25",               //   required, digits only ("$" static)
 *       "desc":  "…"                 //   optional; empty → line removed
 *     },
 *     "price": "45",                 // prix fixe price, digits only
 *     "courses": [                   // exactly 3, fixed order
 *       { "id": "course-1", "title": "…", "desc": "…" }, …
 *     ],
 *     "addon": { "title", "desc", "price" },   // title empty → block removed
 *     "weekly": [                    // exactly 4, fixed order
 *       { "id": "week-1", "day": "…", "headline": "…", "detail": "…" }, …
 *     ]
 *   }
 *
 * Static (not addressable): "Tuesday & Wednesday" title, "Chef's
 * Three-Course Menu" text, "$" glyphs, "Add $" prefix, numerals I/II/III.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaTuewedRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isFilled(v) {
    return v != null && String(v).trim() !== '';
  }

  function setText(doc, textId, value) {
    const els = doc.querySelectorAll('[data-text-id="' + textId + '"]');
    for (const el of els) el.textContent = String(value);
  }

  function removeSlot(doc, textId) {
    const el = doc.querySelector('[data-text-id="' + textId + '"]');
    if (el) el.remove();
  }

  function renderSpecial(doc, s) {
    if (!s) return;
    if (isFilled(s.label)) setText(doc, 'special-label', s.label);
    if (isFilled(s.title)) setText(doc, 'special-title', s.title);
    if (isFilled(s.price)) setText(doc, 'special-price', s.price);
    if (isFilled(s.desc)) setText(doc, 'special-desc', s.desc);
    else removeSlot(doc, 'special-desc');
  }

  function renderCourse(doc, course) {
    if (!course || !course.id) return;
    setText(doc, course.id + '-title', isFilled(course.title) ? course.title : '');
    setText(doc, course.id + '-desc', isFilled(course.desc) ? course.desc : '');
  }

  function renderAddon(doc, addon) {
    const block = doc.querySelector('[data-addon]');
    if (!block) return;
    if (!addon || !isFilled(addon.title)) { block.remove(); return; }
    setText(doc, 'addon-title', addon.title);
    const pill = block.querySelector('.addon-price');
    if (isFilled(addon.price)) setText(doc, 'addon-price', addon.price);
    else if (pill) pill.remove();
    if (isFilled(addon.desc)) setText(doc, 'addon-desc', addon.desc);
    else removeSlot(doc, 'addon-desc');
  }

  function renderWeekCell(doc, cell) {
    if (!cell || !cell.id) return;
    setText(doc, cell.id + '-day', isFilled(cell.day) ? cell.day : '');
    setText(doc, cell.id + '-headline', isFilled(cell.headline) ? cell.headline : '');
    if (isFilled(cell.detail)) setText(doc, cell.id + '-detail', cell.detail);
    else removeSlot(doc, cell.id + '-detail');
  }

  function render(doc, data) {
    if (!data) return;
    renderSpecial(doc, data.special);
    if (isFilled(data.price)) setText(doc, 'price', data.price);
    if (Array.isArray(data.courses)) data.courses.forEach((c) => renderCourse(doc, c));
    renderAddon(doc, data.addon);
    if (Array.isArray(data.weekly)) data.weekly.forEach((w) => renderWeekCell(doc, w));
  }

  return { render };
});
