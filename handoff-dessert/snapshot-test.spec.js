/**
 * Snapshot test — guards against formatting drift on the Dessert sheet,
 * plus proves open-ended cardinality on both cards and the Dopa Cena
 * optional `sub` field contract.
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
 * Open-ended cardinality: adding/removing items from Dolci or any Dopa
 * Cena subsection must not throw and must change the rendered item
 * count 1:1. The two cards are independent — this does NOT test a
 * "both copies match" contract, because there are no copies anymore
 * (see BUILD-SPEC.md \u00a70).
 */
export async function runCardinalityTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);

  const trimmed = JSON.parse(JSON.stringify(base));
  trimmed.dolci = trimmed.dolci.slice(0, 2);
  const dom1 = new JSDOM(template);
  renderer.render(dom1.window.document, trimmed);
  const c1 = dom1.window.document.querySelectorAll('[data-list-id="dolci"] .item').length;
  if (c1 !== 2) throw new Error('Removing Dolci items did not shrink the list to 2 (got ' + c1 + ').');

  const grown = JSON.parse(JSON.stringify(base));
  grown.dopaCena.grappa.push({ id: 'dc-g-extra', name: 'Test Grappa', price: '20.00' });
  const dom2 = new JSDOM(template);
  renderer.render(dom2.window.document, grown);
  const c2 = dom2.window.document.querySelectorAll('[data-list-id="dopacena-grappa"] .item').length;
  if (c2 !== base.dopaCena.grappa.length + 1) {
    throw new Error('Adding a grappa did not grow the rendered list (got ' + c2 + ').');
  }
}

/**
 * Dopa Cena optional `sub` field: missing/empty -> no .item-sub element;
 * present on ANY item (not just the seed's Il Poggione) -> renders.
 */
export async function runOptionalSubTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);

  {
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, base);
    const aperol = dom.window.document.querySelector('[data-item-id="dc-d1"]');
    if (aperol.querySelector('.item-sub')) {
      throw new Error('dopaCena.digestivo[0] (Aperol) has no `sub` in seed data but rendered .item-sub.');
    }
  }
  {
    const withSub = JSON.parse(JSON.stringify(base));
    withSub.dopaCena.digestivo[0].sub = 'A test note';
    const dom = new JSDOM(template);
    renderer.render(dom.window.document, withSub);
    const aperol = dom.window.document.querySelector('[data-item-id="dc-d1"]');
    const subEl = aperol.querySelector('.item-sub');
    if (!subEl || subEl.textContent !== 'A test note') {
      throw new Error('Adding `sub` to an arbitrary dopaCena item did not render it.');
    }
  }
}

/** No `$` glyph anywhere on this menu, and trailing .00 is dropped for display. */
export async function runPriceFormatTest() {
  const [template, dataRaw, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'menu-data.json'), 'utf8'),
    loadRenderer(),
  ]);
  const base = JSON.parse(dataRaw);
  const dom = new JSDOM(template);
  renderer.render(dom.window.document, base);
  const prices = Array.from(dom.window.document.querySelectorAll('.dessert-price, .item-price')).map((el) => el.textContent);
  prices.forEach((p) => {
    if (p.includes('$')) throw new Error('A price rendered with a $ glyph ("' + p + '") — this menu never prints one.');
    if (p.endsWith('.00')) throw new Error('A price kept a trailing .00 ("' + p + '") — it should be dropped for display.');
  });
}

if (typeof globalThis.describe === 'function') {
  // eslint-disable-next-line no-undef
  describe('Siena Dessert menu rendering', () => {
    // eslint-disable-next-line no-undef
    test('render(template, seedData) matches expected-render.html', async () => {
      await runSnapshotTest();
    });
    // eslint-disable-next-line no-undef
    test('open-ended cardinality on Dolci and Dopa Cena subsections', async () => {
      await runCardinalityTest();
    });
    // eslint-disable-next-line no-undef
    test('Dopa Cena optional sub-note renders only when filled', async () => {
      await runOptionalSubTest();
    });
    // eslint-disable-next-line no-undef
    test('no $ glyph; trailing .00 dropped for display', async () => {
      await runPriceFormatTest();
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith('snapshot-test.spec.js')) {
  Promise.all([runSnapshotTest(), runCardinalityTest(), runOptionalSubTest(), runPriceFormatTest()])
    .then(() => { console.log('✓ Dessert menu snapshot + cardinality + optional-sub + price-format tests passed.'); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
