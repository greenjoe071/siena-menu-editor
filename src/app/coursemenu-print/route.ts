import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/coursemenu-menu-store';
import { renderCourseMenu, COURSEMENU_HANDOFF } from '@/lib/render-coursemenu-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, templateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(COURSEMENU_HANDOFF, 'render.js'), 'utf8'),
    readFile(join(COURSEMENU_HANDOFF, 'template.html'), 'utf8'),
  ]);

  let html = await renderCourseMenu(data);

  // The editor hands over its latest (possibly unsaved) data via localStorage;
  // render it into a fresh template since render.js removes nodes.
  const safeTemplate = JSON.stringify(templateSrc).replace(/<\/script/gi, '<\\/script');

  const printScript = `<script>
var _tpl = ${safeTemplate};
${renderSrc}
(function() {
  var raw = localStorage.getItem('siena-coursemenu-print-data');
  if (raw) {
    try {
      var payload = JSON.parse(raw);
      var fresh = (new DOMParser()).parseFromString(_tpl, 'text/html');
      SienaCourseMenuRender.render(fresh, payload);
      document.body.innerHTML = fresh.body.innerHTML;
    } catch(_) {}
    localStorage.removeItem('siena-coursemenu-print-data');
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
