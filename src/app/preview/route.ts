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

  // Inject render.js + a postMessage listener so the editor can push
  // updated JSON directly into the iframe without a full page reload.
  // This keeps scroll position and avoids any storage propagation delays.
  const liveScript = `<script>
${renderSrc}
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SIENA_MENU_UPDATE') {
    try { (window.SienaRender || SienaRender).render(document, e.data.payload); } catch(_) {}
  }
});
</script>`;

  html = html.replace('</body>', liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
