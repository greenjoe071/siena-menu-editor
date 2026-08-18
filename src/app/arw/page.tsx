import { readCurrentMeta, hasDraft, listPublished } from '@/lib/arw-menu-store';
import { formatMenuDate } from '@/lib/draft-publish';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

export default async function ArwLandingPage() {
  const [meta, draftExists, published] = await Promise.all([
    readCurrentMeta(),
    hasDraft(),
    listPublished(),
  ]);

  return (
    <MenuLanding
      menuName="Austin Restaurant Weeks"
      editHref="/arw/edit"
      fixHref="/arw/fix"
      apiBase="/api/arw"
      previewHref="/arw-preview"
      printHref="/arw-print"
      currentDate={formatMenuDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label, note: p.note }))}
    />
  );
}
