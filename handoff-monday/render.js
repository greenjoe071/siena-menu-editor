/**
 * Siena Monday $26 Menu Renderer — single source of truth for JSON → HTML.
 *
 * Hydrates the Monday menu template DOM in place. Does NOT regenerate
 * structure or CSS. If you change this file, the snapshot test must
 * still pass.
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
 * Model:
 *   The template has FIXED slots — two course sections (course-1, course-2)
 *   and a four-cell weekly grid (w-tue, w-wed, w-thu, w-wknd). Section IDs,
 *   dish IDs, and week-row IDs are stable. The renderer fills those slots;
 *   it never creates or destroys them. The editor must respect the cardinality:
 *     - course-1 (Insalata o Zuppa): 2 items
 *     - course-2 (Pasta):            4 items
 *     - weekly grid:                 4 rows
 *
 *   Dish ordering within a course is taken from the JSON `items` array order.
 *   Weekly row ordering is taken from the JSON `weekly.rows` array order.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaMondayRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function setText(doc, textId, value, allowHtml) {
    const els = doc.querySelectorAll('[data-text-id="' + textId + '"]');
    for (const el of els) {
      if (allowHtml) el.innerHTML = value;
      else el.textContent = value;
    }
  }

  function renderDish(doc, dishEl, dish) {
    // Name
    const nameEl = dishEl.querySelector('.dish-name');
    nameEl.textContent = dish.name;

    // Description
    const descEl = dishEl.querySelector('.dish-desc');
    descEl.textContent = dish.desc;

    // Price (optional — empty string means "no price shown" since this
    // is a prix-fixe menu). Add/remove the .dish-price element as needed.
    const existingPrice = dishEl.querySelector('.dish-price');
    const hasPrice = dish.price != null && String(dish.price).trim() !== '';
    if (hasPrice) {
      let priceEl = existingPrice;
      if (!priceEl) {
        priceEl = doc.createElement('div');
        priceEl.className = 'dish-price';
        dishEl.appendChild(priceEl);
      }
      priceEl.textContent = String(dish.price);
    } else if (existingPrice) {
      existingPrice.remove();
    }
  }

  function renderSection(doc, sectionId, sectionData) {
    // Section title and subtitle
    const titleEl = doc.querySelector('[data-section-title-for="' + sectionId + '"]');
    if (titleEl) titleEl.textContent = sectionData.title;
    const subEl = doc.querySelector('[data-section-subtitle-for="' + sectionId + '"]');
    if (subEl) subEl.textContent = sectionData.subtitle;

    // Resolve the section container and its existing dish elements
    const container = doc.querySelector('[data-section-id="' + sectionId + '"].course');
    if (!container) return;

    const dishEl = {};
    for (const el of container.querySelectorAll(':scope > [data-dish-id]')) {
      dishEl[el.getAttribute('data-dish-id')] = el;
    }

    // Walk JSON order, update content, re-append in JSON order.
    for (const dish of sectionData.items) {
      const el = dishEl[dish.id];
      if (!el) continue;
      renderDish(doc, el, dish);
      container.appendChild(el);
    }
  }

  function renderWeeklyRow(doc, rowEl, row) {
    rowEl.querySelector('.weekly-day').textContent = row.day_label;
    rowEl.querySelector('.weekly-headline').textContent = row.headline;
    rowEl.querySelector('.weekly-detail').textContent = row.detail;
  }

  function renderWeekly(doc, weekly) {
    setText(doc, 'weekly-title', weekly.title);

    const grid = doc.querySelector('.weekly-grid');
    if (!grid) return;

    const rowEl = {};
    for (const el of grid.querySelectorAll(':scope > [data-week-row-id]')) {
      rowEl[el.getAttribute('data-week-row-id')] = el;
    }

    for (const row of weekly.rows) {
      const el = rowEl[row.id];
      if (!el) continue;
      renderWeeklyRow(doc, el, row);
      grid.appendChild(el);
    }
  }

  function render(doc, data) {
    // Hero
    setText(doc, 'hero-eyebrow',    data.hero.eyebrow);
    setText(doc, 'hero-price',      data.hero.price);
    setText(doc, 'hero-tagline',    data.hero.tagline);
    setText(doc, 'hero-meta-left',  data.hero.meta_left);
    setText(doc, 'hero-meta-right', data.hero.meta_right);

    // Course sections
    for (const [id, section] of Object.entries(data.sections)) {
      renderSection(doc, id, section);
    }

    // Weekly specials card
    renderWeekly(doc, data.weekly);

    // Footer
    setText(doc, 'policy-line', data.policy_line, true);
  }

  return { render };
});
