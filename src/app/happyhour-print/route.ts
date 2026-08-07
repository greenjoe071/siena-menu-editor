import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/happyhour-menu-store';
import { renderHappyhourMenu } from '@/lib/render-happyhour-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-happyhour');

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, templateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
  ]);

  let html = await renderHappyhourMenu(data);

  // render.js permanently removes the cocktail floater (.remove()) when it's
  // empty. The server-side render above used whatever was saved at request
  // time; re-rendering the localStorage bridge payload onto that SAME
  // document can't bring a removed element back. Fix: parse a fresh DOM
  // from the raw template before re-rendering.
  const safeTemplate = JSON.stringify(templateSrc).replace(/<\/script/gi, '<\\/script');

  const printScript = `<script>
var _tpl = ${safeTemplate};
${renderSrc}
(function() {
  var raw = localStorage.getItem('siena-happyhour-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      var fresh = (new DOMParser()).parseFromString(_tpl, 'text/html');
      (window.SienaHappyhourRender || SienaHappyhourRender).render(fresh, payload);
      document.body.innerHTML = fresh.body.innerHTML;
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
