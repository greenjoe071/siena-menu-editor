import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readTuewedMenu } from '@/lib/tueswed-menu-store';
import { renderTuewedMenu } from '@/lib/render-tueswed-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-tueswed');

export async function GET() {
  const [data, renderSrc, validateSrc] = await Promise.all([
    readTuewedMenu(),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
  ]);

  let html = await renderTuewedMenu(data);

  const liveScript = `<script>
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
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SIENA_TUESWED_UPDATE') {
    try {
      (window.SienaTuewedRender || SienaTuewedRender).render(document, e.data.payload);
      clearTimeout(_tuewedValidateTimer);
      _tuewedValidateTimer = setTimeout(_tuewedRunValidate, 120);
    } catch(_) {}
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

  html = html.replace('</body>', liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
