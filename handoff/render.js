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
 * Notes:
 *   - Subsections (Non-Alcoholic Beverages → Mocktails) — each dish lives in
 *     exactly one of two `.two-col-flow` containers, and that membership is
 *     FIXED at template load time. The renderer never moves a dish across
 *     containers; it only re-orders items within each container.
 *
 *   - Add-on blocks (pasta / salad / steak) — each block is a single line
 *     under its section. The renderer rebuilds the `.addons-items` innerHTML
 *     from the JSON array each render. Items have an `enabled` flag (default
 *     true). The whole block is removed from the DOM when `block.enabled ===
 *     false` OR when no items remain enabled.
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  /**
   * Render one add-on block (pasta / salad / steak).
   *
   * Behavior:
   *   - If `data` is missing/null OR `data.enabled === false` → remove block.
   *   - Filter items by `enabled !== false` (absent flag defaults to true).
   *   - If no enabled items remain → remove block.
   *   - Otherwise: write label, rebuild items innerHTML, write tail (if slot
   *     exists in template and data.tail is present).
   *
   * Items are rendered as `<strong>{name}</strong> {price}` joined by
   * `&nbsp;·&nbsp;` (a non-breaking-space middle-dot separator) — matching
   * the printed treatment exactly.
   */
  function renderAddonsBlock(doc, blockId, data) {
    const block = doc.querySelector('[data-addons-block-id="' + blockId + '"]');
    if (!block) return;

    if (!data || data.enabled === false) {
      block.remove();
      return;
    }

    const items = (data.items || []).filter(i => i.enabled !== false);
    if (items.length === 0) {
      block.remove();
      return;
    }

    const labelEl = block.querySelector('[data-addons-label-for="' + blockId + '"]');
    if (labelEl && data.label != null) labelEl.textContent = data.label;

    const itemsEl = block.querySelector('[data-addons-items-for="' + blockId + '"]');
    if (itemsEl) {
      itemsEl.innerHTML = items
        .map(item => '<strong>' + escapeHtml(item.name) + '</strong> ' + escapeHtml(item.price))
        .join(' &nbsp;·&nbsp; ');
    }

    const tailEl = block.querySelector('[data-addons-tail-for="' + blockId + '"]');
    if (tailEl) {
      if (data.tail != null && data.tail !== '') {
        tailEl.textContent = data.tail;
      } else {
        // No tail content — drop the leading space too so serialization stays clean.
        const prev = tailEl.previousSibling;
        if (prev && prev.nodeType === 3 /* TEXT_NODE */ && /^\s+$/.test(prev.nodeValue)) {
          prev.remove();
        }
        tailEl.remove();
      }
    }
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
    const titleEl = doc.querySelector('[data-section-title-for="' + sectionId + '"]');
    if (titleEl) titleEl.textContent = sectionData.title;

    const containers = [].slice.call(doc.querySelectorAll(
      '[data-section-id="' + sectionId + '"].two-col, ' +
      '[data-section-id="' + sectionId + '"].two-col-flow'
    ));
    if (containers.length === 0) return;

    const dishEl = {};
    const dishContainer = {};
    for (const c of containers) {
      for (const el of c.querySelectorAll(':scope > [data-dish-id]')) {
        const id = el.getAttribute('data-dish-id');
        dishEl[id] = el;
        dishContainer[id] = c;
      }
    }

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
    setText(doc, 'raw-warning-main', data.raw_warning_main);
    setText(doc, 'raw-warning-qualifier', data.raw_warning_qualifier);
    setText(doc, 'policy-line', data.policy_line, true);

    // Add-on blocks
    renderAddonsBlock(doc, 'salad', data.salad_addons);
    renderAddonsBlock(doc, 'pasta', data.pasta_addons);
    renderAddonsBlock(doc, 'steak', data.steak_addons);

    // Sections
    for (const [id, section] of Object.entries(data.sections)) {
      renderSection(doc, id, section);
    }
  }

  return { render };
});
