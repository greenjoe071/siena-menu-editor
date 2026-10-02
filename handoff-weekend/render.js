/**
 * Siena Weekend Specials Menu Renderer — v2 (centered redesign, Oct 2026).
 *
 * Hydrates the Weekend Specials template DOM in place. The hero is static and
 * never touched. Each dish section is REBUILT from its JSON `items` array
 * (variable cardinality, 1..4 per section) by cloning
 * <template id="dish-template">.
 *
 * Usage (browser):
 *   const doc = new DOMParser().parseFromString(templateHtml, 'text/html');
 *   SienaWeekendRender.render(doc, menuData);
 *
 * Usage (node, for tests):
 *   const { JSDOM } = require('jsdom');
 *   const dom = new JSDOM(templateHtml);
 *   render(dom.window.document, menuData);
 *
 * v2 changes vs v1:
 *   • Single centered column — no cnt-1 / cnt-3 orphan classes any more.
 *   • No section subtitles ("Starters"/"Entrees") and no weekly footer title.
 *   • Descriptions get a 5-word "no short last line" bind: the last 5 words
 *     are joined with U+00A0 (no-break space) so a wrapped 2nd line never
 *     holds fewer than 5 words. Applied to descriptions of 8+ words only.
 *     The stored JSON is untouched — the bind happens at render time.
 *
 * render.js only hydrates content. The auto-fit ladder lives in settle.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaWeekendRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BIND_WORDS = 5;

  /** Join the last BIND_WORDS words with no-break spaces (8+ word strings only). */
  function bindLastWords(text, n) {
    n = n || BIND_WORDS;
    var words = String(text).trim().split(/ +/);
    if (words.length <= n + 2) return words.join(' ');
    return words.slice(0, -n).join(' ') + ' ' + words.slice(-n).join('\u00A0');
  }

  function setText(doc, textId, value, allowHtml) {
    var els = doc.querySelectorAll('[data-text-id="' + textId + '"]');
    for (var i = 0; i < els.length; i++) {
      if (allowHtml) els[i].innerHTML = value;
      else els[i].textContent = value;
    }
  }

  function fillDish(node, dish) {
    node.querySelector('.dish-name').textContent = dish.name;
    node.querySelector('.dish-price').textContent = dish.price;
    node.querySelector('.dish-desc').textContent = bindLastWords(dish.desc);
  }

  function renderSection(doc, sectionId, sectionData) {
    var titleEl = doc.querySelector('[data-section-title-for="' + sectionId + '"]');
    if (titleEl) titleEl.textContent = sectionData.title;

    var grid = doc.querySelector('[data-section-id="' + sectionId + '"] .dish-grid');
    if (!grid) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    var tpl = doc.getElementById('dish-template');
    if (!tpl) throw new Error('Weekend renderer: missing <template id="dish-template"> in template.html.');
    var blueprint = tpl.content.firstElementChild;
    if (!blueprint) throw new Error('Weekend renderer: <template id="dish-template"> is empty.');

    for (var i = 0; i < sectionData.items.length; i++) {
      var dish = sectionData.items[i];
      var node = blueprint.cloneNode(true);
      node.setAttribute('data-dish-id', dish.id);
      node.setAttribute('data-section-id', sectionId);
      fillDish(node, dish);
      grid.appendChild(node);
    }
  }

  function renderDessert(doc, dessert) {
    var section = doc.querySelector('[data-section-id="dessert"]');
    if (!section) return;
    if (!dessert) { section.remove(); return; }
    var titleEl = section.querySelector('[data-section-title-for="dessert"]');
    if (titleEl) titleEl.textContent = dessert.title;
    var dishEl = section.querySelector('.dish');
    if (dishEl) fillDish(dishEl, dessert);
  }

  function renderWeekly(doc, weekly) {
    var grid = doc.querySelector('.weekly-grid');
    if (!grid) return;
    var rowEl = {};
    var cells = grid.querySelectorAll(':scope > [data-week-row-id]');
    for (var i = 0; i < cells.length; i++) rowEl[cells[i].getAttribute('data-week-row-id')] = cells[i];
    for (var j = 0; j < weekly.rows.length; j++) {
      var row = weekly.rows[j];
      var el = rowEl[row.id];
      if (!el) continue;
      el.querySelector('.weekly-day').textContent = row.day_label;
      el.querySelector('.weekly-headline').textContent = row.headline;
      el.querySelector('.weekly-detail').textContent = row.detail;
      grid.appendChild(el);
    }
  }

  function render(doc, data) {
    for (var id in data.sections) {
      if (Object.prototype.hasOwnProperty.call(data.sections, id)) renderSection(doc, id, data.sections[id]);
    }
    renderDessert(doc, data.dessert);
    renderWeekly(doc, data.weekly);
    setText(doc, 'policy-line', data.policy_line, true);
  }

  return { render: render, bindLastWords: bindLastWords, BIND_WORDS: BIND_WORDS };
});
