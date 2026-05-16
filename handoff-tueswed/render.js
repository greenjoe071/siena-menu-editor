/**
 * Siena Tuesday/Wednesday Prix-Fixe Renderer — JSON → HTML hydrator.
 *
 * Mutates the template DOM in place. Does NOT regenerate structure,
 * CSS, or the static weekly-specials footer. If this file changes,
 * the snapshot test must still pass.
 *
 * Usage (browser):
 *   const doc = new DOMParser().parseFromString(templateHtml, 'text/html');
 *   SienaTuewedRender.render(doc, menuData);
 *   const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
 *
 * Usage (node, for tests):
 *   const { JSDOM } = require('jsdom');
 *   const dom = new JSDOM(templateHtml);
 *   SienaTuewedRender.render(dom.window.document, menuData);
 *
 * Data shape (see menu-data.json for a realistic example):
 *   {
 *     "price":   "45",                   // digits only; "$" stays static
 *     "courses": [                        // exactly 3 entries, fixed order
 *       { "id": "course-1", "title": "…", "desc": "…" },
 *       { "id": "course-2", "title": "…", "desc": "…" },
 *       { "id": "course-3", "title": "…", "desc": "…" }
 *     ],
 *     "addon": {                          // optional add-on (wine pairing,
 *       "title": "…",                     //  cheese course, etc.) — when
 *       "desc":  "…",                     //  title is empty/missing the
 *       "price": "18"                     //  whole block is removed
 *     },
 *     "policy_line": "…"                  // optional, allows HTML
 *   }
 *
 * Optional-field behaviour:
 *   - addon.title empty/missing → the entire add-on block is removed.
 *   - addon.price empty         → "Add $XX" pill removed; title row stays.
 *   - addon.desc  empty         → small caps note line removed; title stays.
 *   - policy_line empty/missing → the footnotes block is removed.
 *
 * Everything else (restaurant chrome, day labels, weekly footer cells,
 * Roman numerals, "Suggestioni del Capo Cuoco · Prix Fixe", $ glyph,
 * "Add $" prefix) is baked into the template and not addressable here.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaTuewedRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isFilled(v) {
    return v != null && String(v).trim() !== '';
  }

  function setText(doc, textId, value, allowHtml) {
    const els = doc.querySelectorAll('[data-text-id="' + textId + '"]');
    for (const el of els) {
      if (allowHtml) el.innerHTML = String(value);
      else el.textContent = String(value);
    }
  }

  function renderCourse(doc, course) {
    if (!course || !course.id) return;
    // Each course's title and desc are addressed by their data-text-id slots.
    // The id ties the JSON entry to the slot (course-1 / course-2 / course-3).
    setText(doc, course.id + '-title', isFilled(course.title) ? course.title : '');
    setText(doc, course.id + '-desc',  isFilled(course.desc)  ? course.desc  : '');
  }

  function renderAddon(doc, addon) {
    const block = doc.querySelector('[data-addon]');
    if (!block) return;

    // Title empty → whole add-on block gone. This is the toggle.
    if (!addon || !isFilled(addon.title)) {
      block.remove();
      return;
    }

    setText(doc, 'addon-title', addon.title);

    // Price pill: remove if empty, otherwise update.
    const pricePill = block.querySelector('.addon-price');
    if (isFilled(addon.price)) {
      setText(doc, 'addon-price', addon.price);
    } else if (pricePill) {
      pricePill.remove();
    }

    // Description note: remove if empty, otherwise update.
    const descEl = block.querySelector('[data-text-id="addon-desc"]');
    if (isFilled(addon.desc)) {
      setText(doc, 'addon-desc', addon.desc);
    } else if (descEl) {
      descEl.remove();
    }
  }

  function renderPolicy(doc, policyLine) {
    const wrap = doc.querySelector('[data-footnotes]');
    if (!wrap) return;
    if (!isFilled(policyLine)) {
      wrap.remove();
      return;
    }
    // Policy line allows inline HTML (e.g. <strong>).
    setText(doc, 'policy-line', policyLine, true);
  }

  function render(doc, data) {
    if (!data) return;

    // Hero price — digits only; "$" is static in the template.
    if (isFilled(data.price)) setText(doc, 'price', data.price);

    // Three courses (fixed cardinality, fixed order).
    if (Array.isArray(data.courses)) {
      for (const course of data.courses) renderCourse(doc, course);
    }

    // Add-on (optional).
    renderAddon(doc, data.addon);

    // Policy footnote (optional, HTML allowed).
    renderPolicy(doc, data.policy_line);
  }

  return { render };
});
