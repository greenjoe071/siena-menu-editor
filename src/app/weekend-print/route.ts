import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/weekend-menu-store';
import { renderWeekendMenu } from '@/lib/render-weekend-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-weekend');

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, settleSrc, templateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'settle.js'), 'utf8'),
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
  ]);

  let html = await renderWeekendMenu(data);

  // render.js permanently removes the dessert section (section.remove())
  // when data.dessert is absent. The server-side render above ran with
  // whatever was saved at request time — if the chef just added a dessert
  // and printed before the debounced autosave landed, that render already
  // stripped the section from THIS document. Re-rendering the localStorage
  // bridge payload straight onto that same document can never bring it
  // back. Fix: parse a fresh DOM from the raw template before re-rendering,
  // same pattern as weekend-preview/route.ts.
  const safeTemplate = JSON.stringify(templateSrc).replace(/<\/script/gi, '<\\/script');

  const printScript = `<script>
var _tpl = ${safeTemplate};
${renderSrc}
${settleSrc}
(function() {
  var raw = localStorage.getItem('siena-weekend-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      var fresh = (new DOMParser()).parseFromString(_tpl, 'text/html');
      (window.SienaWeekendRender || SienaWeekendRender).render(fresh, payload);
      document.body.innerHTML = fresh.body.innerHTML;
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
