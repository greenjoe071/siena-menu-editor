import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';

const HANDOFF = join(import.meta.dirname);

function loadRenderer(window) {
  const renderSrc = readFileSync(join(HANDOFF, 'render.js'), 'utf8');
  new window.Function(renderSrc)();
  return window.SienaARWRender;
}

function freshDom(templateFile) {
  const template = readFileSync(join(HANDOFF, templateFile), 'utf8');
  const dom = new JSDOM(template, { runScripts: 'dangerously' });
  return { dom, SienaARWRender: loadRenderer(dom.window) };
}

const seedData = JSON.parse(readFileSync(join(HANDOFF, 'menu-data.json'), 'utf8'));

describe('ARW $50 Dinner Menu — Two-Column Classic snapshot', () => {
  let dom, SienaARWRender;

  beforeAll(() => {
    ({ dom, SienaARWRender } = freshDom('template.html'));
  });

  it('renders seed data identically to expected-render.html', () => {
    SienaARWRender.render(dom.window.document, seedData);
    const expected = readFileSync(join(HANDOFF, 'expected-render.html'), 'utf8');
    expect(dom.serialize()).toBe(expected);
  });
});

describe('ARW $50 Dinner Menu — Left-Aligned smoke test', () => {
  it('renders seed data without throwing, populates every field', () => {
    const { dom, SienaARWRender } = freshDom('template-left-aligned.html');
    SienaARWRender.render(dom.window.document, seedData);
    const doc = dom.window.document;
    expect(doc.querySelector('[data-text-id="subtitle"]').textContent).toBe(seedData.subtitle);
    expect(doc.querySelector('[data-text-id="cocktail-name"]').textContent).toBe(seedData.cocktail.name);
    expect(doc.querySelector('[data-text-id="antipasti-5-upcharge"]').textContent).toBe('10');
  });
});

describe('render() reflow + toggle behavior (both templates)', () => {
  it.each([['Two-Column Classic', 'template.html'], ['Left-Aligned', 'template-left-aligned.html']])(
    '%s: hides a slot when its name is cleared, with no gap left',
    (_label, templateFile) => {
      const { dom, SienaARWRender } = freshDom(templateFile);
      const data = structuredClone(seedData);
      data.courses.antipasti.items[3].name = ''; // Calamari removed -> 4 visible, even
      data.courses.antipasti.items[3].desc = '';
      SienaARWRender.render(dom.window.document, data);
      const doc = dom.window.document;
      expect(doc.querySelector('[data-item-id="antipasti-4"]').style.display).toBe('none');
      const grid = doc.querySelector('[data-grid="antipasti"]');
      if (grid) expect(grid.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    }
  );

  it.each([['Two-Column Classic', 'template.html'], ['Left-Aligned', 'template-left-aligned.html']])(
    '%s: hides the whole course when every slot is cleared',
    (_label, templateFile) => {
      const { dom, SienaARWRender } = freshDom(templateFile);
      const data = structuredClone(seedData);
      data.courses.dolci.items.forEach(it => { it.name = ''; it.desc = ''; });
      SienaARWRender.render(dom.window.document, data);
      expect(dom.window.document.querySelector('[data-course-id="dolci"]').style.display).toBe('none');
    }
  );

  it.each([['Two-Column Classic', 'template.html'], ['Left-Aligned', 'template-left-aligned.html']])(
    '%s: shows the upcharge pill for a slot that did NOT ship one in the static template (previously-missing DOM hook)',
    (_label, templateFile) => {
      const { dom, SienaARWRender } = freshDom(templateFile);
      const data = structuredClone(seedData);
      data.courses.antipasti.items[0].upcharge = '7'; // Pancetta — no upcharge in seed data or template
      SienaARWRender.render(dom.window.document, data);
      const doc = dom.window.document;
      const wrap = doc.querySelector('[data-upcharge-wrap="antipasti-1"]');
      expect(wrap).not.toBeNull();
      expect(wrap.style.display).not.toBe('none');
      expect(doc.querySelector('[data-text-id="antipasti-1-upcharge"]').textContent).toBe('7');
    }
  );

  it.each([['Two-Column Classic', 'template.html'], ['Left-Aligned', 'template-left-aligned.html']])(
    '%s: removes the upcharge pill when upcharge is cleared, and preserves the pill node across re-renders with a new desc',
    (_label, templateFile) => {
      const { dom, SienaARWRender } = freshDom(templateFile);
      const data1 = structuredClone(seedData);
      SienaARWRender.render(dom.window.document, data1);
      const doc = dom.window.document;
      expect(doc.querySelector('[data-upcharge-wrap="antipasti-5"]').style.display).not.toBe('none');

      const data2 = structuredClone(seedData);
      data2.courses.antipasti.items[4].desc = 'A totally different description';
      data2.courses.antipasti.items[4].upcharge = '';
      SienaARWRender.render(doc, data2);
      expect(doc.querySelector('[data-text-id="antipasti-5-desc"]').textContent.startsWith('A totally different description')).toBe(true);
      expect(doc.querySelector('[data-upcharge-wrap="antipasti-5"]').style.display).toBe('none');

      // Re-render again with the upcharge restored — the wrap node must still exist.
      SienaARWRender.render(doc, data1);
      const wrap = doc.querySelector('[data-upcharge-wrap="antipasti-5"]');
      expect(wrap).not.toBeNull();
      expect(wrap.style.display).not.toBe('none');
      expect(doc.querySelector('[data-text-id="antipasti-5-upcharge"]').textContent).toBe('10');
    }
  );

  it.each([['Two-Column Classic', 'template.html'], ['Left-Aligned', 'template-left-aligned.html']])(
    '%s: hides the whole cocktail block when cocktail.name is cleared',
    (_label, templateFile) => {
      const { dom, SienaARWRender } = freshDom(templateFile);
      const data = structuredClone(seedData);
      data.cocktail = { name: '', desc: '', price: '' };
      SienaARWRender.render(dom.window.document, data);
      expect(dom.window.document.querySelector('[data-cocktail-block]').style.display).toBe('none');
    }
  );

  it.each([['Two-Column Classic', 'template.html'], ['Left-Aligned', 'template-left-aligned.html']])(
    '%s: hides just the cocktail price when price is cleared, keeps name/desc',
    (_label, templateFile) => {
      const { dom, SienaARWRender } = freshDom(templateFile);
      const data = structuredClone(seedData);
      data.cocktail = { ...data.cocktail, price: '' };
      SienaARWRender.render(dom.window.document, data);
      const doc = dom.window.document;
      expect(doc.querySelector('[data-cocktail-block]').style.display).not.toBe('none');
      expect(doc.querySelector('[data-cocktail-price-wrap]').style.display).toBe('none');
      expect(doc.querySelector('[data-text-id="cocktail-name"]').textContent).toBe(seedData.cocktail.name);
    }
  );

  it('render() does not throw under JSDOM on a long multi-word description (orphan-fix bails out safely — see wordLineGroups guard)', () => {
    const { dom, SienaARWRender } = freshDom('template.html');
    const data = structuredClone(seedData);
    data.courses.entree.items[2].desc = 'A genuinely long description with plenty of words to exercise the orphan line fix logic safely';
    expect(() => SienaARWRender.render(dom.window.document, data)).not.toThrow();
  });
});
