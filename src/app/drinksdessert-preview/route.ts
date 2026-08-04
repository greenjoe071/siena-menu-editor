import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/drinksdessert-menu-store';
import { renderDrinksDessertMenu } from '@/lib/render-drinksdessert-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-drinksdessert');

// ?src=current (default) | draft | drinksdessert-published-<ts>
// ?spritzDesign=a|b — forces the Spritz card to one design regardless of
// data.spritz.design, for the editor's "choose your design" comparison
// screen (two of these iframes side by side, one forced to each design).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const src = params.get('src');
  const spritzDesign = params.get('spritzDesign');
  const opts: { spritzDesign?: 'a' | 'b' } | undefined =
    spritzDesign === 'a' || spritzDesign === 'b' ? { spritzDesign: spritzDesign as 'a' | 'b' } : undefined;
  const [data, renderSrc, validateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
  ]);

  let html = await renderDrinksDessertMenu(data, opts);
  // Strip the template's self-contained validate.js <script> (it points at a
  // relative path that doesn't resolve here); we inject render + validate inline.
  html = html.replace(/<script src="validate\.js"><\/script>/g, '');

  const liveScript = `<script>
${renderSrc}
${validateSrc}
var _dd_R = window.SienaDrinksDessertRender;
var _dd_V = window.SienaDrinksDessertValidate;
var _dd_timer = null;
var _dd_forceDesign = new URLSearchParams(location.search).get('spritzDesign');
var _dd_renderOpts = (_dd_forceDesign === 'a' || _dd_forceDesign === 'b') ? { spritzDesign: _dd_forceDesign } : undefined;
function _dd_runValidate() {
  _dd_V.waitForLayout(document).then(function () {
    var report = _dd_V.validate(document);
    window.parent.postMessage({ type: 'SIENA_DRINKSDESSERT_VALIDATE_RESULT', report: report }, '*');
  });
}
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SIENA_DRINKSDESSERT_UPDATE') {
    try {
      _dd_R.render(document, e.data.payload, _dd_renderOpts);
      clearTimeout(_dd_timer);
      _dd_timer = setTimeout(_dd_runValidate, 120);
    } catch (err) { console.warn('Drinks & Dessert render error', err); }
  } else if (e.data && e.data.type === 'SIENA_DRINKSDESSERT_EDITING') {
    // Tighter Dopa Cena subsection spacing while a field in that panel has
    // focus (template.html's is-editing rules). validate.js always strips
    // this class before measuring, so it never affects the fit check.
    document.body.classList.toggle('is-editing', !!e.data.editing);
  }
});
document.fonts.ready.then(function () { _dd_runValidate(); });
</script>`;

  // Use a function replacer so `$` sequences in the injected JS (e.g. render.js's
  // "'$' + it.price") are inserted literally, not treated as replacement patterns.
  html = html.replace('</body>', () => liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
