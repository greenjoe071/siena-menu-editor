/**
 * Snapshot + behavior tests — Siena Weekend Specials menu, v2.
 *
 * Tests:
 *   1. render(template.html, menu-data.json) === expected-render.html
 *      (normalized to collapse whitespace).
 *   2. Optional dessert: dessert:null and an omitted dessert key both remove
 *      the dessert section; a present dessert populates it.
 *   3. Last-5-words bind: descriptions of 8+ words get their last 5 words
 *      joined by U+00A0; shorter descriptions are untouched.
 *
 * Install:  npm i -D vitest jsdom      (or: npm i -D jsdom  for node --test)
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const here = join(import.meta.dirname);
const NBSP = '\u00A0';

function normalize(html) {
  return html
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

async function loadRenderer() {
  const src = await readFile(join(here, 'render.js'), 'utf8');
  const fakeRoot = {};
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'self', src)(mod, fakeRoot);
  return (mod.exports && mod.exports.render) ? mod.exports : fakeRoot.SienaWeekendRender;
}

async function loadAll() {
  const [template, expected, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'expected-render.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  return { template, expected, data: JSON.parse(dataRaw), renderer };
}

export async function runWeekendV2SnapshotTest() {
  const { template, expected, data, renderer } = await loadAll();
  const dom = new JSDOM(template);
  renderer.render(dom.window.document, data);
  const actual = '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML;
  const a = normalize(actual);
  const b = normalize(expected);
  if (a !== b) {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    const ctx = (s) => JSON.stringify(s.slice(Math.max(0, i - 80), i + 120));
    throw new Error(
      'Snapshot drift detected at character ' + i + '.\n' +
      '  rendered: ' + ctx(a) + '\n' +
      '  expected: ' + ctx(b) + '\n\n' +
      'If this drift is INTENTIONAL (you edited menu-data.json on purpose),\n' +
      'regenerate expected-render.html with the same render pipeline and commit it.\n' +
      'Otherwise: revert the change that broke formatting.'
    );
  }
}

export async function runWeekendV2OptionalDessertTest() {
  const { template, data: base, renderer } = await loadAll();

  {
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, { ...base, dessert: null });
    const doc = dom.window.document;
    if (doc.querySelector('[data-section-id="dessert"]')) throw new Error('dessert:null — dessert section still present in DOM.');
    const html = doc.documentElement.outerHTML;
    if (html.includes(base.dessert.name)) throw new Error('dessert:null — dessert dish name leaked into output.');
    if (html.includes(base.dessert.title)) throw new Error('dessert:null — dessert section title leaked into output.');
  }
  {
    const { dessert: _drop, ...noDessert } = base;
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, noDessert);
    if (dom.window.document.querySelector('[data-section-id="dessert"]')) throw new Error('dessert key omitted — dessert section still present in DOM.');
  }
  {
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, base);
    const section = dom.window.document.querySelector('[data-section-id="dessert"]');
    if (!section) throw new Error('dessert present — section missing from DOM.');
    const name = section.querySelector('.dish-name')?.textContent;
    const price = section.querySelector('.dish-price')?.textContent;
    if (name !== base.dessert.name) throw new Error('dessert present — name mismatch. got: ' + JSON.stringify(name));
    if (price !== base.dessert.price) throw new Error('dessert present — price mismatch. got: ' + JSON.stringify(price));
  }
}

export async function runWeekendV2LastWordsBindTest() {
  const { template, data: base, renderer } = await loadAll();
  const long = 'Pan-seared Hawaiian blue snapper, sweet corn and crab risotto, lemon butter sauce.';
  const short = 'Slow-braised veal shank, saffron risotto, gremolata.';
  const data = {
    ...base,
    sections: {
      ...base.sections,
      starters: { ...base.sections.starters, items: [
        { id: 't-long', name: 'Long', desc: long, price: '$1' },
        { id: 't-short', name: 'Short', desc: short, price: '$1' },
      ] },
    },
  };
  const dom = new JSDOM(template);
  renderer.render(dom.window.document, data);
  const get = (id) => dom.window.document.querySelector(`[data-dish-id="${id}"] .dish-desc`).textContent;

  const gotLong = get('t-long');
  const words = long.split(' ');
  const want = words.slice(0, -5).join(' ') + ' ' + words.slice(-5).join(NBSP);
  if (gotLong !== want) throw new Error('bind — long description not bound correctly. got: ' + JSON.stringify(gotLong));
  if (gotLong.split(NBSP).length !== 5) throw new Error('bind — expected exactly 4 no-break spaces.');

  const gotShort = get('t-short');
  if (gotShort !== short) throw new Error('bind — short (≤7 word) description should be untouched. got: ' + JSON.stringify(gotShort));

  // Stored data must not be mutated.
  if (data.sections.starters.items[0].desc !== long) throw new Error('bind — renderer mutated the input JSON.');
}

if (typeof globalThis.describe === 'function') {
  // eslint-disable-next-line no-undef
  describe('Siena Weekend Specials menu rendering (v2)', () => {
    // eslint-disable-next-line no-undef
    test('render(template, seedData) matches expected-render.html', async () => { await runWeekendV2SnapshotTest(); });
    // eslint-disable-next-line no-undef
    test('dessert section is fully removed when data.dessert is absent or null', async () => { await runWeekendV2OptionalDessertTest(); });
    // eslint-disable-next-line no-undef
    test('descriptions bind their last 5 words (8+ word descriptions only)', async () => { await runWeekendV2LastWordsBindTest(); });
  });
}

if (process.argv[1] && process.argv[1].endsWith('snapshot-test.spec.mjs')) {
  Promise.all([runWeekendV2SnapshotTest(), runWeekendV2OptionalDessertTest(), runWeekendV2LastWordsBindTest()])
    .then(() => { console.log('✓ Weekend v2 snapshot + optional-dessert + last-words-bind tests passed.'); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
