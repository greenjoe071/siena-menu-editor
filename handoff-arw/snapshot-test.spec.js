import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dir = path.dirname(fileURLToPath(import.meta.url));
const templateHtml = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');
const expectedHtml = fs.readFileSync(path.join(dir, 'expected-render.html'), 'utf8');
const menuData = JSON.parse(fs.readFileSync(path.join(dir, 'menu-data.json'), 'utf8'));

// render.js is a UMD module; loading it in a fresh JSDOM window exposes
// window.SienaARWRender without needing a bundler.
function loadRenderer(window) {
  const src = fs.readFileSync(path.join(dir, 'render.js'), 'utf8');
  window.eval(src);
  return window.SienaARWRender;
}

describe('SienaARWRender.render — snapshot', () => {
  let dom, SienaARWRender;

  beforeAll(() => {
    // runScripts: 'dangerously' is required for window.eval() in loadRenderer
    // to actually execute — without it jsdom silently no-ops eval and
    // window.SienaARWRender is left undefined.
    dom = new JSDOM(templateHtml, { runScripts: 'dangerously' });
    SienaARWRender = loadRenderer(dom.window);
  });

  it('renders the seed data identically to the frozen template (idempotent, matches baseline)', () => {
    SienaARWRender.render(dom.window.document, menuData);
    const rendered = dom.window.document.documentElement.outerHTML;
    const expectedDom = new JSDOM(expectedHtml);
    expect(normalize(rendered)).toBe(normalize(expectedDom.window.document.documentElement.outerHTML));
  });

  it('hides a slot when its name is cleared, with no gap left in the grid', () => {
    const data = structuredClone(menuData);
    data.courses.antipasti.items[3].name = ''; // Calamari removed -> 4 visible, even, no span needed
    data.courses.antipasti.items[3].desc = '';
    SienaARWRender.render(dom.window.document, data);
    const doc = dom.window.document;
    expect(doc.querySelector('[data-item-id="antipasti-4"]').style.display).toBe('none');
    expect(doc.querySelector('[data-grid="antipasti"]').style.gridTemplateColumns).toBe('repeat(2, 1fr)');
  });

  it('hides the whole course when every slot is cleared', () => {
    const data = structuredClone(menuData);
    data.courses.dolci.items.forEach(it => { it.name = ''; it.desc = ''; });
    SienaARWRender.render(dom.window.document, data);
    expect(dom.window.document.querySelector('[data-course-id="dolci"]').style.display).toBe('none');
  });

  it('removes the upcharge pill when upcharge is cleared', () => {
    const data = structuredClone(menuData);
    data.courses.antipasti.items[4].upcharge = '';
    SienaARWRender.render(dom.window.document, data);
    expect(dom.window.document.querySelector('[data-upcharge-wrap="antipasti-5"]').style.display).toBe('none');
  });

  it('shows an upcharge pill on a slot that has none by default, without corrupting its description (regression: upcharge-wrap must be a sibling of -desc, never nested inside it)', () => {
    const data = structuredClone(menuData);
    data.courses.antipasti.items[2].upcharge = '8'; // Meatballs — no upcharge in the approved menu
    SienaARWRender.render(dom.window.document, data);
    const doc = dom.window.document;
    expect(doc.querySelector('[data-upcharge-wrap="antipasti-3"]').style.display).toBe('');
    expect(doc.querySelector('[data-text-id="antipasti-3-upcharge"]').textContent).toBe('8');
    expect(doc.querySelector('[data-text-id="antipasti-3-desc"]').textContent)
      .toBe('Beef Meatballs, Whipped Ricotta, Italian Salsa Verde, Parmesan Cheese');
  });

  it('does not throw under JSDOM (regression: the orphan-line fix must no-op, not crash, when Range.getClientRects is unimplemented)', () => {
    expect(() => SienaARWRender.render(dom.window.document, menuData)).not.toThrow();
  });


  it('renders the featured cocktail from seed data', () => {
    SienaARWRender.render(dom.window.document, menuData);
    const doc = dom.window.document;
    expect(doc.querySelector('[data-text-id="cocktail-name"]').textContent).toBe(menuData.cocktail.name);
    expect(doc.querySelector('[data-text-id="cocktail-price"]').textContent).toBe(menuData.cocktail.price);
    expect(doc.querySelector('[data-cocktail-block]').style.display).toBe('');
  });

  it('hides the whole cocktail block when its name is cleared, and the price wrap when only price is cleared', () => {
    const data = structuredClone(menuData);
    data.cocktail.name = '';
    SienaARWRender.render(dom.window.document, data);
    expect(dom.window.document.querySelector('[data-cocktail-block]').style.display).toBe('none');

    const data2 = structuredClone(menuData);
    data2.cocktail.price = '';
    SienaARWRender.render(dom.window.document, data2);
    expect(dom.window.document.querySelector('[data-cocktail-price-wrap]').style.display).toBe('none');
  });
});

describe('SienaARWRender.render — Left-Aligned template (shared dataset contract)', () => {
  it('renders the same dataset into the Left-Aligned template with no code changes', () => {
    const laHtml = fs.readFileSync(path.join(dir, 'template-left-aligned.html'), 'utf8');
    const laDom = new JSDOM(laHtml, { runScripts: 'dangerously' });
    const LaRender = loadRenderer(laDom.window);
    LaRender.render(laDom.window.document, menuData);
    const doc = laDom.window.document;
    expect(doc.querySelector('[data-text-id="entree-6-name"]').textContent).toBe('Bistecca di Manzo');
    expect(doc.querySelector('[data-text-id="cocktail-name"]').textContent).toBe(menuData.cocktail.name);
    // Left-Aligned has no [data-grid] — layoutCourse must skip column math without throwing.
    expect(doc.querySelector('[data-grid="antipasti"]')).toBeNull();
    expect(doc.querySelector('[data-item-id="antipasti-1"]').style.display).toBe('');
  });
});

function normalize(html) {
  return html.replace(/\s+/g, ' ').trim();
}
