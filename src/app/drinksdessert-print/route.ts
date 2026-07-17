import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/drinksdessert-menu-store';
import { renderDrinksDessertMenu } from '@/lib/render-drinksdessert-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-drinksdessert');

// ?src=current (default) | draft | drinksdessert-published-<ts>
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, validateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
  ]);

  let html = await renderDrinksDessertMenu(data);
  html = html.replace(/<script src="validate\.js"><\/script>/g, '');

  // Print script: optionally re-render from localStorage (editor draft), apply
  // the sheet print-scope (both / A / B), run the validator so any auto-shrink
  // matches the preview, then print.
  const printScript = `<script>
${renderSrc}
${validateSrc}
(function () {
  var raw   = localStorage.getItem('siena-drinksdessert-print-data');
  var scope = localStorage.getItem('siena-drinksdessert-print-scope') || 'both';
  if (raw) {
    try { (window.SienaDrinksDessertRender).render(document, JSON.parse(raw)); } catch (_) {}
    localStorage.removeItem('siena-drinksdessert-print-data');
    localStorage.removeItem('siena-drinksdessert-print-scope');
  }
  if (scope === 'a')      document.body.classList.add('print-sheet-a-only');
  else if (scope === 'b') document.body.classList.add('print-sheet-b-only');

  var V = window.SienaDrinksDessertValidate;
  document.fonts.ready.then(function () {
    V.waitForLayout(document).then(function () {
      V.validate(document); // applies shrink-1pt where needed, matching the preview
      setTimeout(function () { window.print(); }, 400);
    });
  });
})();
</script>`;

  // Function replacer: `$` sequences in the injected JS ("'$' + it.price") must
  // be inserted literally, not interpreted as String.replace patterns.
  html = html.replace('</body>', () => printScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
