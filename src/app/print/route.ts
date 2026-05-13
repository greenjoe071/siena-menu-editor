import { readMenu } from '@/lib/menu-store';
import { renderMenu } from '@/lib/render-server';

export const dynamic = 'force-dynamic';

const PRINT_SCRIPT = `<script>
  document.fonts.ready.then(function() {
    setTimeout(function() { window.print(); }, 500);
  });
</script>`;

export async function GET() {
  const data = await readMenu();
  let html = await renderMenu(data);
  // Inject print trigger before </body>
  html = html.replace('</body>', PRINT_SCRIPT + '\n</body>');
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
