import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/coursemenu-menu-store';
import { renderCourseMenu, COURSEMENU_HANDOFF } from '@/lib/render-coursemenu-server';
import { printWarnings, withPrintGuard } from '@/lib/print-warnings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, validateSrc, templateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(COURSEMENU_HANDOFF, 'render.js'), 'utf8'),
    readFile(join(COURSEMENU_HANDOFF, 'validate.js'), 'utf8'),
    readFile(join(COURSEMENU_HANDOFF, 'template.html'), 'utf8'),
  ]);

  let html = await renderCourseMenu(data);

  // render.js permanently removes nodes (unused course slots, empty add-on,
  // footer…), so each live update renders into a FRESH copy of the template
  // and swaps in its .page — re-rendering the current document can't bring a
  // removed course back (BUILD-SPEC §4).
  const safeTemplate = JSON.stringify(templateSrc).replace(/<\/script/gi, '<\\/script');

  const liveScript = `<script>
${renderSrc}
${validateSrc}
var _cmTpl = ${safeTemplate};
var _cmValidateTimer = null;

function _cmRunValidate() {
  SienaCourseMenuValidate.waitForLayout(document).then(function() {
    var report = SienaCourseMenuValidate.validate(document);
    window.parent.postMessage({ type: 'SIENA_COURSEMENU_VALIDATE_RESULT', report: report }, '*');
  });
}

function _cmApplyUpdate(payload) {
  var fresh = (new DOMParser()).parseFromString(_cmTpl, 'text/html');
  SienaCourseMenuRender.render(fresh, payload);
  var page = document.querySelector('.page');
  var newPage = fresh.querySelector('.page');
  if (page && newPage) page.replaceWith(document.importNode(newPage, true));
}

window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SIENA_COURSEMENU_UPDATE') {
    try {
      _cmApplyUpdate(e.data.payload);
      clearTimeout(_cmValidateTimer);
      _cmValidateTimer = setTimeout(_cmRunValidate, 120);
    } catch(_) {}
  }
});
document.fonts.ready.then(function() { _cmRunValidate(); });
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

  // Pre-print warnings (missing titles / prices) — see print-warnings.ts
  html = withPrintGuard(html, request.url, printWarnings('coursemenu', data));

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
