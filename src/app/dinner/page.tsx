import { readCurrentMeta, hasDraft, listPublished } from '@/lib/menu-store';
import { formatMenuDate } from '@/lib/draft-publish';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

export default async function DinnerLandingPage() {
  const [meta, draftExists, published] = await Promise.all([
    readCurrentMeta(),
    hasDraft(),
    listPublished(),
  ]);

  return (
    <MenuLanding
      menuName="Dinner"
      editHref="/dinner/edit"
      apiBase="/api/dinner"
      previewHref="/preview"
      printHref="/print"
      currentDate={formatMenuDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label }))}
    />
  );
}
