import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readArwMenu } from '@/lib/arw-menu-store';
import { renderArwMenu, isArwStyle } from '@/lib/render-arw-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-arw');

// ?style=classic (default) | left-aligned — always renders the current live
// menu; this menu has no draft/publish flow, every save is immediate.
export async function GET(request: Request) {
  const styleParam = new URL(request.url).searchParams.get('style');
  const style = isArwStyle(styleParam) ? styleParam : 'classic';

  const [data, renderSrc, validateSrc] = await Promise.all([
    readArwMenu(),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
  ]);

  let html = await renderArwMenu(data, style);

  // The initial HTML above is server-rendered via jsdom, which can't measure
  // real layout — render.js's browser-only orphan-line word-gluing fix
  // (fixOrphans, needs getClientRects) silently no-ops there. Re-running
  // render() once client-side with the exact same data, right after fonts
  // load, ensures this preview (and its use as the style-picker's thumbnail)
  // always matches what actually prints — which already gets a real-browser
  // re-render via the localStorage bridge in arw-print/route.ts.
  const safeData = JSON.stringify(data).replace(/<\/script/gi, '<\\/script');

  const liveScript = `<script>
${renderSrc}
${validateSrc}
var _arw_R = window.SienaARWRender;
var _arw_V = window.SienaARWValidate;
var _arw_style = ${JSON.stringify(style)};
var _arw_initialData = ${safeData};
var _arw_timer = null;
function _arw_runValidate() {
  _arw_V.waitForLayout(document).then(function () {
    var report = _arw_V.validate(document);
    window.parent.postMessage({ type: 'SIENA_ARW_VALIDATE_RESULT', style: _arw_style, report: report }, '*');
  });
}
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SIENA_ARW_UPDATE') {
    try {
      _arw_R.render(document, e.data.payload);
      clearTimeout(_arw_timer);
      _arw_timer = setTimeout(_arw_runValidate, 120);
    } catch (err) { console.warn('ARW render error', err); }
  }
});
document.fonts.ready.then(function () {
  try { _arw_R.render(document, _arw_initialData); } catch (err) { console.warn('ARW initial render error', err); }
  _arw_runValidate();
});
</script>`;
// No floating "Print" button here on purpose — unlike other menus, /arw-preview
// is never opened as its own standalone tab (ARW has no MenuLanding "View"
// link). It's only ever embedded as an iframe: the style-picker's thumbnails
// (pointer-events: none, unclickable) and the editor's live preview pane. A
// button here would only ever be reachable inside that embedded iframe, where
// window.print() prints unreliably (inconsistent cross-browser handling of
// printing from within a same-origin iframe) — the editor's own "Print Menu"
// button (which uses the localStorage bridge into /arw-print) is the only
// supported way to print this menu. Do not re-add this button without also
// giving ARW a standalone preview-viewing route to attach it to.

  // Function replacer: `$` sequences in the injected JS (dollar prices,
  // regex, etc.) must be inserted literally, not treated as String.replace
  // special patterns — see project Known Bugs list.
  html = html.replace('</body>', () => liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
