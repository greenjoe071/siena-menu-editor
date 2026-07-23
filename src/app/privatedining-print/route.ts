import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getMenuDraftPublish, readAlternates } from '@/lib/privatedining-menu-store';
import { renderPrivateDiningMenu, buildPrivateDiningRenderData } from '@/lib/render-privatedining-server';
import { PRIVATEDINING_MENU_IDS, type PrivateDiningMenuId } from '@/lib/privatedining-schema';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-privatedining');

function isValidMenuId(id: string | null): id is PrivateDiningMenuId {
  return !!id && (PRIVATEDINING_MENU_IDS as readonly string[]).includes(id);
}

// ?menu=firenze (required) &src=current|draft (default current) &alt=<alternateId>
export async function GET(request: Request) {
  const url = new URL(request.url);
  const menuId = url.searchParams.get('menu');
  if (!isValidMenuId(menuId)) {
    return new Response('Unknown or missing ?menu=', { status: 404 });
  }
  const src = url.searchParams.get('src');
  const altId = url.searchParams.get('alt');

  const dp = getMenuDraftPublish(menuId);
  const menuData = altId ? await dp.readMenuBySrc('current') : await dp.readMenuBySrc(src);
  const alternate = altId ? (await readAlternates(menuId)).find((a) => a.id === altId) ?? null : null;

  const renderData = await buildPrivateDiningRenderData(menuData, alternate);
  const [html0, renderSrc, validateSrc] = await Promise.all([
    renderPrivateDiningMenu(renderData),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
  ]);

  let html = html0.replace(/<script src="validate\.js"><\/script>/g, '');

  // Print script: re-render from localStorage (the editor's full payload,
  // including the real eventTitle/eventDate/logoUrl this route can't see
  // via query params), re-measure title wrap, validate, then print.
  const printScript = `<script>
${renderSrc}
${validateSrc}
(function () {
  var raw = localStorage.getItem('siena-privatedining-print-data');
  if (raw) {
    try { (window.SienaPrivateDiningRender).render(document, JSON.parse(raw)); } catch (_) {}
    localStorage.removeItem('siena-privatedining-print-data');
  }

  var R = window.SienaPrivateDiningRender;
  var V = window.SienaPrivateDiningValidate;
  function doPrint() { setTimeout(function () { window.print(); }, 200); }
  document.fonts.ready.then(function () {
    R.applyTitleWrapAdjustment(document);
    V.waitForLayout(document).then(function () {
      V.validate(document); // safety-net measurement only — does not alter layout
      doPrint();
    });
  });
})();
</script>`;

  // Function replacer: any literal `$` in the injected JS must be inserted
  // verbatim, not interpreted as a String.replace pattern.
  html = html.replace('</body>', () => printScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
