import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readHappyhourMenu } from '@/lib/happyhour-menu-store';
import { renderHappyhourMenu } from '@/lib/render-happyhour-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-happyhour');

export async function GET() {
  const [data, renderSrc] = await Promise.all([
    readHappyhourMenu(),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
  ]);

  let html = await renderHappyhourMenu(data);

  const liveScript = `<script>
${renderSrc}
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SIENA_HAPPYHOUR_UPDATE') {
    try { (window.SienaHappyhourRender || SienaHappyhourRender).render(document, e.data.payload); } catch(_) {}
  }
});
</script>`;

  html = html.replace('</body>', liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
