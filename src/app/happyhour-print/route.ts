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

  const printScript = `<script>
${renderSrc}
(function() {
  var raw = localStorage.getItem('siena-happyhour-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      (window.SienaHappyhourRender || SienaHappyhourRender).render(document, payload);
    } catch(_) {}
    localStorage.removeItem('siena-happyhour-print-data');
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
