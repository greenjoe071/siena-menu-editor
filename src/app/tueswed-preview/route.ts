import { readMenuBySrc } from '@/lib/tueswed-menu-store';
import { loadTuewedPackage, renderTuewedMenu } from '@/lib/render-tueswed-server';
import { printWarnings, withPrintGuard } from '@/lib/print-warnings';
import type { TuewedMenuData } from '@/lib/tueswed-schema';

export const dynamic = 'force-dynamic';

// ?src=current (default) | draft | published-<ts>
// ?pkg=v3 forces the v3 package (the editor always edits in v3, even while
// the saved copy it opened is still an older v2 menu).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const data = await readMenuBySrc(params.get('src'));
  const forceV3 = params.get('pkg') === 'v3' && !data.special;
  const pkgData = (forceV3 ? { ...data, special: { label: '', title: '', price: '', desc: '' } } : data) as TuewedMenuData;
  const { template: templateSrc, renderSrc, validateSrc } = await loadTuewedPackage(pkgData);

  let html = await renderTuewedMenu(pkgData);

  // The template's screen body is a flex row, so in a preview pane narrower
  // than 8.5in the .page would SHRINK and the fit check would report false
  // overflow (same gotcha as Private Dining / Generic). Keep the page at full
  // width in the preview only — print is untouched.
  html = html.replace('</head>', '<style>@media screen{.page{flex-shrink:0}}</style></head>');

  // render.js removes optional nodes (add-on, empty description lines) when
  // their data is empty, so every live update re-renders a FRESH copy of the
  // template and swaps it in — a field filled back in must come back.
  const safeTemplate = JSON.stringify(templateSrc).replace(/<\/script/gi, '<\\/script');

  const liveScript = `<script>
var _tpl = ${safeTemplate};
${renderSrc}
${validateSrc}
var _tuewedValidateTimer = null;

function _tuewedRunValidate() {
  var Validate = window.SienaTuewedValidate || SienaTuewedValidate;
  Validate.waitForLayout(document).then(function() {
    var report = Validate.validate(document);
    window.parent.postMessage({ type: 'SIENA_TUESWED_VALIDATE_RESULT', report: report }, '*');
  });
}

function _tuewedApplyUpdate(payload) {
  var fresh = (new DOMParser()).parseFromString(_tpl, 'text/html');
  (window.SienaTuewedRender || SienaTuewedRender).render(fresh, payload);
  var y = window.scrollY;
  var btn = document.querySelector('.preview-print-btn');
  document.body.innerHTML = fresh.body.innerHTML;
  if (btn) document.body.appendChild(btn);
  window.scrollTo(0, y);
}

window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SIENA_TUESWED_UPDATE') {
    try {
      _tuewedApplyUpdate(e.data.payload);
      clearTimeout(_tuewedValidateTimer);
      _tuewedValidateTimer = setTimeout(_tuewedRunValidate, 120);
    } catch(err) { console.warn('render error', err); }
  }
});
// Run initial validation after fonts ready
document.fonts.ready.then(function() { _tuewedRunValidate(); });
</script>
<style>
  .preview-print-btn {
    position: fixed;
    bottom: 28px;
    right: 28px;
    background: #059669;
    color: #fff;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 15px;
    font-weight: 700;
    padding: 13px 26px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(5,150,105,0.45);
    transition: background 0.15s, transform 0.1s;
    z-index: 999;
  }
  .preview-print-btn:hover { background: #047857; transform: translateY(-1px); }
  .preview-print-btn:active { transform: translateY(0); }
  @media print { .preview-print-btn { display: none; } }
</style>
<button class="preview-print-btn" onclick="window.print()">🖨 Print Menu</button>`;

  // Function replacer: `$` in the injected JS must be inserted literally.
  html = html.replace('</body>', () => liveScript + '\n</body>');

  // Pre-print warnings (missing titles / prices) — see print-warnings.ts
  html = withPrintGuard(html, request.url, printWarnings('tueswed', data));

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
