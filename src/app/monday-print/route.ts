import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/monday-menu-store';
import { renderMondayMenu } from '@/lib/render-monday-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-monday');

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, templateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
  ]);

  let html = await renderMondayMenu(data);

  // render.js permanently removes the optional price element (.remove())
  // when a dish has no price. The server-side render above used whatever
  // was saved at request time; re-rendering the localStorage bridge payload
  // onto that SAME document can't bring a removed element back. Fix: parse
  // a fresh DOM from the raw template before re-rendering.
  const safeTemplate = JSON.stringify(templateSrc).replace(/<\/script/gi, '<\\/script');

  // Inject render.js + localStorage bridge (same pattern as dinner print).
  // Editor writes 'siena-monday-print-data' to localStorage before opening
  // this tab, so the printout always reflects the latest unsaved state.
  const printScript = `<script>
var _tpl = ${safeTemplate};
${renderSrc}
(function() {
  var raw = localStorage.getItem('siena-monday-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      var fresh = (new DOMParser()).parseFromString(_tpl, 'text/html');
      (window.SienaMondayRender || SienaMondayRender).render(fresh, payload);
      document.body.innerHTML = fresh.body.innerHTML;
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
