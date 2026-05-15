import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readWeekendMenu } from '@/lib/weekend-menu-store';
import { renderWeekendMenu } from '@/lib/render-weekend-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-weekend');

export async function GET() {
  const [data, renderSrc] = await Promise.all([
    readWeekendMenu(),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
  ]);

  let html = await renderWeekendMenu(data);

  const liveScript = `<script>
${renderSrc}
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SIENA_WEEKEND_UPDATE') {
    try { (window.SienaWeekendRender || SienaWeekendRender).render(document, e.data.payload); } catch(_) {}
  }
});
</script>`;

  html = html.replace('</body>', liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
