import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

const HANDOFF = join(import.meta.dirname);
const template = readFileSync(join(HANDOFF, 'template.html'), 'utf8');
const renderSrc = readFileSync(join(HANDOFF, 'render.js'), 'utf8');
const seed = () => JSON.parse(readFileSync(join(HANDOFF, 'menu-data.json'), 'utf8'));

function renderWith(data) {
  const dom = new JSDOM(template, { runScripts: 'dangerously' });
  new dom.window.Function(renderSrc)();
  dom.window.SienaCourseMenuRender.render(dom.window.document, data);
  return dom;
}

describe('Course menu snapshot', () => {
  it('renders seed data and matches expected-render.html', () => {
    const expected = readFileSync(join(HANDOFF, 'expected-render.html'), 'utf8');
    expect(renderWith(seed()).serialize()).toBe(expected);
  });

  it('removes unused course slots (2, 3, 4 courses)', () => {
    for (const n of [2, 3, 4]) {
      const d = seed();
      while (d.courses.length < n) d.courses.push({ id: 'course-' + (d.courses.length + 1), title: 'Dish', desc: 'Desc' });
      d.courses = d.courses.slice(0, n);
      const doc = renderWith(d).window.document;
      expect(doc.querySelectorAll('.course-body[data-course-slot]').length).toBe(n);
      expect(doc.querySelectorAll('.course-rule[data-course-slot]').length).toBe(n);
      const nums = [...doc.querySelectorAll('.course-num')].map((e) => e.textContent);
      expect(nums).toEqual(['I', 'II', 'III', 'IV'].slice(0, n));
    }
  });

  it('removes optional blocks when empty / disabled', () => {
    const d = seed();
    d.description = '';
    d.addon = { title: '' };
    d.footer.enabled = false;
    const doc = renderWith(d).window.document;
    expect(doc.querySelector('[data-hero-desc]')).toBeNull();
    expect(doc.querySelector('[data-addon]')).toBeNull();
    expect(doc.querySelector('[data-footnotes]')).toBeNull();
  });

  it('removes add-on price / note independently', () => {
    const d = seed();
    d.addon.price = '';
    d.addon.desc = '';
    const doc = renderWith(d).window.document;
    expect(doc.querySelector('[data-addon]')).not.toBeNull();
    expect(doc.querySelector('.addon-price')).toBeNull();
    expect(doc.querySelector('[data-text-id="addon-desc"]')).toBeNull();
  });
});
