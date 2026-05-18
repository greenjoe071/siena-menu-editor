import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

const HANDOFF = join(import.meta.dirname);

describe('Happy Hour menu snapshot', () => {
  it('renders seed data and matches expected-render.html', () => {
    const template = readFileSync(join(HANDOFF, 'template.html'), 'utf8');
    const renderSrc = readFileSync(join(HANDOFF, 'render.js'), 'utf8');
    const seedData = JSON.parse(readFileSync(join(HANDOFF, 'menu-data.json'), 'utf8'));
    const expected = readFileSync(join(HANDOFF, 'expected-render.html'), 'utf8');

    const dom = new JSDOM(template, { runScripts: 'dangerously' });
    const { window } = dom;
    new window.Function(renderSrc)();
    window.SienaHappyhourRender.render(window.document, seedData);

    expect(dom.serialize()).toBe(expected);
  });
});
