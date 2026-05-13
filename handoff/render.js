/**
 * Siena Menu Renderer — single source of truth for JSON → HTML.
 *
 * Hydrates the menu template DOM in place. Does NOT regenerate structure or CSS.
 * If you change this file, the snapshot test must still pass.
 *
 * Usage (browser):
 *   const doc = new DOMParser().parseFromString(templateHtml, 'text/html');
 *   render(doc, menuData);
 *   const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
 *
 * Usage (node, for tests):
 *   const { JSDOM } = require('jsdom');
 *   const dom = new JSDOM(templateHtml);
 *   render(dom.window.document, menuData);
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function setText(doc, textId, value, allowHtml) {
    const els = doc.querySelectorAll('[data-text-id="' + textId + '"]');
    for (const el of els) {
      if (allowHtml) el.innerHTML = value;
      else el.textContent = value;
    }
  }

  function renderBreadNote(doc, breadNote) {
    const el = doc.querySelector('.bread-note[data-text-id="bread-note-body"]');
    if (!el) return;
    // Rebuild: <strong data-text-id="bread-note-title">TITLE</strong>BODY
    el.innerHTML = '';
    const strong = doc.createElement('strong');
    strong.setAttribute('data-text-id', 'bread-note-title');
    strong.textContent = breadNote.title;
    el.appendChild(strong);
    el.appendChild(doc.createTextNode('\n    ' + breadNote.body));
  }

  function renderDishName(doc, dish) {
    // <span class="dish-name">NAME<sup-style span>*</sup-style></span> when raw
    const frag = doc.createDocumentFragment();
    frag.appendChild(doc.createTextNode(dish.name));
    if (dish.raw) {
      frag.appendChild(doc.createTextNode(' '));
      const star = doc.createElement('span');
      star.setAttribute('style', 'font-size:9pt;font-weight:400;font-style:normal;');
      star.textContent = '*';
      frag.appendChild(star);
    }
    return frag;
  }

  function renderDish(doc, dishEl, dish) {
    const nameEl = dishEl.querySelector('.dish-name');
    nameEl.innerHTML = '';
    nameEl.appendChild(renderDishName(doc, dish));

    const descEl = dishEl.querySelector('.dish-desc');
    descEl.textContent = dish.desc;

    // Price: single or dual
    const oldPrice = dishEl.querySelector('.dish-price, .dish-price-dual');
    const newPrice = doc.createElement('div');
    if (dish.price_format === 'dual') {
      newPrice.className = 'dish-price-dual';
      newPrice.innerHTML = 'Bowl ' + dish.bowl_price + '<br>Cup ' + dish.cup_price;
    } else {
      newPrice.className = 'dish-price';
      newPrice.textContent = dish.price;
    }
    oldPrice.replaceWith(newPrice);
  }

  function renderSection(doc, sectionId, sectionData) {
    // Title
    const titleEl = doc.querySelector('[data-section-title-for="' + sectionId + '"]');
    if (titleEl) titleEl.textContent = sectionData.title;

    // Container with the dishes
    const container = doc.querySelector(
      '[data-section-id="' + sectionId + '"].two-col, ' +
      '[data-section-id="' + sectionId + '"].two-col-flow'
    );
    if (!container) return;

    // Map current children by ID
    const dishMap = {};
    for (const el of container.querySelectorAll(':scope > [data-dish-id]')) {
      dishMap[el.getAttribute('data-dish-id')] = el;
    }

    // Walk JSON order, update content, re-append in order
    for (const dish of sectionData.items) {
      const el = dishMap[dish.id];
      if (!el) continue;
      renderDish(doc, el, dish);
      container.appendChild(el); // re-appending reorders
    }
  }

  function render(doc, data) {
    // Header text
    setText(doc, 'restaurant-name', data.header.restaurant_name);
    setText(doc, 'sub-page-1', data.header.sub_page_1, true);
    setText(doc, 'sub-other-pages', data.header.sub_other_pages);

    // Body text
    setText(doc, 'about-blurb', data.about_blurb);
    renderBreadNote(doc, data.bread_note);

    // Footer text
    setText(doc, 'raw-warning-full', data.raw_warning_full);
    setText(doc, 'raw-warning-short', data.raw_warning_short);
    setText(doc, 'policy-line', data.policy_line, true);

    // Sections
    for (const [id, section] of Object.entries(data.sections)) {
      renderSection(doc, id, section);
    }
  }

  return { render };
});
