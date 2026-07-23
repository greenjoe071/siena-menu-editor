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
// alt takes priority over src — an alternate always merges onto the CURRENT
// (published) default, never the draft, since alternates are for live event use.
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

  const liveScript = `<script>
${renderSrc}
${validateSrc}
var _pd_R = window.SienaPrivateDiningRender;
var _pd_V = window.SienaPrivateDiningValidate;
var _pd_timer = null;
function _pd_runValidate() {
  _pd_R.applyTitleWrapAdjustment(document);
  _pd_V.waitForLayout(document).then(function () {
    var report = _pd_V.validate(document);
    window.parent.postMessage({ type: 'SIENA_PRIVATEDINING_VALIDATE_RESULT', report: report }, '*');
  });
}
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SIENA_PRIVATEDINING_UPDATE') {
    try {
      _pd_R.render(document, e.data.payload);
      clearTimeout(_pd_timer);
      _pd_timer = setTimeout(_pd_runValidate, 120);
    } catch (err) { console.warn('Private Dining render error', err); }
  }
});
document.fonts.ready.then(function () { _pd_runValidate(); });
</script>`;

  html = html.replace('</body>', () => liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
