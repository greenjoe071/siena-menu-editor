import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/dessert-menu-store';
import { renderDessertMenu } from '@/lib/render-dessert-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-dessert');

// ?src=current (default) | draft | dessert-published-<ts>
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, validateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
  ]);

  let html = await renderDessertMenu(data);
  // Strip the template's self-contained validate.js <script> (it points at a
  // relative path that doesn't resolve here); we inject render + validate inline.
  html = html.replace(/<script src="validate\.js"><\/script>/g, '');

  const liveScript = `<script>
${renderSrc}
${validateSrc}
var _ds_R = window.SienaDessertRender;
var _ds_V = window.SienaDessertValidate;
var _ds_timer = null;
function _ds_runValidate() {
  _ds_V.waitForLayout(document).then(function () {
    var report = _ds_V.validate(document);
    window.parent.postMessage({ type: 'SIENA_DESSERT_VALIDATE_RESULT', report: report }, '*');
  });
}
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SIENA_DESSERT_UPDATE') {
    try {
      _ds_R.render(document, e.data.payload);
      clearTimeout(_ds_timer);
      _ds_timer = setTimeout(_ds_runValidate, 120);
    } catch (err) { console.warn('Dessert render error', err); }
  }
});
document.fonts.ready.then(function () { _ds_runValidate(); });
</script>`;

  // Use a function replacer so `$` sequences in the injected JS are inserted
  // literally, not treated as replacement patterns.
  html = html.replace('</body>', () => liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
