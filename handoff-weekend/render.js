/**
 * Siena Weekend Specials Menu Renderer — single source of truth for
 * JSON → HTML on the chef's-suggestions menu.
 *
 * Hydrates the Weekend Specials template DOM in place. Does NOT touch
 * the hero/masthead (it's static) and does NOT regenerate the page
 * structure — but for the two dish sections, it DOES rebuild the dish
 * list from the JSON `items` arrays, because this menu's cardinality is
 * variable (1..4 dishes per section).
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
 *   Two sections — `starters` and `entrees` — each holds 1 to 4 dishes.
 *   The renderer clears each `.dish-grid`, then clones the
 *   `<template id="dish-template">` blueprint once per JSON item and
 *   appends in JSON order. The dish IDs live on the rendered DOM nodes
 *   (`data-dish-id`) so the editor can target them. The grid is stamped
 *   `cnt-1` / `cnt-3` for odd counts so a lone dish centers instead of
 *   stranding in the left column.
 *
 *   Dish prices render INLINE on the name baseline (inside `.dish-head`).
 *
 *   NOTE: render.js only hydrates content. The auto-fit ladder that sheds
 *   page chrome on dense configs lives in `settle.js` and runs in the
 *   browser after layout — it is NOT part of this module or the snapshot.
 *
 *   An OPTIONAL third section, `dessert`, holds exactly one dish when
 *   `data.dessert` is present. When `data.dessert` is absent or null,
 *   the renderer removes the entire dessert section from the DOM — the
 *   page then looks identical to the pre-dessert layout.
 *
 *   The weekly footer is a FIXED 4-row grid (`w-mon`, `w-tue`, `w-wed`,
 *   `w-thu`). Row IDs are stable slots; cell ordering follows JSON
 *   array order. Same pattern as the Monday menu.
 *
 *   The hero block (eyebrow, title, day-meta) is static template content
 *   and is not in the data model at all.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaWeekendRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function setText(doc, textId, value, allowHtml) {
    const els = doc.querySelectorAll('[data-text-id="' + textId + '"]');
    for (const el of els) {
      if (allowHtml) el.innerHTML = value;
      else el.textContent = value;
    }
  }

  function renderSection(doc, sectionId, sectionData) {
    // Section title and subtitle
    const titleEl = doc.querySelector('[data-section-title-for="' + sectionId + '"]');
    if (titleEl) titleEl.textContent = sectionData.title;
    const subEl = doc.querySelector('[data-section-subtitle-for="' + sectionId + '"]');
    if (subEl) subEl.textContent = sectionData.subtitle;

    // Find the section's dish grid and clear it.
    const grid = doc.querySelector(
      '[data-section-id="' + sectionId + '"] .dish-grid'
    );
    if (!grid) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    // Orphan-centering class: an odd dish count (1 or 3) would otherwise strand
    // a lone dish in the left column of the 2-col grid. cnt-1 / cnt-3 center it.
    const n = sectionData.items.length;
    grid.className = 'dish-grid' + (n === 1 ? ' cnt-1' : n === 3 ? ' cnt-3' : '');

    // Resolve the dish blueprint.
    const tpl = doc.getElementById('dish-template');
    if (!tpl) {
      throw new Error(
        'Weekend renderer: missing <template id="dish-template"> blueprint in template.html.'
      );
    }
    const blueprint = tpl.content.firstElementChild;
    if (!blueprint) {
      throw new Error(
        'Weekend renderer: <template id="dish-template"> is empty.'
      );
    }

    // Render each item in JSON order. Variable cardinality (1..4).
    for (const dish of sectionData.items) {
      const node = blueprint.cloneNode(true);
      node.setAttribute('data-dish-id', dish.id);
      node.setAttribute('data-section-id', sectionId);
      node.querySelector('.dish-name').textContent = dish.name;
      node.querySelector('.dish-desc').textContent = dish.desc;
      node.querySelector('.dish-price').textContent = dish.price;
      grid.appendChild(node);
    }
  }

  function renderWeeklyRow(rowEl, row) {
    rowEl.querySelector('.weekly-day').textContent = row.day_label;
    rowEl.querySelector('.weekly-headline').textContent = row.headline;
    rowEl.querySelector('.weekly-detail').textContent = row.detail;
  }

  function renderDessert(doc, dessert) {
    // Optional section. Removed from the DOM entirely when absent or null.
    const section = doc.querySelector('[data-section-id="dessert"]');
    if (!section) return;
    if (!dessert) {
      section.remove();
      return;
    }
    const titleEl = section.querySelector('[data-section-title-for="dessert"]');
    if (titleEl) titleEl.textContent = dessert.title;
    const dishEl = section.querySelector('.dish');
    if (!dishEl) return;
    dishEl.querySelector('.dish-name').textContent = dessert.name;
    dishEl.querySelector('.dish-desc').textContent = dessert.desc;
    dishEl.querySelector('.dish-price').textContent = dessert.price;
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
      renderWeeklyRow(el, row);
      grid.appendChild(el);
    }
  }

  function render(doc, data) {
    // Hero is static — intentionally untouched.

    // Course sections — variable cardinality 1..4 each.
    for (const [id, section] of Object.entries(data.sections)) {
      renderSection(doc, id, section);
    }

    // Dessert — OPTIONAL single-dish section. When data.dessert is absent
    // or null, the entire section is removed from the DOM.
    renderDessert(doc, data.dessert);

    // Weekly specials footer — fixed 4 cells.
    renderWeekly(doc, data.weekly);

    // Footer policy line — HTML allowed.
    setText(doc, 'policy-line', data.policy_line, true);
  }

  return { render };
});
