import { readMenuBySrc } from '@/lib/tueswed-menu-store';
import { loadTuewedPackage, renderTuewedMenu } from '@/lib/render-tueswed-server';
import { printWarnings, withPrintGuard } from '@/lib/print-warnings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const src = params.get('src');
  const saved = await readMenuBySrc(src);
  // v3 menus print with handoff-tueswed/, older v2 menus (Past Menus) with
  // handoff-tueswed-v2/ — see render-tueswed-server.ts. ?pkg=v3 = the editor
  // is printing a draft it has already upgraded (its copy may not be saved yet).
  const data = (params.get('pkg') === 'v3' && !saved.special
    ? { ...saved, special: { label: '', title: '', price: '', desc: '' } }
    : saved) as typeof saved;
  const { template: templateSrc, renderSrc } = await loadTuewedPackage(data);

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

  html = html.replace('</body>', () => printScript + '\n</body>');

  // Pre-print warnings (missing titles / prices) — see print-warnings.ts
  html = withPrintGuard(html, request.url, printWarnings('tueswed', data));

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
