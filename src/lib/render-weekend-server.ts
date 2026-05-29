import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import type { WeekendMenuData } from './weekend-schema';

const HANDOFF = join(process.cwd(), 'handoff-weekend');

async function loadRenderer() {
  const src = await readFile(join(HANDOFF, 'render.js'), 'utf8');
  const fakeRoot: Record<string, unknown> = {};
  const mod = { exports: {} as { render?: (doc: Document, data: WeekendMenuData) => void } };
  // eslint-disable-next-line no-new-func
  new Function('module', 'self', src)(mod, fakeRoot);
  const renderer = (mod.exports && mod.exports.render)
    ? mod.exports
    : (fakeRoot['SienaWeekendRender'] as typeof mod.exports);
  return renderer;
}

export async function renderWeekendMenu(data: WeekendMenuData): Promise<string> {
  const [template, renderer] = await Promise.all([
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
    loadRenderer(),
  ]);

  const dom = new JSDOM(template);
  // Data passes straight to the renderer — no toRendererData() transform needed.
  // Prices are stored with the $ glyph ("$17") and rendered verbatim by render.js.
  renderer.render!(dom.window.document, data);
  return '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML;
}
