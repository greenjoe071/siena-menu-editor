import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/menu-store';
import { renderMenu } from '@/lib/render-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff');

// ?src=current (default) | draft | published-<ts>
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
  ]);

  let html = await renderMenu(data);

  // Inject render.js + a script that reads the latest data from localStorage
  // (written by the editor's Print Menu button) so the printout is never stale.
  const printScript = `<script>
${renderSrc}
(function() {
  var raw = localStorage.getItem('siena-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      (window.SienaRender || SienaRender).render(document, payload);
    } catch(_) {}
    localStorage.removeItem('siena-print-data');
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
