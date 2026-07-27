import { readCurrentMeta, hasDraft, listPublished } from '@/lib/tueswed-menu-store';
import { formatMenuDate } from '@/lib/draft-publish';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

export default async function TueswedLandingPage() {
  const [meta, draftExists, published] = await Promise.all([
    readCurrentMeta(),
    hasDraft(),
    listPublished(),
  ]);

  return (
    <MenuLanding
      menuName="Tue–Wed $45 Specials"
      editHref="/tueswed/edit"
      apiBase="/api/tueswed"
      previewHref="/tueswed-preview"
      printHref="/tueswed-print"
      currentDate={formatMenuDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label }))}
    />
  );
}
