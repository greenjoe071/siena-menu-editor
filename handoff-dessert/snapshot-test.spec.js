/**
 * Snapshot test — guards against formatting drift in the Desserts card,
 * plus proves the open-ended cardinality and the two-copy shared-data
 * contract (both printed halves always come from the same array, never
 * two separately stored lists).
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
  return (mod.exports && mod.exports.render) ? mod.exports : fakeRoot.SienaDessertRender;
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
 * Both printed copies must always match each other — they are the SAME
 * array rendered twice, never two independently stored lists.
 */
export async function runTwoCopyParityTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);

  const dom = new JSDOM(template);
  renderer.render(dom.window.document, base);
  const doc = dom.window.document;

  const items1 = Array.from(doc.querySelectorAll('[data-list-id="dessert-1"] .item'));
  const items2 = Array.from(doc.querySelectorAll('[data-list-id="dessert-2"] .item'));
  if (items1.length !== base.desserts.length || items2.length !== base.desserts.length) {
    throw new Error('Both copies must render every dessert item (got ' + items1.length + ' / ' + items2.length + ').');
  }
  for (let i = 0; i < base.desserts.length; i++) {
    const n1 = items1[i].querySelector('.dessert-name').textContent;
    const n2 = items2[i].querySelector('.dessert-name').textContent;
    if (n1 !== n2 || n1 !== base.desserts[i].name) {
      throw new Error('Copy 1 and copy 2 disagree at item ' + i + ' ("' + n1 + '" vs "' + n2 + '").');
    }
  }
}

/**
 * Open-ended cardinality: adding/removing items must not throw and must
 * change the rendered item count 1:1 in BOTH copies.
 */
export async function runCardinalityTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);

  const trimmed = JSON.parse(JSON.stringify(base));
  trimmed.desserts = trimmed.desserts.slice(0, 2);
  const dom1 = new JSDOM(template);
  renderer.render(dom1.window.document, trimmed);
  const c1a = dom1.window.document.querySelectorAll('[data-list-id="dessert-1"] .item').length;
  const c1b = dom1.window.document.querySelectorAll('[data-list-id="dessert-2"] .item').length;
  if (c1a !== 2 || c1b !== 2) throw new Error('Removing items did not shrink both copies to 2 (got ' + c1a + ' / ' + c1b + ').');

  const grown = JSON.parse(JSON.stringify(base));
  grown.desserts.push({ id: 'ds-extra', name: 'Test Panna Cotta', desc: 'A test description.', price: '9.00' });
  const dom2 = new JSDOM(template);
  renderer.render(dom2.window.document, grown);
  const c2a = dom2.window.document.querySelectorAll('[data-list-id="dessert-1"] .item').length;
  const c2b = dom2.window.document.querySelectorAll('[data-list-id="dessert-2"] .item').length;
  if (c2a !== base.desserts.length + 1 || c2b !== base.desserts.length + 1) {
    throw new Error('Adding an item did not grow both copies (got ' + c2a + ' / ' + c2b + ').');
  }
}

/** No `$` glyph anywhere on this card, and trailing .00 is dropped for display. */
export async function runPriceFormatTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);
  const dom = new JSDOM(template);
  renderer.render(dom.window.document, base);
  const prices = Array.from(dom.window.document.querySelectorAll('.dessert-price')).map((el) => el.textContent);
  prices.forEach((p) => {
    if (p.includes('$')) throw new Error('Dessert price rendered with a $ glyph ("' + p + '") — this card never prints one.');
    if (p.endsWith('.00')) throw new Error('Dessert price kept a trailing .00 ("' + p + '") — it should be dropped for display.');
  });
}

if (typeof globalThis.describe === 'function') {
  // eslint-disable-next-line no-undef
  describe('Siena Desserts menu rendering', () => {
    // eslint-disable-next-line no-undef
    test('render(template, seedData) matches expected-render.html', async () => {
      await runSnapshotTest();
    });
    // eslint-disable-next-line no-undef
    test('both printed copies always match — one shared data set', async () => {
      await runTwoCopyParityTest();
    });
    // eslint-disable-next-line no-undef
    test('open-ended list cardinality: add/remove items 1:1 in both copies', async () => {
      await runCardinalityTest();
    });
    // eslint-disable-next-line no-undef
    test('no $ glyph; trailing .00 dropped for display', async () => {
      await runPriceFormatTest();
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith('snapshot-test.spec.js')) {
  Promise.all([runSnapshotTest(), runTwoCopyParityTest(), runCardinalityTest(), runPriceFormatTest()])
    .then(() => { console.log('✓ Desserts menu snapshot + parity + cardinality + price-format tests passed.'); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
