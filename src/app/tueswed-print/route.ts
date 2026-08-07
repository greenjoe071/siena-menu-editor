import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/tueswed-menu-store';
import { renderTuewedMenu } from '@/lib/render-tueswed-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-tueswed');

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, templateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
  ]);

  let html = await renderTuewedMenu(data);

  // render.js permanently removes the addon block / policy-line footnotes
  // (.remove()) when their data is empty. The server-side render above used
  // whatever was saved at request time; re-rendering the localStorage bridge
  // payload onto that SAME document can't bring a removed element back.
  // Fix: parse a fresh DOM from the raw template before re-rendering (the
  // preview route already does this via a different, page-scoped approach —
  // see tueswed-preview/route.ts).
  const safeTemplate = JSON.stringify(templateSrc).replace(/<\/script/gi, '<\\/script');

  const printScript = `<script>
var _tpl = ${safeTemplate};
${renderSrc}
(function() {
  var raw = localStorage.getItem('siena-tueswed-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      var fresh = (new DOMParser()).parseFromString(_tpl, 'text/html');
      (window.SienaTuewedRender || SienaTuewedRender).render(fresh, payload);
      document.body.innerHTML = fresh.body.innerHTML;
    } catch(_) {}
    localStorage.removeItem('siena-tueswed-print-data');
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
