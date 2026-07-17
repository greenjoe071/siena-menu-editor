/**
 * Snapshot test — guards against formatting drift in the Drinks & Dessert
 * menu, plus pins the optional-field contracts (cocktail note, dopa-cena
 * per-item description).
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
 *   - dopaCena.<sub>[i].desc missing/empty → .item-desc element removed.
 *   - dopaCena.<sub>[i].desc present on an item OTHER than the seed's
 *     Il Poggione → still renders (proves desc is not hardcoded to one slot).
 */
export async function runOptionalFieldsTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);

  // Case 1: cocktail with no note → no .cocktail-note element.
  {
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

  // Case 2: dopa-cena item with no desc → no .item-desc element.
  {
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, base);
    const aperol = dom.window.document.querySelector('[data-item-id="dc-d1"]');
    if (aperol.querySelector('.item-desc')) {
      throw new Error('dopaCena.digestivo[0] (Aperol) has no `desc` in seed data but rendered .item-desc.');
    }
  }

  // Case 3: desc added to an item that normally has none → renders fine
  // (proves desc isn't hardcoded to the Il Poggione slot).
  {
    const withExtraDesc = JSON.parse(JSON.stringify(base));
    withExtraDesc.dopaCena.digestivo[0].desc = 'A test description';
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, withExtraDesc);
    const aperol = dom.window.document.querySelector('[data-item-id="dc-d1"]');
    const descEl = aperol.querySelector('.item-desc');
    if (!descEl || descEl.textContent !== 'A test description') {
      throw new Error('Adding `desc` to an arbitrary dopaCena item did not render it.');
    }
  }
}

/**
 * Open-ended cardinality: adding/removing items from any list must not
 * throw and must change the rendered item count 1:1.
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

if (typeof globalThis.describe === 'function') {
  // eslint-disable-next-line no-undef
  describe('Siena Drinks & Dessert menu rendering', () => {
    // eslint-disable-next-line no-undef
    test('render(template, seedData) matches expected-render.html', async () => {
      await runSnapshotTest();
    });
    // eslint-disable-next-line no-undef
    test('optional cocktail note / dopa-cena description render only when filled', async () => {
      await runOptionalFieldsTest();
    });
    // eslint-disable-next-line no-undef
    test('open-ended list cardinality: add/remove items 1:1', async () => {
      await runCardinalityTest();
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith('snapshot-test.spec.mjs')) {
  Promise.all([runSnapshotTest(), runOptionalFieldsTest(), runCardinalityTest()])
    .then(() => { console.log('✓ Drinks & Dessert menu snapshot + optional-field + cardinality tests passed.'); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
