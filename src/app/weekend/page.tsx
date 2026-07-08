import { readCurrentMeta, hasDraft, listPublished } from '@/lib/weekend-menu-store';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

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
      apiBase="/api/weekend"
      previewHref="/weekend-preview"
      printHref="/weekend-print"
      currentDate={formatDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label }))}
    />
  );
}
