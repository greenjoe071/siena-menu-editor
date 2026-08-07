import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/menu-store';
import { renderMenu } from '@/lib/render-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff');

// ?src=current (default) | draft | published-<ts>
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, templateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
  ]);

  let html = await renderMenu(data);

  // render.js permanently removes optional blocks (.remove()) when their
  // data is absent. The server-side render above used whatever was saved
  // at request time — if that lacked an optional field the chef just added,
  // this document has already lost that element, and re-rendering the
  // localStorage bridge payload onto the SAME document can't bring it back.
  // Fix: parse a fresh DOM from the raw template before re-rendering.
  const safeTemplate = JSON.stringify(templateSrc).replace(/<\/script/gi, '<\\/script');

  // Inject render.js + a script that reads the latest data from localStorage
  // (written by the editor's Print Menu button) so the printout is never stale.
  const printScript = `<script>
var _tpl = ${safeTemplate};
${renderSrc}
(function() {
  var raw = localStorage.getItem('siena-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      var fresh = (new DOMParser()).parseFromString(_tpl, 'text/html');
      (window.SienaRender || SienaRender).render(fresh, payload);
      document.body.innerHTML = fresh.body.innerHTML;
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
