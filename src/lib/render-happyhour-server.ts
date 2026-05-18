import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import type { HappyhourMenuData } from './happyhour-schema';

const HANDOFF = join(process.cwd(), 'handoff-happyhour');

async function loadRenderer() {
  const src = await readFile(join(HANDOFF, 'render.js'), 'utf8');
  const fakeRoot: Record<string, unknown> = {};
  const mod = { exports: {} as { render?: (doc: Document, data: HappyhourMenuData) => void } };
  // eslint-disable-next-line no-new-func
  new Function('module', 'self', src)(mod, fakeRoot);
  const renderer = (mod.exports && mod.exports.render)
    ? mod.exports
    : (fakeRoot['SienaHappyhourRender'] as typeof mod.exports);
  return renderer;
}

export async function renderHappyhourMenu(data: HappyhourMenuData): Promise<string> {
  const [template, renderer] = await Promise.all([
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
    loadRenderer(),
  ]);

  const dom = new JSDOM(template);
  renderer.render!(dom.window.document, data);
  return '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML;
}
