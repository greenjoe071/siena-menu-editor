import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/monday-menu-store';
import { renderMondayMenu } from '@/lib/render-monday-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-monday');

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
  ]);

  let html = await renderMondayMenu(data);

  // Inject render.js + localStorage bridge (same pattern as dinner print).
  // Editor writes 'siena-monday-print-data' to localStorage before opening
  // this tab, so the printout always reflects the latest unsaved state.
  const printScript = `<script>
${renderSrc}
(function() {
  var raw = localStorage.getItem('siena-monday-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      (window.SienaMondayRender || SienaMondayRender).render(document, payload);
    } catch(_) {}
    localStorage.removeItem('siena-monday-print-data');
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
