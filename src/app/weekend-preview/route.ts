import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/weekend-menu-store';
import { renderWeekendMenu } from '@/lib/render-weekend-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-weekend');

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, rawTemplate, renderSrc, settleSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'settle.js'), 'utf8'),
  ]);

  let html = await renderWeekendMenu(data);

  // Inject raw template as a JS string so the message handler can re-render
  // from a fresh DOM on every postMessage. Required because render.js calls
  // section.remove() when dessert is null — once removed from a live DOM,
  // that element can't be re-added by a later render() call.
  //
  // settle.js (SienaWeekendSettle) runs after every render to shed chrome
  // when the page would overflow (eyebrow → day line → spacing → footer).
  // It auto-runs once on load via its own autorun(); we also call it after
  // each postMessage update.
  // The template contains <script src="settle.js"></script>. Embedding it
  // raw inside a <script> block would cause the browser's HTML parser to
  // terminate the outer script early. Escape the closing tag so the parser
  // ignores it while JS still produces the correct string at runtime.
  const safeTemplate = JSON.stringify(rawTemplate).replace(/<\/script/gi, '<\\/script');

  const liveScript = `<script>
var _tpl = ${safeTemplate};
${renderSrc}
${settleSrc}
var _R = window.SienaWeekendRender;
var _S = window.SienaWeekendSettle;
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SIENA_WEEKEND_UPDATE') {
    try {
      var fresh = (new DOMParser()).parseFromString(_tpl, 'text/html');
      _R.render(fresh, e.data.payload);
      document.body.innerHTML = fresh.body.innerHTML;
      // Settle after the browser has laid out the new content.
      // Fonts are already loaded after the first render so no need to wait
      // for fonts.ready again — a short delay is enough.
      setTimeout(function() { _S.settle(); }, 30);
    } catch(err) { console.warn('Weekend render error', err); }
  }
});
</script>`;

  html = html.replace('</body>', liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
