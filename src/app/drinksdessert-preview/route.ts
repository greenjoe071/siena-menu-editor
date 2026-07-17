import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/drinksdessert-menu-store';
import { renderDrinksDessertMenu } from '@/lib/render-drinksdessert-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-drinksdessert');

// ?src=current (default) | draft | drinksdessert-published-<ts>
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, validateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
  ]);

  let html = await renderDrinksDessertMenu(data);
  // Strip the template's self-contained validate.js <script> (it points at a
  // relative path that doesn't resolve here); we inject render + validate inline.
  html = html.replace(/<script src="validate\.js"><\/script>/g, '');

  const liveScript = `<script>
${renderSrc}
${validateSrc}
var _dd_R = window.SienaDrinksDessertRender;
var _dd_V = window.SienaDrinksDessertValidate;
var _dd_timer = null;
function _dd_runValidate() {
  _dd_V.waitForLayout(document).then(function () {
    var report = _dd_V.validate(document);
    window.parent.postMessage({ type: 'SIENA_DRINKSDESSERT_VALIDATE_RESULT', report: report }, '*');
  });
}
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SIENA_DRINKSDESSERT_UPDATE') {
    try {
      _dd_R.render(document, e.data.payload);
      clearTimeout(_dd_timer);
      _dd_timer = setTimeout(_dd_runValidate, 120);
    } catch (err) { console.warn('Drinks & Dessert render error', err); }
  }
});
document.fonts.ready.then(function () { _dd_runValidate(); });
</script>`;

  html = html.replace('</body>', liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
