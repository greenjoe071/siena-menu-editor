import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Siena Tueswed render snapshot', () => {
  it('matches expected-render.html', () => {
    const template = readFileSync(join(__dirname, 'template.html'), 'utf8');
    const renderSrc = readFileSync(join(__dirname, 'render.js'), 'utf8');
    const data = JSON.parse(readFileSync(join(__dirname, 'menu-data.json'), 'utf8'));
    const expected = readFileSync(join(__dirname, 'expected-render.html'), 'utf8');

    const dom = new JSDOM(template);
    const fakeRoot = {};
    const mod = { exports: {} };
    new Function('module', 'self', renderSrc)(mod, fakeRoot);
    const renderer = (mod.exports && mod.exports.render) ? mod.exports : fakeRoot['SienaTuewedRender'];
    renderer.render(dom.window.document, data);
    const result = '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML;
    expect(result).toBe(expected);
  });
});
