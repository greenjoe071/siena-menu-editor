import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readTuewedMenu } from '@/lib/tueswed-menu-store';
import { renderTuewedMenu } from '@/lib/render-tueswed-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-tueswed');

export async function GET() {
  const [data, renderSrc] = await Promise.all([
    readTuewedMenu(),
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
