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

  // Inject render.js + postMessage listener so the editor can push updated
  // JSON directly into the iframe without a full reload.
  const liveScript = `<script>
${renderSrc}
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SIENA_MONDAY_UPDATE') {
    try { (window.SienaMondayRender || SienaMondayRender).render(document, e.data.payload); } catch(_) {}
  }
});
</script>`;

  html = html.replace('</body>', liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
