/**
 * Snapshot + behavior tests — guards against formatting drift in the
 * Weekend Specials menu, plus pins the optional-dessert contract.
 *
 * Tests:
 *   1. render(template.html, menu-data.json) === expected-render.html
 *      (normalized to collapse whitespace).
 *   2. render(template.html, { …seed, dessert: null }) and the same with
 *      the `dessert` key omitted both produce DOM with no dessert section.
 *      render(template.html, seed) (dessert present) populates it.
 *
 * Runs under any modern test runner — examples below for Vitest and Node's
 * built-in test runner. Wire whichever fits your stack into CI.
 *
 * Install:
 *   npm i -D vitest jsdom
 * Or:
 *   npm i -D jsdom    # if using node --test
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const here = dirname(fileURLToPath(import.meta.url));

function normalize(html) {
  return html
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

async function loadRenderer() {
  // render.js is UMD. Evaluate it and grab the factory result.
  const src = await readFile(join(here, 'render.js'), 'utf8');
  const fakeRoot = {};
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'self', src)(mod, fakeRoot);
  return (mod.exports && mod.exports.render)
    ? mod.exports
    : fakeRoot.SienaWeekendRender;
}

export async function runSnapshotTest() {
  const [template, expected, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'expected-render.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);

  const data = JSON.parse(dataRaw);
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

/**
 * Coverage for the optional `dessert` key.
 *
 * When `data.dessert` is null / absent, the renderer MUST remove the entire
 * dessert section from the rendered DOM. This guards that contract so a
 * future edit to render.js can't silently leave an empty dessert section
 * sitting on the menu.
 */
export async function runOptionalDessertTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);

  const baseData = JSON.parse(dataRaw);

  // Case 1: dessert: null → section removed.
  {
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, { ...baseData, dessert: null });
    const doc = dom.window.document;
    if (doc.querySelector('[data-section-id="dessert"]')) {
      throw new Error('dessert:null — dessert section still present in DOM.');
    }
    const html = doc.documentElement.outerHTML;
    if (html.includes(baseData.dessert.name)) {
      throw new Error('dessert:null — dessert dish name leaked into output.');
    }
    if (html.includes(baseData.dessert.title)) {
      throw new Error('dessert:null — dessert section title leaked into output.');
    }
  }

  // Case 2: dessert key omitted entirely → section removed.
  {
    const { dessert: _drop, ...noDessert } = baseData;
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, noDessert);
    if (dom.window.document.querySelector('[data-section-id="dessert"]')) {
      throw new Error('dessert key omitted — dessert section still present in DOM.');
    }
  }

  // Case 3: dessert present → section rendered with the data.
  {
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, baseData);
    const section = dom.window.document.querySelector('[data-section-id="dessert"]');
    if (!section) throw new Error('dessert present — section missing from DOM.');
    const name = section.querySelector('.dish-name')?.textContent;
    const price = section.querySelector('.dish-price')?.textContent;
    if (name !== baseData.dessert.name) {
      throw new Error('dessert present — name mismatch. got: ' + JSON.stringify(name));
    }
    if (price !== baseData.dessert.price) {
      throw new Error('dessert present — price mismatch. got: ' + JSON.stringify(price));
    }
  }
}

/**
 * Coverage for the centered-orphan classes.
 *
 * An odd dish count (1 or 3) must stamp the grid with `cnt-1` / `cnt-3` so the
 * lone dish centers instead of stranding in the left column. Even counts (2, 4)
 * get a bare `dish-grid` class. This guards the orphan-centering contract.
 */
export async function runOrphanClassTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);

  const renderWith = (items) => {
    const data = {
      ...base,
      sections: { ...base.sections, starters: { ...base.sections.starters, items } },
    };
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, data);
    return dom.window.document
      .querySelector('[data-section-id="starters"] .dish-grid')
      .className;
  };

  const cases = [
    [1, 'dish-grid cnt-1'],
    [2, 'dish-grid'],
    [3, 'dish-grid cnt-3'],
    [4, 'dish-grid'],
  ];
  for (const [n, expectedClass] of cases) {
    const items = base.sections.starters.items.slice(0, n);
    const got = renderWith(items);
    if (got !== expectedClass) {
      throw new Error(
        `orphan class — ${n} dishes expected className ${JSON.stringify(expectedClass)}, got ${JSON.stringify(got)}.`
      );
    }
  }
}

// Vitest / Jest style
if (typeof globalThis.describe === 'function') {
  // eslint-disable-next-line no-undef
  describe('Siena Weekend Specials menu rendering', () => {
    // eslint-disable-next-line no-undef
    test('render(template, seedData) matches expected-render.html', async () => {
      await runSnapshotTest();
    });
    // eslint-disable-next-line no-undef
    test('dessert section is fully removed when data.dessert is absent or null', async () => {
      await runOptionalDessertTest();
    });
    // eslint-disable-next-line no-undef
    test('odd dish counts (1, 3) stamp cnt-1 / cnt-3 for orphan centering', async () => {
      await runOrphanClassTest();
    });
  });
}

// node --test style (auto-detected when run directly)
if (process.argv[1] && process.argv[1].endsWith(fileURLToPath(import.meta.url).split('/').pop())) {
  Promise.all([runSnapshotTest(), runOptionalDessertTest(), runOrphanClassTest()])
    .then(() => { console.log('✓ Weekend menu snapshot + optional-dessert + orphan-class tests passed.'); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
