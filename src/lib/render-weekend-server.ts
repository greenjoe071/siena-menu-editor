import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import type { WeekendMenuData } from './weekend-schema';

const HANDOFF = join(process.cwd(), 'handoff-weekend');

function combinedPrice(d: { price: string; price_label?: string; price2?: string; price2_label?: string }): string {
  if (d.price2) {
    const l1 = d.price_label  ? `${d.price_label} `  : '';
    const l2 = d.price2_label ? `${d.price2_label} ` : '';
    return `${l1}${d.price} / ${l2}${d.price2}`;
  }
  return d.price;
}

function toRendererData(data: WeekendMenuData) {
  const mapItems = (items: WeekendMenuData['sections']['starters']['items']) =>
    items.map(d => ({ ...d, price: combinedPrice(d) }));
  return {
    ...data,
    sections: {
      starters: { ...data.sections.starters, items: mapItems(data.sections.starters.items) },
      entrees:  { ...data.sections.entrees,  items: mapItems(data.sections.entrees.items) },
    },
  };
}

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
  renderer.render!(dom.window.document, toRendererData(data));
  return '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML;
}
