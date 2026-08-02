import { readCurrentMeta, hasDraft, listPublished } from '@/lib/weekend-menu-store';
import { formatMenuDate } from '@/lib/draft-publish';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

export default async function WeekendLandingPage() {
  const [meta, draftExists, published] = await Promise.all([
    readCurrentMeta(),
    hasDraft(),
    listPublished(),
  ]);

  return (
    <MenuLanding
      menuName="Weekend Specials"
      editHref="/weekend/edit"
      fixHref="/weekend/fix"
      apiBase="/api/weekend"
      previewHref="/weekend-preview"
      printHref="/weekend-print"
      currentDate={formatMenuDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label, note: p.note }))}
    />
  );
}
