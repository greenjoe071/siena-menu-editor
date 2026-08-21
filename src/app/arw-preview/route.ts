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

  const liveScript = `<script>
${renderSrc}
${validateSrc}
var _arw_R = window.SienaARWRender;
var _arw_V = window.SienaARWValidate;
var _arw_style = ${JSON.stringify(style)};
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
document.fonts.ready.then(function () { _arw_runValidate(); });
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

  // Function replacer: `$` sequences in the injected JS (dollar prices,
  // regex, etc.) must be inserted literally, not treated as String.replace
  // special patterns — see project Known Bugs list.
  html = html.replace('</body>', () => liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
