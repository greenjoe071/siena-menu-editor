import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/tueswed-menu-store';
import { renderTuewedMenu } from '@/lib/render-tueswed-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-tueswed');

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
  ]);

  let html = await renderTuewedMenu(data);

  const printScript = `<script>
${renderSrc}
(function() {
  var raw = localStorage.getItem('siena-tueswed-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      (window.SienaTuewedRender || SienaTuewedRender).render(document, payload);
    } catch(_) {}
    localStorage.removeItem('siena-tueswed-print-data');
  }
  document.fonts.ready.then(function() {
    setTimeout(function() { window.print(); }, 500);
  });
})();
</script>`;

  html = html.replace('</body>', printScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
