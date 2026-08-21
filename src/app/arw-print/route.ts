import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readArwMenu } from '@/lib/arw-menu-store';
import { renderArwMenu, isArwStyle } from '@/lib/render-arw-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-arw');

// ?style=classic (default) | left-aligned
export async function GET(request: Request) {
  const styleParam = new URL(request.url).searchParams.get('style');
  const style = isArwStyle(styleParam) ? styleParam : 'classic';

  const [data, renderSrc, validateSrc, templateSrc] = await Promise.all([
    readArwMenu(),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
    readFile(join(HANDOFF, style === 'classic' ? 'template.html' : 'template-left-aligned.html'), 'utf8'),
  ]);

  let html = await renderArwMenu(data, style);

  // Parse a fresh DOM from the raw template before applying the localStorage
  // payload, then swap it in — the same defensively-correct pattern used by
  // every print route on this project.
  const safeTemplate = JSON.stringify(templateSrc).replace(/<\/script/gi, '<\\/script');

  const printScript = `<script>
var _tpl = ${safeTemplate};
${renderSrc}
${validateSrc}
(function () {
  var raw = localStorage.getItem('siena-arw-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      var fresh = (new DOMParser()).parseFromString(_tpl, 'text/html');
      (window.SienaARWRender || SienaARWRender).render(fresh, payload);
      document.body.innerHTML = fresh.body.innerHTML;
    } catch (_) {}
    localStorage.removeItem('siena-arw-print-data');
  }
  var V = window.SienaARWValidate || SienaARWValidate;
  document.fonts.ready.then(function () {
    V.waitForLayout(document).then(function () {
      setTimeout(function () { window.print(); }, 200);
    });
  });
})();
</script>`;

  html = html.replace('</body>', () => printScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
