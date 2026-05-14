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
 *
 * Note on subsections:
 *   The Non-Alcoholic Beverages section is split visually into two groups
 *   ("waters/sodas" and "Mocktails") via a static subhead in the template.
 *   Each dish element lives in exactly one of two `.two-col-flow` containers,
 *   and that group membership is FIXED at template load time. The renderer
 *   never moves a dish across containers; it only re-orders items within
 *   each container according to the JSON. This matches the design rule
 *   that subsection membership, like section membership, is not editable
 *   from the manager-facing app.
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
    el.innerHTML = '';
    const strong = doc.createElement('strong');
    strong.setAttribute('data-text-id', 'bread-note-title');
    strong.textContent = breadNote.title;
    el.appendChild(strong);
    el.appendChild(doc.createTextNode('\n    ' + breadNote.body));
  }

  function renderDishName(doc, dish) {
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

    const oldPrice = dishEl.querySelector('.dish-price, .dish-price-dual');
    const newPrice = doc.createElement('div');
    if (dish.price_format === 'dual') {
      newPrice.className = 'dish-price-dual';
      // Labels are stored in the data so San Pellegrino can use "Sm/Lg"
      // and Tomato Bisque can use "Bowl/Cup". Fall back to legacy fields
      // if labels are absent.
      const a_label = dish.price_a_label || 'Bowl';
      const a_value = dish.price_a != null ? dish.price_a : dish.bowl_price;
      const b_label = dish.price_b_label || 'Cup';
      const b_value = dish.price_b != null ? dish.price_b : dish.cup_price;
      newPrice.innerHTML = a_label + ' ' + a_value + '<br>' + b_label + ' ' + b_value;
    } else {
      newPrice.className = 'dish-price';
      newPrice.textContent = dish.price;
    }
    oldPrice.replaceWith(newPrice);
  }

  function renderSection(doc, sectionId, sectionData) {
    // Title (single section header — subsection heads are static)
    const titleEl = doc.querySelector('[data-section-title-for="' + sectionId + '"]');
    if (titleEl) titleEl.textContent = sectionData.title;

    // Find ALL containers belonging to this section. Most sections have one;
    // non-alcoholic has two (split by the Mocktails subhead).
    const containers = [].slice.call(doc.querySelectorAll(
      '[data-section-id="' + sectionId + '"].two-col, ' +
      '[data-section-id="' + sectionId + '"].two-col-flow'
    ));
    if (containers.length === 0) return;

    // Capture each dish's owning container from the initial template state.
    // This is the subsection-membership "constant" — we never move a dish
    // out of the container the template assigned it to.
    const dishEl = {};
    const dishContainer = {};
    for (const c of containers) {
      for (const el of c.querySelectorAll(':scope > [data-dish-id]')) {
        const id = el.getAttribute('data-dish-id');
        dishEl[id] = el;
        dishContainer[id] = c;
      }
    }

    // Walk the JSON order; update each dish's content; re-append it to its
    // assigned container. Within each container, append-order matches the
    // relative order in the JSON. Items destined for different containers
    // never interleave.
    for (const dish of sectionData.items) {
      const el = dishEl[dish.id];
      const container = dishContainer[dish.id];
      if (!el || !container) continue;
      renderDish(doc, el, dish);
      container.appendChild(el);
    }
  }

  function render(doc, data) {
    // Header
    setText(doc, 'restaurant-name', data.header.restaurant_name);
    setText(doc, 'sub-page-1', data.header.sub_page_1, true);
    setText(doc, 'sub-other-pages', data.header.sub_other_pages);

    // Body
    setText(doc, 'about-blurb', data.about_blurb);
    renderBreadNote(doc, data.bread_note);

    // Footer
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
