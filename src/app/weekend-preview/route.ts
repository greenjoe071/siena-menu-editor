import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readWeekendMenu } from '@/lib/weekend-menu-store';
import { renderWeekendMenu } from '@/lib/render-weekend-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-weekend');

export async function GET() {
  const [data, rawTemplate, renderSrc] = await Promise.all([
    readWeekendMenu(),
    readFile(join(HANDOFF, 'template.html'), 'utf8'),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
  ]);

  let html = await renderWeekendMenu(data);

  // Inject raw template as a JS string so the message handler can re-render
  // from a fresh DOM on every postMessage. This is required because render.js
  // calls section.remove() when dessert is null — once removed, that element
  // can't be re-added by a later render() call. Re-parsing the template each
  // time gives render() a complete DOM to work with regardless of prior state.
  const liveScript = `<script>
var _tpl = ${JSON.stringify(rawTemplate)};
${renderSrc}
var _R = window.SienaWeekendRender;
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SIENA_WEEKEND_UPDATE') {
    try {
      var doc = (new DOMParser()).parseFromString(_tpl, 'text/html');
      _R.render(doc, e.data.payload);
      document.body.innerHTML = doc.body.innerHTML;
    } catch(err) { console.warn('Weekend render error', err); }
  }
});
</script>`;

  html = html.replace('</body>', liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
