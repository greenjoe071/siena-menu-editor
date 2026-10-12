import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { tuewedHandoffDir, type TuewedMenuData } from './tueswed-schema';

// v3 menus (with the Tuesdays Only box) use handoff-tueswed/; older v2 menus
// (e.g. Past Menus saved before Oct 2026) keep using handoff-tueswed-v2/ so
// they print exactly as they always did.

async function loadRenderer(dir: string) {
  const src = await readFile(join(dir, 'render.js'), 'utf8');
  const fakeRoot: Record<string, unknown> = {};
  const mod = { exports: {} as { render?: (doc: Document, data: TuewedMenuData) => void } };
  // eslint-disable-next-line no-new-func
  new Function('module', 'self', src)(mod, fakeRoot);
  const renderer = (mod.exports && mod.exports.render)
    ? mod.exports
    : (fakeRoot['SienaTuewedRender'] as typeof mod.exports);
  return renderer;
}

/** The handoff files (template, render.js, validate.js) for this menu's shape. */
export async function loadTuewedPackage(data: TuewedMenuData) {
  const dir = join(process.cwd(), tuewedHandoffDir(data));
  const [template, renderSrc, validateSrc] = await Promise.all([
    readFile(join(dir, 'template.html'), 'utf8'),
    readFile(join(dir, 'render.js'), 'utf8'),
    readFile(join(dir, 'validate.js'), 'utf8'),
  ]);
  return { dir, template, renderSrc, validateSrc };
}

export async function renderTuewedMenu(data: TuewedMenuData): Promise<string> {
  const dir = join(process.cwd(), tuewedHandoffDir(data));
  const [template, renderer] = await Promise.all([
    readFile(join(dir, 'template.html'), 'utf8'),
    loadRenderer(dir),
  ]);

  const dom = new JSDOM(template);
  renderer.render!(dom.window.document, data);
  return '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML;
}
