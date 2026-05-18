/**
 * Siena Happy Hour Renderer — JSON → HTML hydrator.
 *
 * Mutates the template DOM in place. Does NOT regenerate structure,
 * CSS, or any of the static chrome (masthead, footer, section labels,
 * "The Specials · Bar Area Only" eyebrow, gold ornaments, etc.).
 * If this file changes, the snapshot test must still pass.
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
 * Data shape — see menu-data.json for the realistic seed:
 *
 *   {
 *     "hh_specials": [ { "id": "hh-1", "price": "4",  "label": "Bud & Miller Lites" }, ... 5 total ],
 *     "small_plates": [ { "id": "sp-1", "name": "...", "price": "6",  "desc": "..." }, ... 10 total ],
 *     "cocktails":   [ { "id": "ck-1", "name": "...", "hh_price": "10", "reg_price": "13",
 *                        "desc": "...",
 *                        "floater_text": "",   // optional — when empty, floater line is removed
 *                        "floater_price": "" }, ... 8 total ],
 *     "wines":       [ { "id": "wn-1", "name": "...", "glass_price": "10", "bottle_price": "40" }, ... 8 total ],
 *     "beers":       [ { "id": "br-1", "name": "...", "price": "6.50" }, ... 10 total ],
 *     "promo":       { "body": "Tuesday Nights at the Bar", "headline": "$10 Signature Cocktails" }
 *   }
 *
 * Cardinality is FIXED per section (5/10/8/8/10) and the editor must not
 * add or remove items. Slots are matched by id, so reordering the array
 * has no effect on the printed output.
 *
 * Prices are stored as digits-only strings ("4", "10", "6.50"). The "$"
 * glyph and the "/" between glass/bottle prices are baked into the
 * template and are not addressable here.
 *
 * The only optional fields are per-cocktail `floater_text` and
 * `floater_price`. When `floater_text` is empty/missing, the entire
 * `[data-floater-for="ck-N"]` block is removed for that cocktail.
 * When `floater_text` is present but `floater_price` is empty, the
 * "$XX" suffix is removed and only the text shows.
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

  // ── single-price item renderers ───────────────────────────────────

  function renderHhSpecial(doc, item) {
    if (!item || !item.id) return;
    setText(doc, item.id + '-price', isFilled(item.price) ? item.price : '');
    setText(doc, item.id + '-label', isFilled(item.label) ? item.label : '');
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

  // ── dual-price item renderers ─────────────────────────────────────

  function renderCocktail(doc, item) {
    if (!item || !item.id) return;
    setText(doc, item.id + '-name',      isFilled(item.name)      ? item.name      : '');
    setText(doc, item.id + '-hh-price',  isFilled(item.hh_price)  ? item.hh_price  : '');
    setText(doc, item.id + '-reg-price', isFilled(item.reg_price) ? item.reg_price : '');
    setText(doc, item.id + '-desc',      isFilled(item.desc)      ? item.desc      : '');

    // Floater (optional). Empty floater_text → remove the entire floater row.
    const floater = doc.querySelector('[data-floater-for="' + item.id + '"]');
    if (!floater) return;

    if (!isFilled(item.floater_text)) {
      floater.remove();
      return;
    }

    setText(doc, item.id + '-floater-text', item.floater_text);

    // Floater price empty → drop the "$XX" suffix but keep the text.
    const priceEl = floater.querySelector('.floater-price');
    if (isFilled(item.floater_price)) {
      setText(doc, item.id + '-floater-price', item.floater_price);
    } else if (priceEl) {
      priceEl.remove();
    }
  }

  function renderWine(doc, item) {
    if (!item || !item.id) return;
    setText(doc, item.id + '-name',         isFilled(item.name)         ? item.name         : '');
    setText(doc, item.id + '-glass-price',  isFilled(item.glass_price)  ? item.glass_price  : '');
    setText(doc, item.id + '-bottle-price', isFilled(item.bottle_price) ? item.bottle_price : '');
  }

  // ── promo ─────────────────────────────────────────────────────────

  function renderPromo(doc, promo) {
    if (!promo) return;
    if (isFilled(promo.body))     setText(doc, 'promo-body',     promo.body);
    if (isFilled(promo.headline)) setText(doc, 'promo-headline', promo.headline);
  }

  // ── top-level ─────────────────────────────────────────────────────

  function renderEach(doc, list, renderer) {
    if (!Array.isArray(list)) return;
    for (const item of list) renderer(doc, item);
  }

  function render(doc, data) {
    if (!data) return;
    renderEach(doc, data.hh_specials, renderHhSpecial);
    renderEach(doc, data.small_plates, renderSmallPlate);
    renderEach(doc, data.cocktails,    renderCocktail);
    renderEach(doc, data.wines,        renderWine);
    renderEach(doc, data.beers,        renderBeer);
    renderPromo(doc, data.promo);
  }

  return { render };
});
