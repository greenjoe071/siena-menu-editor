import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import type { ArwMenuData } from './arw-schema';

const HANDOFF = join(process.cwd(), 'handoff-arw');

export type ArwStyle = 'classic' | 'left-aligned';

const TEMPLATE_FILE: Record<ArwStyle, string> = {
  classic: 'template.html',
  'left-aligned': 'template-left-aligned.html',
};

export function isArwStyle(v: string | null): v is ArwStyle {
  return v === 'classic' || v === 'left-aligned';
}

async function loadRenderer() {
  const src = await readFile(join(HANDOFF, 'render.js'), 'utf8');
  const fakeRoot: Record<string, unknown> = {};
  const mod = { exports: {} as { render?: (doc: Document, data: ArwMenuData) => void } };
  // eslint-disable-next-line no-new-func
  new Function('module', 'self', src)(mod, fakeRoot);
  const renderer = (mod.exports && mod.exports.render)
    ? mod.exports
    : (fakeRoot['SienaARWRender'] as typeof mod.exports);
  return renderer;
}

export async function renderArwMenu(data: ArwMenuData, style: ArwStyle = 'classic'): Promise<string> {
  const [template, renderer] = await Promise.all([
    readFile(join(HANDOFF, TEMPLATE_FILE[style]), 'utf8'),
    loadRenderer(),
  ]);

  const dom = new JSDOM(template);
  renderer.render!(dom.window.document, data);
  return '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML;
}
