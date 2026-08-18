import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

const HANDOFF = join(import.meta.dirname);

describe('ARW $50 Dinner Menu snapshot', () => {
  it('renders seed data and matches expected-render.html', () => {
    const template = readFileSync(join(HANDOFF, 'template.html'), 'utf8');
    const renderSrc = readFileSync(join(HANDOFF, 'render.js'), 'utf8');
    const seedData = JSON.parse(readFileSync(join(HANDOFF, 'menu-data.json'), 'utf8'));
    const expected = readFileSync(join(HANDOFF, 'expected-render.html'), 'utf8');

    const dom = new JSDOM(template, { runScripts: 'dangerously' });
    const { window } = dom;
    new window.Function(renderSrc)();
    window.SienaARWRender.render(window.document, seedData);

    expect(dom.serialize()).toBe(expected);
  });

  it('hides a slot when its name is cleared, with no gap left in the grid', () => {
    const template = readFileSync(join(HANDOFF, 'template.html'), 'utf8');
    const renderSrc = readFileSync(join(HANDOFF, 'render.js'), 'utf8');
    const seedData = JSON.parse(readFileSync(join(HANDOFF, 'menu-data.json'), 'utf8'));

    const dom = new JSDOM(template, { runScripts: 'dangerously' });
    const { window } = dom;
    new window.Function(renderSrc)();

    const data = structuredClone(seedData);
    data.courses.antipasti.items[3].name = '';
    data.courses.antipasti.items[3].desc = '';
    window.SienaARWRender.render(window.document, data);
    const doc = window.document;
    expect(doc.querySelector('[data-item-id="antipasti-4"]').style.display).toBe('none');
    expect(doc.querySelector('[data-grid="antipasti"]').style.gridTemplateColumns).toBe('repeat(2, 1fr)');
  });

  it('hides the whole course when every slot is cleared', () => {
    const template = readFileSync(join(HANDOFF, 'template.html'), 'utf8');
    const renderSrc = readFileSync(join(HANDOFF, 'render.js'), 'utf8');
    const seedData = JSON.parse(readFileSync(join(HANDOFF, 'menu-data.json'), 'utf8'));

    const dom = new JSDOM(template, { runScripts: 'dangerously' });
    const { window } = dom;
    new window.Function(renderSrc)();

    const data = structuredClone(seedData);
    data.courses.dolci.items.forEach(it => { it.name = ''; it.desc = ''; });
    window.SienaARWRender.render(window.document, data);
    expect(window.document.querySelector('[data-course-id="dolci"]').style.display).toBe('none');
  });

  it('removes the upcharge pill when upcharge is cleared', () => {
    const template = readFileSync(join(HANDOFF, 'template.html'), 'utf8');
    const renderSrc = readFileSync(join(HANDOFF, 'render.js'), 'utf8');
    const seedData = JSON.parse(readFileSync(join(HANDOFF, 'menu-data.json'), 'utf8'));

    const dom = new JSDOM(template, { runScripts: 'dangerously' });
    const { window } = dom;
    new window.Function(renderSrc)();

    const data = structuredClone(seedData);
    data.courses.antipasti.items[4].upcharge = '';
    window.SienaARWRender.render(window.document, data);
    expect(window.document.querySelector('[data-upcharge-wrap="antipasti-5"]').style.display).toBe('none');
  });
});
