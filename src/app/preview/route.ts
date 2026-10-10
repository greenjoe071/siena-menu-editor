import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/menu-store';
import { renderMenu } from '@/lib/render-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff');

// ?src=current (default) | draft | published-<ts>
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, validateSrc, templateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
  ]);

  let html = await renderMenu(data);

  // Inject render.js + validate.js and a postMessage listener so the editor
  // can push updated JSON into the iframe without a full reload. Since Oct
  // 2026 render.js REMOVES hidden dishes, so each update re-renders a fresh
  // copy of the template (a dish turned back on must come back), then runs
  // the fit validator and reports to the editor (SIENA_MENU_VALIDATE_RESULT).
  const safeTemplate = JSON.stringify(templateSrc).replace(/<\/script/gi, '<\/script');
  const safeData = JSON.stringify(data).replace(/<\/script/gi, '<\/script');
  const liveScript = `<script>
var _tpl = ${safeTemplate};
${renderSrc}
${validateSrc}
(function () {
  var R = window.SienaRender, V = window.SienaSpringValidate, seq = 0;
  function check(data) {
    var my = ++seq;
    V.waitForLayout(document).then(function () {
      if (my !== seq) return;
      var report = V.validate(document, { data: data });
      window.parent.postMessage({ type: 'SIENA_MENU_VALIDATE_RESULT', report: {
        fits: report.fits, problems: report.problems } }, '*');
    });
  }
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'SIENA_MENU_UPDATE') return;
    try {
      var fresh = (new DOMParser()).parseFromString(_tpl, 'text/html');
      R.render(fresh, e.data.payload);
      var y = window.scrollY;
      document.body.innerHTML = fresh.body.innerHTML;
      window.scrollTo(0, y);
      check(e.data.payload);
    } catch (err) { console.warn('render error', err); }
  });
  check(${safeData});
})();
</script>`;

  html = html.replace('</body>', () => liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
