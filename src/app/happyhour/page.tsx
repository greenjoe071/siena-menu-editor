import { readCurrentMeta, hasDraft, listPublished } from '@/lib/happyhour-menu-store';
import { formatMenuDate } from '@/lib/draft-publish';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

export default async function HappyhourLandingPage() {
  const [meta, draftExists, published] = await Promise.all([
    readCurrentMeta(),
    hasDraft(),
    listPublished(),
  ]);

  return (
    <MenuLanding
      menuName="Happy Hour"
      editHref="/happyhour/edit"
      fixHref="/happyhour/fix"
      apiBase="/api/happyhour"
      previewHref="/happyhour-preview"
      printHref="/happyhour-print"
      currentDate={formatMenuDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label, note: p.note }))}
    />
  );
}
