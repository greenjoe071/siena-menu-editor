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
      var btn = document.createElement('button');
      btn.className = 'preview-print-btn';
      btn.onclick = function() { window.print(); };
      btn.textContent = '🖨 Print Menu';
      document.body.appendChild(btn);
    } catch(err) { console.warn('Weekend render error', err); }
  }
});
</script>
<style>
  .preview-print-btn {
    position: fixed;
    bottom: 28px;
    right: 28px;
    background: #059669;
    color: #fff;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 15px;
    font-weight: 700;
    padding: 13px 26px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(5,150,105,0.45);
    transition: background 0.15s, transform 0.1s;
    z-index: 999;
  }
  .preview-print-btn:hover { background: #047857; transform: translateY(-1px); }
  .preview-print-btn:active { transform: translateY(0); }
  @media print { .preview-print-btn { display: none; } }
</style>
<button class="preview-print-btn" onclick="window.print()">🖨 Print Menu</button>`;

  html = html.replace('</body>', liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
