import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMenuBySrc } from '@/lib/happyhour-menu-store';
import { renderHappyhourMenu } from '@/lib/render-happyhour-server';

export const dynamic = 'force-dynamic';

const HANDOFF = join(process.cwd(), 'handoff-happyhour');

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  const [data, renderSrc, validateSrc] = await Promise.all([
    readMenuBySrc(src),
    readFile(join(HANDOFF, 'render.js'), 'utf8'),
    readFile(join(HANDOFF, 'validate.js'), 'utf8'),
  ]);

  let html = await renderHappyhourMenu(data);

  // Injected into the preview iframe. On SIENA_HAPPYHOUR_UPDATE:
  //  1. Re-render with new data
  //  2. Wait for fonts/layout to settle (waitForLayout)
  //  3. Run validate() — measures .page scrollHeight vs clientHeight
  //  4. Post SIENA_HAPPYHOUR_VALIDATE_RESULT back to the parent editor
  const liveScript = `<script>
${renderSrc}
${validateSrc}
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'SIENA_HAPPYHOUR_UPDATE') return;
  try {
    var renderer = window.SienaHappyhourRender || SienaHappyhourRender;
    var validator = window.SienaHappyhourValidate || SienaHappyhourValidate;
    renderer.render(document, e.data.payload);
    validator.waitForLayout(document).then(function() {
      var result = validator.validate(document);
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'SIENA_HAPPYHOUR_VALIDATE_RESULT', result: result }, '*');
      }
    });
  } catch(err) {}
});
</script>`;

  html = html.replace('</body>', liveScript + '\n</body>');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
