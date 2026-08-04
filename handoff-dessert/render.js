/**
 * Siena Desserts Menu Renderer.
 *
 * Hydrates the single dessert card from a JSON data object. The card
 * prints two-up on one 8.5x11 sheet — two IDENTICAL copies side by side
 * (data-copy-id="1"/"2") — so render() writes the SAME `data.desserts`
 * array into BOTH [data-list-id] containers ("dessert-1", "dessert-2")
 * every time it runs. There is only one data set; the two copies can
 * never drift out of sync because they're never stored separately.
 *
 * Cardinality is OPEN-ENDED — this renderer clears each list container
 * and clones the `#dessert-item-template` blueprint once per JSON item,
 * in array order. The page title ("Dolci") is static template chrome and
 * is never touched here — see BUILD-SPEC.md "Static / not editable".
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
 * (e.g. "11.00", "8.00") — this card never prints a `$`. The renderer
 * also formats for display: a trailing ".00" is dropped ("11.00" ->
 * "11"), any other cents are kept as-is ("6.50" stays "6.50"). Don't
 * pre-strip ".00" in the JSON yourself — store full precision, let
 * formatPrice() below handle display.
 *
 * Every field (name, desc, price) is required on every item — unlike
 * Cocktails' optional `note` or Dopa Cena's optional `desc`, there is no
 * optional field on this card.
 *
 * This module does NOT check whether content fits the card — that is
 * validate.js's job, and it requires a real browser layout engine (it
 * cannot run under JSDOM). Call validate.js after render() in the editor
 * preview and before print.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaDessertRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var COPY_LIST_IDS = ['dessert-1', 'dessert-2'];

  function clearList(doc, listId) {
    const el = doc.querySelector('[data-list-id="' + listId + '"]');
    if (el) while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function formatPrice(raw) {
    var s = String(raw == null ? '' : raw).trim().replace(/^\$/, '');
    if (/\.00$/.test(s)) s = s.slice(0, -3);
    return s;
  }

  function renderItem(blueprint, it) {
    const node = blueprint.cloneNode(true);
    node.setAttribute('data-item-id', it.id);
    node.querySelector('.dessert-name').textContent = it.name;
    node.querySelector('.dessert-price').textContent = formatPrice(it.price);
    node.querySelector('.dessert-desc').textContent = it.desc;
    return node;
  }

  function render(doc, data) {
    data = data || {};
    const items = data.desserts || [];
    const tpl = doc.getElementById('dessert-item-template');
    const blueprint = tpl && tpl.content.firstElementChild;
    if (!blueprint) throw new Error('Missing #dessert-item-template blueprint.');

    COPY_LIST_IDS.forEach(function (listId) {
      const list = clearList(doc, listId);
      if (!list) return;
      items.forEach(function (it) { list.appendChild(renderItem(blueprint, it)); });
    });
  }

  return { render: render };
});
