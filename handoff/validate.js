/**
 * Siena Spring Menu — Fit Validator (Oct 2026)  ·  UMD export: SienaSpringValidate
 *
 * HARD BLOCK. The editor runs this after every edit against the live preview;
 * if `report.fits === false`, Save is disabled and `report.problems` is shown.
 *
 * Checks:
 *   1. page-overflow — each of the 3 pages must fit on 8.5×11 with a SAFETY
 *      margin (default 6pt) to spare. Measured by laying the page out at its
 *      natural height (height:auto) — NOT scrollHeight: the pages use
 *      margin:auto slack absorbers and fixed height + overflow:hidden, so
 *      overflow would otherwise be silently clipped. Anything that grows a
 *      page (longer description, 8th pasta, new add-on item) is caught.
 *   2. addon-wrap — every add-on line (salad / pasta / steak): the label + items
 *      must stay on ONE printed line, and nothing may run past the page's text
 *      width. (The pasta block's "— or ask your server…" tail is allowed to sit
 *      on its own line below, as it does in the current design.) Measured from
 *      rendered geometry, never by character count.
 *   3. data rules (validateData) — Pasta may have at most 8 visible dishes;
 *      dishes may only be ADDED to Pasta.
 *
 * Needs a real layout engine (browser / editor iframe / Playwright).
 * JSDOM has no layout — do not run validate() under JSDOM.
 *
 *   await SienaSpringValidate.waitForLayout(doc);
 *   const report = SienaSpringValidate.validate(doc, { data: candidateData });
 *   // report = { fits, problems:[{type, page?, block?, section?, message}], pages:[…], addons:{…} }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaSpringValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PT = 96 / 72;
  const SAFETY_PT = 6;
  const PASTA_MAX = 8;
  const ADDABLE = { pasta: true };

  const PAGE_SECTIONS = [
    ['antipasti', 'zuppa-insalate', 'salad-addons'],
    ['pasta', 'pasta-addons', 'contorni'],
    ['secondi', 'steak-addons', 'non-alcoholic'],
  ];
  const LABELS = {
    'antipasti': 'Antipasti', 'zuppa-insalate': 'Zuppa e Insalate', 'pasta': 'Pasta',
    'contorni': 'Contorni', 'secondi': 'Secondi Piatti', 'non-alcoholic': 'Non-Alcoholic Beverages',
    'salad-addons': 'the "Add to any Salad" line', 'pasta-addons': 'the "Add to any pasta" line',
    'steak-addons': 'the "Add to any steak" line',
  };

  function waitForLayout(doc) {
    if (doc && doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') {
      return doc.fonts.ready.then(() => new Promise(r => setTimeout(r, 50)));
    }
    return Promise.resolve();
  }

  function sectionHeight(page, id) {
    let els;
    if (/-addons$/.test(id)) {
      els = page.querySelectorAll('[data-addons-block-id="' + id.replace('-addons', '') + '"]');
    } else if (id === 'non-alcoholic') {
      els = page.querySelectorAll('.drinks-panel');
    } else {
      els = page.querySelectorAll('[data-section-id="' + id + '"]');
    }
    let h = 0;
    els.forEach(e => { h += e.getBoundingClientRect().height; });
    return Math.round(h);
  }

  function checkPages(doc, safetyPt) {
    const pages = [].slice.call(doc.querySelectorAll('.page'));
    const safety = safetyPt * PT;
    return pages.map((page, i) => {
      const fixed = page.getBoundingClientRect().height;
      const prevH = page.style.height, prevO = page.style.overflow;
      page.style.height = 'auto';
      page.style.overflow = 'visible';
      const natural = page.getBoundingClientRect().height;
      page.style.height = prevH;
      page.style.overflow = prevO;

      const budget = fixed - safety;
      const overflowPx = Math.max(0, Math.ceil(natural - budget));
      const ids = PAGE_SECTIONS[i] || [];
      const sections = {};
      let worst = null, worstH = -1;
      ids.forEach(id => {
        const h = sectionHeight(page, id);
        sections[id] = h;
        if (h > worstH) { worstH = h; worst = id; }
      });
      return {
        page: i + 1, fits: overflowPx === 0, overflowPx,
        naturalPx: Math.round(natural), budgetPx: Math.round(budget),
        spareRoomPx: Math.max(0, Math.floor(budget - natural)),
        sections, worstSection: overflowPx ? worst : null,
      };
    });
  }

  function checkAddons(doc) {
    const out = {};
    doc.querySelectorAll('[data-addons-block-id]').forEach(block => {
      const id = block.getAttribute('data-addons-block-id');
      const cs = getComputedStyle(block);
      const br = block.getBoundingClientRect();
      const left = br.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth) - 1;
      const right = br.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) + 1;
      const parts = block.querySelectorAll('.addons-label, .addons-items, .addons-tail');
      let tooWide = false, maxH = 0;
      const rects = [];
      parts.forEach(p => {
        const isTail = p.classList.contains('addons-tail');
        [].slice.call(p.getClientRects()).forEach(r => {
          if (r.width === 0) return;
          if (r.left < left || r.right > right) tooWide = true;
          if (isTail) return; // the pasta tail may sit on its own line below (current design)
          rects.push(r);
          maxH = Math.max(maxH, r.height);
        });
      });
      // Two rects are on the same line if their vertical centers are within half a line.
      const lines = [];
      rects.forEach(r => {
        const c = (r.top + r.bottom) / 2;
        if (!lines.some(l => Math.abs(l - c) < maxH / 2)) lines.push(c);
      });
      const fits = lines.length <= 1 && !tooWide;
      out[id] = { fits, lines: lines.length, tooWide };
    });
    return out;
  }

  function validateData(data) {
    const problems = [];
    if (!data || !data.sections) return problems;
    const pasta = data.sections.pasta;
    if (pasta) {
      const visible = (pasta.items || []).filter(d => d.enabled !== false).length;
      if (visible > PASTA_MAX) {
        problems.push({ type: 'pasta-count', section: 'pasta',
          message: 'Pasta can show at most ' + PASTA_MAX + ' dishes. Hide one to save.' });
      }
    }
    return problems;
  }

  /** validateData + template ids: flag dishes added outside Pasta. */
  function validateAdds(doc, data) {
    const problems = [];
    if (!data || !data.sections || !doc) return problems;
    Object.keys(data.sections).forEach(sid => {
      if (ADDABLE[sid]) return;
      (data.sections[sid].items || []).forEach(d => {
        if (d.enabled === false) return;
        if (!doc.querySelector('[data-dish-id="' + d.id + '"]')) {
          problems.push({ type: 'add-not-allowed', section: sid,
            message: 'New dishes can only be added to Pasta. "' + (d.name || 'New dish') +
              '" can\u2019t be added to ' + (LABELS[sid] || sid) + '.' });
        }
      });
    });
    return problems;
  }

  function validate(doc, opts) {
    opts = opts || {};
    const safetyPt = opts.safetyPt != null ? opts.safetyPt : SAFETY_PT;
    const problems = [];
    if (!doc || !doc.querySelector('.page')) {
      return { fits: false, problems: [{ type: 'error', message: 'Menu preview not found.' }], pages: [], addons: {} };
    }
    const addons = checkAddons(doc);
    Object.keys(addons).forEach(id => {
      if (!addons[id].fits) problems.push({ type: 'addon-wrap', block: id,
        message: LABELS[id + '-addons'].replace(/^the /, 'The ') +
          ' is too long to fit on one line. Shorten a name, or hide or remove an item.' });
    });
    const pages = checkPages(doc, safetyPt);
    pages.forEach(p => {
      if (!p.fits) problems.push({ type: 'page-overflow', page: p.page, section: p.worstSection,
        message: 'Page ' + p.page + ' is too full. Shorten something on this page' +
          (p.worstSection ? ' \u2014 ' + LABELS[p.worstSection] + ' is the largest section there' : '') + '.' });
    });
    if (opts.data) {
      problems.push.apply(problems, validateData(opts.data));
      problems.push.apply(problems, validateAdds(doc, opts.data));
    }
    return { fits: problems.length === 0, problems, pages, addons };
  }

  function renderAndValidate(doc, data, renderFn, opts) {
    if (typeof renderFn === 'function') renderFn(doc, data);
    return waitForLayout(doc).then(() => validate(doc, Object.assign({ data }, opts || {})));
  }

  return { validate, validateData, waitForLayout, renderAndValidate, PASTA_MAX, SAFETY_PT };
});
