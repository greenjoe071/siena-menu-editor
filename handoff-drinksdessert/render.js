/**
 * Siena Drinks Menu Renderer.
 *
 * Hydrates the 4-card template (Signature Cocktails, Spritz Menu, Spirits
 * & Beer, Liquori) from a JSON data object. Cardinality is OPEN-ENDED on
 * Cocktails, Spirits, and Spritz — this renderer clears each
 * `[data-list-id]` container and clones the matching `<template>`
 * blueprint once per JSON item, in array order. Liquori is the one
 * exception: see BUILD-SPEC.md §1c — its four category lists are curated
 * by hand (highest price to lowest, trimmed to fit), not open-ended
 * editor input. Page/subsection titles are static template chrome and
 * are never touched here — see BUILD-SPEC.md "Static / not editable".
 * Dolci is not part of this package — it's its own insert.
 *
 * SPRITZ MENU — one data set, two designs:
 *   data.spritz = { price: "12", design: "a"|"b", items: [{id,name,desc,category}] }
 * `render()` populates BOTH design's list containers from the same
 * `items` array every time (cheap — it's at most 12 items) and sets
 * `body`'s `spritz-design-b` class from `data.spritz.design`, UNLESS an
 * explicit override is passed as a 3rd argument: `render(doc, data, {
 * spritzDesign: "b" })`. The override lets the "choose your design"
 * screen mount two preview instances of the same data and force one to
 * each design for a side-by-side comparison, without needing two copies
 * of `data.spritz`. `category` is read by design B only (to group items)
 * and ignored entirely by design A — never omit it from an item though;
 * see BUILD-SPEC.md.
 *
 * Price convention EXCEPTION: every other price on this menu omits the
 * `$` glyph (see below). The Spritz price is the one deliberate
 * exception — it prints as `$12`, `$14`, etc. Don't "fix" this to match
 * the rest of the menu; it's an intentional owner decision for this page
 * only. See BUILD-SPEC.md §3.
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
 * (e.g. "13.00", "11") — the menu never prints a `$` anywhere except the
 * Spritz price. The renderer also formats for display: a trailing ".00"
 * is dropped ("13.00" → "13"), any other cents are kept as-is ("6.50"
 * stays "6.50"). Do not pre-strip ".00" in the JSON yourself — store
 * full precision, let `formatPrice()` below handle display.
 *
 * Optional fields:
 *   - cocktails[i].note        — empty/missing → the note line is removed.
 *   - spritz.items[i].desc     — tasting note, required (design A shows it
 *     under every name; design B does too, inside its category group).
 *
 * Liquori and Spirits & Beer items have NO description field — name and
 * price only, by design. Don't add a `desc` key to either; render.js has
 * no code path for it.
 *
 * SPRITZ HEADER — showNew / tagline (NOT part of this handoff's contract;
 * kept from the prior implementation per owner request, layered on top of
 * this redesign):
 *   data.spritz.showNew — boolean, default true. Toggles the "new" kicker
 *     above the Spritz Menu title. Hiding it collapses its own space (it's
 *     a flex-column child), so nothing below leaves a gap.
 *   data.spritz.tagline — free text, must stay on one line (see
 *     validate.js's spritz-tagline wrap check). Replaces the template's
 *     static fallback text.
 * This handoff's own template/BUILD-SPEC treat both as fixed static chrome
 * — don't remove this data-driven behavior when bringing in a future
 * handoff revision without checking with Joe first.
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

  // Spritz-only exception: DOES print the $ glyph. See file header.
  function formatSpritzPrice(raw) {
    return '$' + formatPrice(raw);
  }

  var SPRITZ_CATEGORIES = ['bright', 'herbal', 'earthy'];
  var SPRITZ_CATEGORY_LIST_ID = { bright: 'spritz-b-bright', herbal: 'spritz-b-herbal', earthy: 'spritz-b-earthy' };

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

  function renderSpritzItem(blueprint, it) {
    const node = blueprint.cloneNode(true);
    node.setAttribute('data-item-id', it.id);
    node.querySelector('.spritz-name').textContent = it.name;
    node.querySelector('.spritz-desc').textContent = it.desc || '';
    return node;
  }

  function renderSpritz(doc, spritz) {
    spritz = spritz || {};
    const items = spritz.items || [];
    const tpl = doc.getElementById('spritz-item-template');
    const blueprint = tpl && tpl.content.firstElementChild;
    if (!blueprint) throw new Error('Missing #spritz-item-template blueprint.');

    // "new" kicker — owner can retire it once the page stops being new. Not
    // part of this handoff's contract; added per owner request (see file
    // header). The header is a simple flex-column child, so hiding it
    // collapses its own space and everything below shifts up with no gap.
    const kickerEl = doc.querySelector('.spritz-kicker');
    if (kickerEl) kickerEl.style.display = spritz.showNew === false ? 'none' : '';

    // Tagline — owner-editable, but must always render on a single line
    // (see validate.js's spritz-tagline wrap check). Not part of this
    // handoff's contract; added per owner request.
    const taglineEl = doc.querySelector('.spritz-tagline');
    if (taglineEl) taglineEl.textContent = spritz.tagline || '';

    doc.querySelector('.spritz-price-text').textContent = formatSpritzPrice(spritz.price);

    // Design A: flat list, array order, category ignored.
    const flatList = clearList(doc, 'spritz-a');
    if (flatList) {
      items.forEach(function (it) { flatList.appendChild(renderSpritzItem(blueprint, it)); });
    }

    // Design B: grouped by category, fixed group order (bright/herbal/earthy).
    const groupLists = {};
    SPRITZ_CATEGORIES.forEach(function (cat) {
      groupLists[cat] = clearList(doc, SPRITZ_CATEGORY_LIST_ID[cat]);
    });
    items.forEach(function (it) {
      const cat = SPRITZ_CATEGORIES.indexOf(it.category) !== -1 ? it.category : 'bright';
      const list = groupLists[cat];
      if (list) list.appendChild(renderSpritzItem(blueprint, it));
    });
  }

  function render(doc, data, opts) {
    data = data || {};
    opts = opts || {};
    const spirits = data.spirits || {};
    const liquori = data.liquori || {};
    const spritz = data.spritz || {};

    renderCocktails(doc, data.cocktails);

    renderPlainList(doc, 'spirits-bourbon', spirits.bourbon);
    renderPlainList(doc, 'spirits-scotch', spirits.scotch);
    renderPlainList(doc, 'spirits-beer', spirits.beer);

    renderPlainList(doc, 'liquori-tequila', liquori.tequila);
    renderPlainList(doc, 'liquori-gin', liquori.gin);
    renderPlainList(doc, 'liquori-vodka', liquori.vodka);
    renderPlainList(doc, 'liquori-rum', liquori.rum);

    renderSpritz(doc, spritz);
    const design = opts.spritzDesign || spritz.design || 'a';
    if (doc.body) doc.body.classList.toggle('spritz-design-b', design === 'b');
  }

  return { render: render };
});
