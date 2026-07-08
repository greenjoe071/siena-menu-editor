import { readCurrentMeta, hasDraft, listPublished } from '@/lib/menu-store';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

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
      currentDate={formatDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label }))}
    />
  );
}
