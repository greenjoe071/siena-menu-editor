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

  // First-run print help: for the first 10 prints, show a reminder to set
  // Margins: None and Scale: 100% (full-bleed 8.5x11 otherwise scales to a
  // corner). After 10 prints it just prints automatically.
  var HELP_KEY = 'siena-drinksdessert-print-help-count';
  function doPrint() { setTimeout(function () { window.print(); }, 200); }
  function showHelp(onContinue) {
    var ov = document.createElement('div');
    ov.className = 'dd-print-help-overlay';
    ov.innerHTML =
      '<div class="dd-print-help-card">' +
        '<div class="dd-print-help-title">Before you print</div>' +
        '<p class="dd-print-help-lead">In the print box that opens next, set these two options so the menu fills the whole page:</p>' +
        '<ol class="dd-print-help-steps">' +
          '<li><strong>Margins</strong> &rarr; <strong>None</strong></li>' +
          '<li><strong>Scale</strong> &rarr; <strong>100%</strong> (or "Default")</li>' +
        '</ol>' +
        '<button class="dd-print-help-btn" type="button">Got it &mdash; open print</button>' +
        '<div class="dd-print-help-foot">This tip shows the first few times only.</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.dd-print-help-btn').addEventListener('click', function () {
      ov.parentNode && ov.parentNode.removeChild(ov);
      onContinue();
    });
  }

  var V = window.SienaDrinksDessertValidate;
  document.fonts.ready.then(function () {
    V.waitForLayout(document).then(function () {
      V.validate(document); // applies shrink-1pt where needed, matching the preview
      var n = parseInt(localStorage.getItem(HELP_KEY) || '0', 10);
      if (isNaN(n)) n = 0;
      if (n < 10) {
        showHelp(function () { localStorage.setItem(HELP_KEY, String(n + 1)); doPrint(); });
      } else {
        doPrint();
      }
    });
  });
})();
</script>
<style>
  .dd-print-help-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(26, 26, 20, 0.55);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Montserrat', system-ui, sans-serif;
  }
  .dd-print-help-card {
    background: #fff; max-width: 380px; width: calc(100% - 40px);
    border-radius: 14px; padding: 26px 26px 20px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.3); text-align: left;
  }
  .dd-print-help-title { font-size: 19px; font-weight: 800; color: #1a3a5c; margin-bottom: 8px; }
  .dd-print-help-lead { font-size: 14px; color: #4a4438; line-height: 1.5; margin-bottom: 12px; }
  .dd-print-help-steps { font-size: 15px; color: #1e1a14; line-height: 1.7; margin: 0 0 18px 20px; }
  .dd-print-help-btn {
    display: block; width: 100%; background: #b8962a; color: #fff;
    font-size: 15px; font-weight: 700; border: none; border-radius: 10px;
    padding: 12px; cursor: pointer;
  }
  .dd-print-help-btn:hover { background: #9a7a20; }
  .dd-print-help-foot { font-size: 11px; color: #8a8474; text-align: center; margin-top: 10px; }
  @media print { .dd-print-help-overlay { display: none !important; } }
</style>`;

  // Function replacer: `$` sequences in the injected JS ("'$' + it.price") must
  // be inserted literally, not interpreted as String.replace patterns.
  html = html.replace('</body>', () => printScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
