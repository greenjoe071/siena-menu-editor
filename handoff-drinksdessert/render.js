/**
 * Siena Drinks & Dessert Menu Renderer.
 *
 * Hydrates the 4-card template (Signature Cocktails, Spirits, Siena Dopa
 * Cena, Dolci) from a JSON data object. Cardinality is OPEN-ENDED on every
 * list — this renderer clears each `[data-list-id]` container and clones
 * the matching `<template>` blueprint once per JSON item, in array order.
 * Page/subsection titles are static template chrome and are never touched
 * here — see BUILD-SPEC.md "Static / not editable".
 *
 * Usage (browser):
 *   const doc = new DOMParser().parseFromString(templateHtml, 'text/html');
 *   render(doc, menuData);
 *
 * Usage (node, for tests):
 *   const { JSDOM } = require('jsdom');
 *   const dom = new JSDOM(templateHtml);
 *   render(dom.window.document, menuData);
 *
 * Price convention: JSON prices are bare strings WITHOUT the `$` glyph
 * (e.g. "13.00", "11") — the menu never prints a `$` anywhere. The
 * renderer also formats for display: a trailing ".00" is dropped ("13.00"
 * → "13"), any other cents are kept as-is ("6.50" stays "6.50"). Do not
 * pre-strip ".00" in the JSON yourself — store full precision, let
 * `formatPrice()` below handle display.
 *
 * Optional fields:
 *   - cocktails[i].note        — empty/missing → the note line is removed.
 *   - dopaCena.<sub>[i].desc   — empty/missing → the description line is
 *     removed. ANY item in ANY Dopa Cena subsection may carry a desc; it
 *     is not reserved for a particular item.
 *
 * This module does NOT check whether content fits its page — that is
 * validate.js's job, and it requires a real browser layout engine (it
 * cannot run under JSDOM). Call validate.js after render() in the editor
 * preview and before print.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaDrinksDessertRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clearList(doc, listId) {
    const el = doc.querySelector('[data-list-id="' + listId + '"]');
    if (el) while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function isFilled(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }

  function formatPrice(raw) {
    var s = String(raw == null ? '' : raw).trim().replace(/^\$/, '');
    if (/\.00$/.test(s)) s = s.slice(0, -3);
    return s;
  }

  function renderCocktails(doc, items) {
    const list = clearList(doc, 'cocktails');
    if (!list) return;
    const tpl = doc.getElementById('cocktail-item-template');
    const blueprint = tpl && tpl.content.firstElementChild;
    if (!blueprint) throw new Error('Missing #cocktail-item-template blueprint.');
    (items || []).forEach(function (it) {
      const node = blueprint.cloneNode(true);
      node.setAttribute('data-item-id', it.id);
      node.querySelector('.cocktail-name').textContent = it.name;
      node.querySelector('.cocktail-price').textContent = formatPrice(it.price);
      node.querySelector('.cocktail-desc').textContent = it.desc || '';
      const noteEl = node.querySelector('.cocktail-note');
      if (isFilled(it.note)) {
        noteEl.textContent = it.note;
      } else {
        noteEl.remove();
      }
      list.appendChild(node);
    });
  }

  function renderPlainList(doc, listId, items) {
    const list = clearList(doc, listId);
    if (!list) return;
    const tpl = doc.getElementById('plain-item-template');
    const blueprint = tpl && tpl.content.firstElementChild;
    if (!blueprint) throw new Error('Missing #plain-item-template blueprint.');
    (items || []).forEach(function (it) {
      const node = blueprint.cloneNode(true);
      node.setAttribute('data-item-id', it.id);
      node.querySelector('.item-name').textContent = it.name;
      node.querySelector('.item-price').textContent = formatPrice(it.price);
      list.appendChild(node);
    });
  }

  function renderDescriptiveList(doc, listId, items) {
    const list = clearList(doc, listId);
    if (!list) return;
    const tpl = doc.getElementById('descriptive-item-template');
    const blueprint = tpl && tpl.content.firstElementChild;
    if (!blueprint) throw new Error('Missing #descriptive-item-template blueprint.');
    (items || []).forEach(function (it) {
      const node = blueprint.cloneNode(true);
      node.setAttribute('data-item-id', it.id);
      node.querySelector('.item-name').textContent = it.name;
      node.querySelector('.item-price').textContent = formatPrice(it.price);
      const descEl = node.querySelector('.item-desc');
      if (isFilled(it.desc)) {
        descEl.textContent = it.desc;
      } else {
        descEl.remove();
      }
      list.appendChild(node);
    });
  }

  function renderDolci(doc, items) {
    const list = clearList(doc, 'dolci');
    if (!list) return;
    const tpl = doc.getElementById('dolci-item-template');
    const blueprint = tpl && tpl.content.firstElementChild;
    if (!blueprint) throw new Error('Missing #dolci-item-template blueprint.');
    (items || []).forEach(function (it) {
      const node = blueprint.cloneNode(true);
      node.setAttribute('data-item-id', it.id);
      node.querySelector('.dolci-name').textContent = it.name;
      node.querySelector('.dolci-price').textContent = formatPrice(it.price);
      node.querySelector('.dolci-desc').textContent = it.desc || '';
      list.appendChild(node);
    });
  }

  function render(doc, data) {
    data = data || {};
    const spirits = data.spirits || {};
    const dopaCena = data.dopaCena || {};

    renderCocktails(doc, data.cocktails);

    renderPlainList(doc, 'spirits-bourbon', spirits.bourbon);
    renderPlainList(doc, 'spirits-scotch', spirits.scotch);
    renderPlainList(doc, 'spirits-beer', spirits.beer);

    renderDescriptiveList(doc, 'dopacena-digestivo', dopaCena.digestivo);
    renderDescriptiveList(doc, 'dopacena-grappa', dopaCena.grappa);
    renderDescriptiveList(doc, 'dopacena-ports', dopaCena.ports);
    renderDescriptiveList(doc, 'dopacena-cognac', dopaCena.cognac);
    renderDescriptiveList(doc, 'dopacena-traditionalItalian', dopaCena.traditionalItalian);

    renderDolci(doc, data.dolci);
  }

  return { render: render };
});
