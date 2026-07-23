/**
 * Snapshot test — guards against formatting drift in the Private Dining
 * menu, plus pins the alternate-merge, optional-desc, and tier contracts.
 *
 * Resolves the handoff directory from this spec file's own location, not
 * the CWD — the test may run from the repo root.
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
  return (mod.exports && mod.exports.render) ? mod.exports : fakeRoot.SienaPrivateDiningRender;
}

async function loadMenuData() {
  return JSON.parse(await readFile(join(here, 'menu-data.json'), 'utf8'));
}

// The default (tier 0, no alternate) state for one menu, matching what
// expected-render.html was generated from.
function defaultRenderData(menu) {
  return {
    eventTitle: "Sample — Bob and Mary Smith's 50th Anniversary",
    eventDate: 'Sample — Saturday, June 14, 2026',
    logoUrl: null,
    extraCount: 0,
    courses: menu.courses,
  };
}

export async function runSnapshotTest() {
  const [template, expected, menuData, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    readFile(join(here, 'expected-render.html'), 'utf8'),
    loadMenuData(),
    loadRenderer(),
  ]);

  const menu = menuData.menus.find((m) => m.id === 'firenze');
  const dom = new JSDOM(template);
  renderer.render(dom.window.document, defaultRenderData(menu));
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
 * Optional-field coverage: a dish with no desc ('' or omitted) renders no
 * .dish-desc element (e.g. San Gimignano's "Chocolate Tort").
 */
export async function runOptionalDescTest() {
  const [template, menuData, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    loadMenuData(),
    loadRenderer(),
  ]);
  const menu = menuData.menus.find((m) => m.id === 'san-gimignano');
  const dom = new JSDOM(template);
  renderer.render(dom.window.document, defaultRenderData(menu));
  const dolciGroup = Array.from(dom.window.document.querySelectorAll('.course-group'))
    .find((g) => g.querySelector('.course-label').textContent === 'Dolci');
  const dish = dolciGroup.querySelector('.dish');
  if (dish.querySelector('.dish-desc')) {
    throw new Error('Chocolate Tort has no desc in seed data but rendered a .dish-desc element.');
  }
}

/**
 * Alternate merge: extraItems append to the right course, in order, and the
 * tier/extra-count attributes land correctly on .menu-page.
 */
export async function runAlternateMergeTest() {
  const [template, menuData, renderer] = await Promise.all([
    readFile(join(here, 'template.html'), 'utf8'),
    loadMenuData(),
    loadRenderer(),
  ]);
  const menu = menuData.menus.find((m) => m.id === 'san-gimignano');
  const alt = menu.alternates[0]; // 1 extra item -> tier 1
  const courses = renderer.buildCourses(menu, alt);
  const dom = new JSDOM(template);
  renderer.render(dom.window.document, {
    eventTitle: 'Test Event',
    eventDate: 'Test Date',
    logoUrl: null,
    extraCount: renderer.extraItemCount(alt),
    courses,
  });
  const page = dom.window.document.querySelector('.menu-page');
  if (page.dataset.tier !== '1') throw new Error('Expected tier 1 with 1 extra item, got ' + page.dataset.tier);
  if (page.dataset.extraCount !== '1') throw new Error('Expected extra-count 1, got ' + page.dataset.extraCount);
  const secondiGroup = Array.from(dom.window.document.querySelectorAll('.course-group'))
    .find((g) => g.querySelector('.course-label').textContent.includes('Secondi'));
  const names = Array.from(secondiGroup.querySelectorAll('.dish-name')).map((n) => n.textContent);
  if (names.at(-1) !== alt.extraItems[0].name) {
    throw new Error('Extra item was not appended to the targeted course in order.');
  }
}

/** Cap: no seed alternate exceeds 2 extra items total. */
export async function runCapTest() {
  const menuData = await loadMenuData();
  const renderer = await loadRenderer();
  for (const menu of menuData.menus) {
    for (const alt of menu.alternates) {
      if (renderer.extraItemCount(alt) > renderer.MAX_EXTRA_ITEMS) {
        throw new Error(`Alternate "${alt.name}" on ${menu.id} exceeds the ${renderer.MAX_EXTRA_ITEMS}-item cap.`);
      }
    }
  }
}

if (typeof globalThis.describe === 'function') {
  // eslint-disable-next-line no-undef
  describe('Siena Private Dining menu rendering', () => {
    // eslint-disable-next-line no-undef
    test('render(template, seedData) matches expected-render.html', async () => {
      await runSnapshotTest();
    });
    // eslint-disable-next-line no-undef
    test('dish with no desc renders no .dish-desc element', async () => {
      await runOptionalDescTest();
    });
    // eslint-disable-next-line no-undef
    test('alternate extraItems merge into the right course, in order, with correct tier', async () => {
      await runAlternateMergeTest();
    });
    // eslint-disable-next-line no-undef
    test('no seed alternate exceeds the 2-item cap', async () => {
      await runCapTest();
    });
  });
}
