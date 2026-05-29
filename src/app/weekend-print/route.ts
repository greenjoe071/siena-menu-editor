import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readWeekendMenu } from '@/lib/weekend-menu-store';
import { renderWeekendMenu } from '@/lib/render-weekend-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-weekend');

export async function GET() {
  const [data, renderSrc, settleSrc] = await Promise.all([
    readWeekendMenu(),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'settle.js'), 'utf8'),
  ]);

  let html = await renderWeekendMenu(data);

  const printScript = `<script>
${renderSrc}
${settleSrc}
(function() {
  var raw = localStorage.getItem('siena-weekend-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      (window.SienaWeekendRender || SienaWeekendRender).render(document, payload);
    } catch(_) {}
    localStorage.removeItem('siena-weekend-print-data');
  }
  document.fonts.ready.then(function() {
    // Settle the page BEFORE printing so the auto-fit ladder removes
    // any chrome that won't fit, then open the print dialog.
    (window.SienaWeekendSettle || SienaWeekendSettle).settle();
    setTimeout(function() { window.print(); }, 500);
  });
})();
</script>`;

  html = html.replace('</body>', printScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
