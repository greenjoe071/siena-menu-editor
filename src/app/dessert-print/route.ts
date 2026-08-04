import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/dessert-menu-store';
import { renderDessertMenu } from '@/lib/render-dessert-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-dessert');

// ?src=current (default) | draft | dessert-published-<ts>
// Always prints the one 8.5x11 sheet with both identical copies — there is
// no sheet/page picker on this card (see handoff-dessert/BUILD-SPEC.md §6).
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, validateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
  ]);

  let html = await renderDessertMenu(data);
  html = html.replace(/<script src="validate\.js"><\/script>/g, '');

  const printScript = `<script>
${renderSrc}
${validateSrc}
(function () {
  var raw = localStorage.getItem('siena-dessert-print-data');
  if (raw) {
    try { (window.SienaDessertRender).render(document, JSON.parse(raw)); } catch (_) {}
    localStorage.removeItem('siena-dessert-print-data');
  }
  var V = window.SienaDessertValidate;
  document.fonts.ready.then(function () {
    V.waitForLayout(document).then(function () {
      V.validate(document); // applies shrink-1pt to both copies where needed, matching the preview
      setTimeout(function () { window.print(); }, 200);
    });
  });
})();
</script>`;

  // Function replacer: `$` sequences in the injected JS must be inserted
  // literally, not interpreted as String.replace patterns.
  html = html.replace('</body>', () => printScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
