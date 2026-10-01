import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import type { CourseMenuData } from './coursemenu-schema';

export const COURSEMENU_HANDOFF = join(process.cwd(), 'handoff-coursemenu');

type Renderer = { render: (doc: Document, data: CourseMenuData) => void };

async function loadRenderer(): Promise<Renderer> {
  const src = await readFile(join(COURSEMENU_HANDOFF, 'render.js'), 'utf8');
  const fakeRoot: Record<string, unknown> = {};
  const mod = { exports: {} as Partial<Renderer> };
  // eslint-disable-next-line no-new-func
  new Function('module', 'self', src)(mod, fakeRoot);
  return (mod.exports.render ? mod.exports : fakeRoot['SienaCourseMenuRender']) as Renderer;
}

export async function renderCourseMenu(data: CourseMenuData): Promise<string> {
  const [template, renderer] = await Promise.all([
    readFile(join(COURSEMENU_HANDOFF, 'template.html'), 'utf8'),
    loadRenderer(),
  ]);
  const dom = new JSDOM(template);
  renderer.render(dom.window.document, data);
  return '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML;
}
