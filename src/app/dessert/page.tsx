import { readCurrentMeta, hasDraft, listPublished } from '@/lib/dessert-menu-store';
import { formatMenuDate } from '@/lib/draft-publish';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

export default async function DessertLandingPage() {
  const [meta, draftExists, published] = await Promise.all([
    readCurrentMeta(),
    hasDraft(),
    listPublished(),
  ]);

  return (
    <MenuLanding
      menuName="Desserts"
      editHref="/dessert/edit"
      fixHref="/dessert/fix"
      apiBase="/api/dessert"
      previewHref="/dessert-preview"
      printHref="/dessert-print"
      currentDate={formatMenuDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label, note: p.note }))}
    />
  );
}
