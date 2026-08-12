/**
 * Siena Dessert Menu Renderer.
 *
 * Hydrates the two-card sheet — Dolci (left) and Siena Dopa Cena (right)
 * — from a JSON data object. These are TWO DIFFERENT cards sharing one
 * physical 8.5x11 sheet, not two identical copies of one card (that was
 * an earlier version of this package; if you find code assuming a
 * single `desserts` array rendered twice, it's stale).
 *
 * Cardinality is OPEN-ENDED on every list — this renderer clears each
 * `[data-list-id]` container and clones the matching `<template>`
 * blueprint once per JSON item, in array order. Page/subsection titles
 * are static template chrome and are never touched here. The Dolci
 * illustration (`.dolci-image`) is a static asset baked into
 * template.html, not a data field — see BUILD-SPEC.md \u00a76.
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
 * (e.g. "11.00", "8.00") — this menu never prints a `$` anywhere. The
 * renderer also formats for display: a trailing ".00" is dropped
 * ("11.00" -> "11"), any other cents are kept as-is ("6.50" stays
 * "6.50"). Don't pre-strip ".00" in the JSON yourself.
 *
 * Optional fields:
 *   - dopaCena.<sub>[i].sub — a one-line note under the name/price row
 *     (e.g. a grappa's producing region). Empty/missing removes the
 *     line entirely. ANY item in ANY Dopa Cena subsection may carry
 *     one; it is not reserved for a particular item.
 *
 * Dolci items have NO optional field — name, desc, price are all
 * required on every item.
 *
 * This module does NOT check whether content fits its card — that is
 * validate.js's job, and it requires a real browser layout engine (it
 * cannot run under JSDOM). Call validate.js after render() in the editor
 * preview and before print.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaDessertRender = factory();
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

  function renderDolci(doc, items) {
    const list = clearList(doc, 'dolci');
    if (!list) return;
    const tpl = doc.getElementById('dolci-item-template');
    const blueprint = tpl && tpl.content.firstElementChild;
    if (!blueprint) throw new Error('Missing #dolci-item-template blueprint.');
    (items || []).forEach(function (it) {
      const node = blueprint.cloneNode(true);
      node.setAttribute('data-item-id', it.id);
      node.querySelector('.dessert-name').textContent = it.name;
      node.querySelector('.dessert-price').textContent = formatPrice(it.price);
      node.querySelector('.dessert-desc').textContent = it.desc;
      list.appendChild(node);
    });
  }

  function renderDopaCenaList(doc, listId, items) {
    const list = clearList(doc, listId);
    if (!list) return;
    const tpl = doc.getElementById('dopacena-item-template');
    const blueprint = tpl && tpl.content.firstElementChild;
    if (!blueprint) throw new Error('Missing #dopacena-item-template blueprint.');
    (items || []).forEach(function (it) {
      const node = blueprint.cloneNode(true);
      node.setAttribute('data-item-id', it.id);
      node.querySelector('.item-name').textContent = it.name;
      node.querySelector('.item-price').textContent = formatPrice(it.price);
      const subEl = node.querySelector('.item-sub');
      if (isFilled(it.sub)) {
        subEl.textContent = it.sub;
      } else {
        subEl.remove();
      }
      list.appendChild(node);
    });
  }

  function render(doc, data) {
    data = data || {};
    const dopaCena = data.dopaCena || {};

    renderDolci(doc, data.dolci);

    renderDopaCenaList(doc, 'dopacena-digestivo', dopaCena.digestivo);
    renderDopaCenaList(doc, 'dopacena-grappa', dopaCena.grappa);
    renderDopaCenaList(doc, 'dopacena-ports', dopaCena.ports);
    renderDopaCenaList(doc, 'dopacena-cognac', dopaCena.cognac);
    renderDopaCenaList(doc, 'dopacena-traditionalItalian', dopaCena.traditionalItalian);
  }

  return { render: render };
});
