import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const HANDOFF = join(process.cwd(), 'handoff-privatedining');

export interface PrivateDiningRenderData {
  eventTitle: string;
  eventDate: string;
  logoUrl: string | null;
  extraCount: number;
  courses: Array<{ label: string; dishes: Array<{ name: string; desc?: string }> }>;
}

interface AlternateLike {
  extraItems: Array<{ courseIndex: number; name: string; desc?: string }>;
}

interface PrivateDiningRenderer {
  render: (doc: Document, data: PrivateDiningRenderData) => void;
  buildCourses: (
    menu: { courses: PrivateDiningRenderData['courses'] },
    alternate: AlternateLike | null,
  ) => PrivateDiningRenderData['courses'];
  extraItemCount: (alternate: AlternateLike | null) => number;
}

async function loadRenderer(): Promise<PrivateDiningRenderer> {
  const src = await readFile(join(HANDOFF, 'render.js'), 'utf8');
  const fakeRoot: Record<string, unknown> = {};
  const mod = { exports: {} as Partial<PrivateDiningRenderer> };
  // eslint-disable-next-line no-new-func
  new Function('module', 'self', src)(mod, fakeRoot);
  const renderer = (mod.exports && mod.exports.render)
    ? mod.exports
    : (fakeRoot['SienaPrivateDiningRender'] as Partial<PrivateDiningRenderer>);
  return renderer as PrivateDiningRenderer;
}

// Builds the render-ready payload for a menu's default content merged with
// an optional alternate — used for the initial (pre-localStorage) paint of
// the preview/print routes. eventTitle/eventDate/logoUrl are always blank
// here; they're print-time-only fields the client fills in from the editor's
// localStorage bridge, same pattern as every other menu.
export async function buildPrivateDiningRenderData(
  menu: { courses: PrivateDiningRenderData['courses'] },
  alternate: AlternateLike | null,
): Promise<PrivateDiningRenderData> {
  const renderer = await loadRenderer();
  return {
    eventTitle: '',
    eventDate: '',
    logoUrl: null,
    extraCount: renderer.extraItemCount(alternate),
    courses: renderer.buildCourses(menu, alternate),
  };
}

// Renders the DEFAULT (server-side, no live title-wrap measurement) state.
// JSDOM cannot measure real text layout, so the title is always rendered
// as if it fits on one line here — the client-side preview/print script
// re-measures with applyTitleWrapAdjustment() in a real browser before
// printing. This mirrors how validate.js's fit-check is also browser-only.
export async function renderPrivateDiningMenu(data: PrivateDiningRenderData): Promise<string> {
  const [template, renderer] = await Promise.all([
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
    loadRenderer(),
  ]);

  const dom = new JSDOM(template);
  renderer.render(dom.window.document, data);
  return '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML;
}
