/**
 * Snapshot test — guards against formatting drift in the Weekend
 * Specials menu.
 *
 * Verifies: render(template.html, menu-data.json) === expected-render.html
 * (normalized to collapse whitespace).
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

// Vitest / Jest style
if (typeof globalThis.describe === 'function') {
  // eslint-disable-next-line no-undef
  describe('Siena Weekend Specials menu rendering', () => {
    // eslint-disable-next-line no-undef
    test('render(template, seedData) matches expected-render.html', async () => {
      await runSnapshotTest();
    });
  });
}

// node --test style (auto-detected when run directly)
if (process.argv[1] && process.argv[1].endsWith(fileURLToPath(import.meta.url).split('/').pop())) {
  runSnapshotTest()
    .then(() => { console.log('✓ Weekend menu snapshot test passed.'); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
