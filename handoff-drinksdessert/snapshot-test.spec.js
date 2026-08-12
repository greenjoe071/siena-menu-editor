/**
 * Snapshot test — guards against formatting drift in the Drinks menu,
 * plus pins the optional-field contract (cocktail note) and the Spritz
 * Menu's shared-data/dual-design contract.
 *
 * Resolves the handoff directory from this spec file's own location, not
 * the CWD — the test may run from the repo root.
 *
 * Install:
 *   npm i -D vitest jsdom
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  const src = await readFile(join(here, 'render.js'), 'utf8');
  const fakeRoot = {};
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'self', src)(mod, fakeRoot);
  return (mod.exports && mod.exports.render) ? mod.exports : fakeRoot.SienaDrinksDessertRender;
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
      'If this drift is INTENTIONAL, regenerate expected-render.html with the ' +
      'same render pipeline (see BUILD-SPEC.md) and commit it. Otherwise revert.'
    );
  }
}

/**
 * Optional-field coverage:
 *   - cocktails[i].note missing/empty → .cocktail-note element removed.
 *   - cocktails[i].note present → .cocktail-note element renders it.
 * Spirits & Beer and Liquori items have NO optional/description field —
 * name and price only, always. There is nothing to toggle there.
 */
export async function runOptionalFieldsTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);

  const dom = new JSDOM(template);
  renderer.render(dom.window.document, base);
  const godfather = dom.window.document.querySelector('[data-item-id="ck-1"]');
  if (godfather.querySelector('.cocktail-note')) {
    throw new Error('cocktail ck-1 has no `note` in seed data but rendered a .cocktail-note element.');
  }
  const margarita = dom.window.document.querySelector('[data-item-id="ck-7"]');
  const noteEl = margarita.querySelector('.cocktail-note');
  if (!noteEl || noteEl.textContent !== base.cocktails[6].note) {
    throw new Error('cocktail ck-7 note did not render correctly.');
  }
}

/**
 * Open-ended cardinality: adding/removing items from any open-ended list
 * (Cocktails, Spirits, Spritz) must not throw and must change the
 * rendered item count 1:1. Liquori is intentionally excluded — its four
 * lists are hand-curated, not open-ended editor input (see BUILD-SPEC §1c).
 */
export async function runCardinalityTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);

  const trimmed = JSON.parse(JSON.stringify(base));
  trimmed.spirits.beer = trimmed.spirits.beer.slice(0, 3);
  const dom1 = new JSDOM(template);
  renderer.render(dom1.window.document, trimmed);
  const count1 = dom1.window.document.querySelectorAll('[data-list-id="spirits-beer"] .item').length;
  if (count1 !== 3) throw new Error('Removing beers did not shrink the rendered list to 3 (got ' + count1 + ').');

  const grown = JSON.parse(JSON.stringify(base));
  grown.spirits.beer.push({ id: 'sp-be-extra', name: 'Test Lager', price: '9.00' });
  const dom2 = new JSDOM(template);
  renderer.render(dom2.window.document, grown);
  const count2 = dom2.window.document.querySelectorAll('[data-list-id="spirits-beer"] .item').length;
  if (count2 !== base.spirits.beer.length + 1) {
    throw new Error('Adding a beer did not grow the rendered list (got ' + count2 + ').');
  }
}

/**
 * Liquori: four fixed categories (Tequila, Gin, Vodka, Rum), each a plain
 * name+price list like Spirits & Beer — no description field. Confirms
 * render.js wires all four `liquori.*` arrays to their `liquori-*` lists.
 */
export async function runLiquoriTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);
  const dom = new JSDOM(template);
  renderer.render(dom.window.document, base);

  ['tequila', 'gin', 'vodka', 'rum'].forEach((cat) => {
    const rendered = dom.window.document.querySelectorAll('[data-list-id="liquori-' + cat + '"] .item').length;
    if (rendered !== base.liquori[cat].length) {
      throw new Error('liquori.' + cat + ' did not render 1:1 (expected ' + base.liquori[cat].length + ', got ' + rendered + ').');
    }
  });

  const first = dom.window.document.querySelector('[data-list-id="liquori-tequila"] .item');
  if (first.querySelector('.item-desc') || first.querySelector('.cocktail-desc')) {
    throw new Error('A Liquori item rendered a description element — Liquori has no desc field.');
  }
}

/**
 * Spritz Menu — one shared data set drives both designs; category only
 * sorts Design B; render() accepts a spritzDesign override for the
 * "choose your design" comparison screen.
 */
export async function runSpritzTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);

  // Design A ignores category — flat list has every item, in array order.
  {
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, base, { spritzDesign: 'a' });
    const flat = dom.window.document.querySelectorAll('[data-list-id="spritz-a"] .item');
    if (flat.length !== base.spritz.items.length) {
      throw new Error('Design A flat list did not render every spritz item.');
    }
    if (dom.window.document.body.classList.contains('spritz-design-b')) {
      throw new Error('spritzDesign "a" override left spritz-design-b on <body>.');
    }
  }

  // Design B groups the SAME items by category — total count matches,
  // and an item's category correctly places it in one group only.
  {
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, base, { spritzDesign: 'b' });
    if (!dom.window.document.body.classList.contains('spritz-design-b')) {
      throw new Error('spritzDesign "b" override did not set spritz-design-b on <body>.');
    }
    const groups = ['bright', 'herbal', 'earthy'];
    let total = 0;
    groups.forEach((cat) => {
      total += dom.window.document.querySelectorAll('[data-list-id="spritz-b-' + cat + '"] .item').length;
    });
    if (total !== base.spritz.items.length) {
      throw new Error('Design B grouped lists do not add up to the full item count (got ' + total + ').');
    }
    const firstBright = base.spritz.items.find((it) => it.category === 'bright');
    if (firstBright) {
      const el = dom.window.document.querySelector('[data-list-id="spritz-b-bright"] [data-item-id="' + firstBright.id + '"]');
      if (!el) throw new Error('A "bright" category item did not land in the spritz-b-bright group.');
    }
  }

  // Price prints WITH a $ — the one exception on this menu.
  {
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, base);
    const priceText = dom.window.document.querySelector('.spritz-price-text').textContent;
    if (priceText !== '$' + base.spritz.price) {
      throw new Error('Spritz price did not render with a $ prefix (got "' + priceText + '").');
    }
  }
}

if (typeof globalThis.describe === 'function') {
  // eslint-disable-next-line no-undef
  describe('Siena Drinks & Dessert menu rendering', () => {
    // eslint-disable-next-line no-undef
    test('render(template, seedData) matches expected-render.html', async () => {
      await runSnapshotTest();
    });
    // eslint-disable-next-line no-undef
    test('optional cocktail note renders only when filled', async () => {
      await runOptionalFieldsTest();
    });
    // eslint-disable-next-line no-undef
    test('open-ended list cardinality: add/remove items 1:1', async () => {
      await runCardinalityTest();
    });
    // eslint-disable-next-line no-undef
    test('Liquori: four fixed categories render 1:1, no description field', async () => {
      await runLiquoriTest();
    });
    // eslint-disable-next-line no-undef
    test('Spritz Menu: shared data drives both designs, category sorts design B only, $ price', async () => {
      await runSpritzTest();
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith('snapshot-test.spec.js')) {
  Promise.all([runSnapshotTest(), runOptionalFieldsTest(), runCardinalityTest(), runLiquoriTest(), runSpritzTest()])
    .then(() => { console.log('✓ Drinks menu snapshot + optional-field + cardinality + liquori + spritz tests passed.'); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
