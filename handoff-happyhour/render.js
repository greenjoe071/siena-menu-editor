/**
 * Siena Happy Hour Renderer — v2 (layout-budget model)
 *
 * JSON → HTML hydrator. Mutates the template DOM in place. Does NOT
 * regenerate structure or CSS. If this file changes, the snapshot
 * test must still pass.
 *
 * Usage (browser):
 *   const doc = new DOMParser().parseFromString(templateHtml, 'text/html');
 *   SienaHappyhourRender.render(doc, menuData);
 *
 * Usage (node, for tests):
 *   const { JSDOM } = require('jsdom');
 *   const dom = new JSDOM(templateHtml, { runScripts: 'dangerously' });
 *   new dom.window.Function(renderSrc)();
 *   dom.window.SienaHappyhourRender.render(dom.window.document, menuData);
 *
 * Data shape — see menu-data.json:
 *
 *   {
 *     "hh_specials":  [ { "id": "hh-1", "price": "$4",  "label": "Bud Light\nMiller Lite" }, ... 5 ],
 *     "small_plates": [ { "id": "sp-1", "name": "...",  "price": "$6",  "desc": "..." }, ... 10 ],
 *     "cocktails":    [ { "id": "ck-1", "name": "...",  "hh_price": "$10", "reg_price": "$13",
 *                         "desc": "...", "floater": "" }, ... 8 ],
 *     "wines":        [ { "id": "wn-1", "name": "...",  "glass_price": "10", "bottle_price": "40" }, ... 8 ],
 *     "beers":        [ { "id": "br-1", "name": "...",  "price": "6.50" }, ... 10 ],
 *     "promo":        { "eyebrow": "Tuesday Nights at the Bar",
 *                       "headline": "$10 Signature Cocktails" }
 *   }
 *
 * IMPORTANT — v2 model changes from v1:
 *   - Prices are stored as the user sees them (including $ where shown).
 *     "$" is NOT applied by the renderer.
 *   - HH strip labels support newlines (`\n`) which render as <br>.
 *     This is the ONLY way to get a two-line label like "Bud Light /
 *     Miller Lite" — split on \n in your data.
 *   - Cocktail floater is a SINGLE plain-text string (not text+price).
 *     The leading "+" is template chrome. Empty → row removed.
 *   - Promo headline auto-detects a leading "$XX" token and wraps it
 *     in <span class="price"> for the gold accent. Pure plain text
 *     elsewhere renders without the accent. The editor types one
 *     plain string ("$10 Signature Cocktails") and the visual styling
 *     is applied here.
 *   - No per-field character caps in the data model. Validation is
 *     done by `validate.js` against the rendered page height.
 *
 * Cardinality is FIXED per section (5/10/8/8/10). Slots are matched
 * by `id`, so reordering the array has no effect on the printed output.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaHappyhourRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isFilled(v) {
    return v != null && String(v).trim() !== '';
  }

  function setText(doc, textId, value) {
    const els = doc.querySelectorAll('[data-text-id="' + textId + '"]');
    for (const el of els) {
      el.textContent = String(value);
    }
  }

  // Set content on a `data-html-id` slot, building DOM nodes rather
  // than assigning innerHTML — this prevents HTML injection from
  // user-supplied text while still allowing newlines (→ <br>) for
  // labels.
  function setLabelLines(doc, htmlId, value) {
    const el = doc.querySelector('[data-html-id="' + htmlId + '"]');
    if (!el) return;
    // Clear
    while (el.firstChild) el.removeChild(el.firstChild);
    const lines = String(value).split('\n');
    lines.forEach((line, i) => {
      if (i > 0) el.appendChild(doc.createElement('br'));
      el.appendChild(doc.createTextNode(line));
    });
  }

  // Promo headline: wrap ALL "$XX" or "$XX.XX" tokens in <span class="price">
  // for the gold accent. Works whether there is one price token or several
  // (e.g. "$5 house wines and $10 premium wines"). Everything between the
  // price tokens renders as plain text.
  function setPromoHeadline(doc, value) {
    const el = doc.querySelector('[data-html-id="promo-headline"]');
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);

    const str = String(value);
    // Split on every $XX / $XX.XX token; the capture group keeps the tokens.
    const parts = str.split(/(\$\d+(?:\.\d+)?)/);
    for (const part of parts) {
      if (/^\$\d+(?:\.\d+)?$/.test(part)) {
        const span = doc.createElement('span');
        span.className = 'price';
        span.textContent = part;
        el.appendChild(span);
      } else if (part) {
        el.appendChild(doc.createTextNode(part));
      }
    }
  }

  // ── item renderers ────────────────────────────────────────────────

  function renderHhSpecial(doc, item) {
    if (!item || !item.id) return;
    setText(doc, item.id + '-price', isFilled(item.price) ? item.price : '');
    setLabelLines(doc, item.id + '-label', isFilled(item.label) ? item.label : '');
  }

  function renderSmallPlate(doc, item) {
    if (!item || !item.id) return;
    setText(doc, item.id + '-name',  isFilled(item.name)  ? item.name  : '');
    setText(doc, item.id + '-price', isFilled(item.price) ? item.price : '');
    setText(doc, item.id + '-desc',  isFilled(item.desc)  ? item.desc  : '');
  }

  function renderBeer(doc, item) {
    if (!item || !item.id) return;
    setText(doc, item.id + '-name',  isFilled(item.name)  ? item.name  : '');
    setText(doc, item.id + '-price', isFilled(item.price) ? item.price : '');
  }

  function renderCocktail(doc, item) {
    if (!item || !item.id) return;
    setText(doc, item.id + '-name',      isFilled(item.name)      ? item.name      : '');
    setText(doc, item.id + '-hh-price',  isFilled(item.hh_price)  ? item.hh_price  : '');
    setText(doc, item.id + '-reg-price', isFilled(item.reg_price) ? item.reg_price : '');
    setText(doc, item.id + '-desc',      isFilled(item.desc)      ? item.desc      : '');

    const floater = doc.querySelector('[data-floater-for="' + item.id + '"]');
    if (!floater) return;
    if (!isFilled(item.floater)) {
      floater.remove();
      return;
    }
    setText(doc, item.id + '-floater', item.floater);
  }

  function renderWine(doc, item) {
    if (!item || !item.id) return;
    setText(doc, item.id + '-name',         isFilled(item.name)         ? item.name         : '');
    setText(doc, item.id + '-glass-price',  isFilled(item.glass_price)  ? item.glass_price  : '');
    setText(doc, item.id + '-bottle-price', isFilled(item.bottle_price) ? item.bottle_price : '');
  }

  function renderPromo(doc, promo) {
    if (!promo) return;
    if (isFilled(promo.eyebrow))  setText(doc, 'promo-eyebrow', promo.eyebrow);
    if (isFilled(promo.headline)) setPromoHeadline(doc, promo.headline);
  }

  function renderEach(doc, list, renderer) {
    if (!Array.isArray(list)) return;
    for (const item of list) renderer(doc, item);
  }

  function render(doc, data) {
    if (!data) return;
    renderEach(doc, data.hh_specials,  renderHhSpecial);
    renderEach(doc, data.small_plates, renderSmallPlate);
    renderEach(doc, data.cocktails,    renderCocktail);
    renderEach(doc, data.wines,        renderWine);
    renderEach(doc, data.beers,        renderBeer);
    renderPromo(doc, data.promo);
  }

  return { render };
});
