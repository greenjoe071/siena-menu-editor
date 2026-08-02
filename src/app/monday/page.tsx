import { readCurrentMeta, hasDraft, listPublished } from '@/lib/monday-menu-store';
import { formatMenuDate } from '@/lib/draft-publish';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

export default async function MondayLandingPage() {
  const [meta, draftExists, published] = await Promise.all([
    readCurrentMeta(),
    hasDraft(),
    listPublished(),
  ]);

  return (
    <MenuLanding
      menuName="Monday $26 Specials"
      editHref="/monday/edit"
      fixHref="/monday/fix"
      apiBase="/api/monday"
      previewHref="/monday-preview"
      printHref="/monday-print"
      currentDate={formatMenuDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label, note: p.note }))}
    />
  );
}
