import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/arw-menu-store';
import { renderArwMenu } from '@/lib/render-arw-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-arw');

// ?src=current (default) | draft | arw-published-<ts>
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, validateSrc, templateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
  ]);

  let html = await renderArwMenu(data);

  // Parse a fresh DOM from the raw template before applying the localStorage
  // payload, then swap it in — the same defensively-correct pattern used by
  // every print route on this project (harmless even though render.js here
  // fully self-heals via style.display toggles with no destructive .remove()).
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
