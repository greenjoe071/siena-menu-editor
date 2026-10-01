import { readCurrentMeta, hasPublished, hasDraft, listPublished } from '@/lib/coursemenu-menu-store';
import { formatMenuDate } from '@/lib/draft-publish';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

export default async function CourseMenuLandingPage() {
  const [meta, everPublished, draftExists, published] = await Promise.all([
    readCurrentMeta(),
    hasPublished(),
    hasDraft(),
    listPublished(),
  ]);

  return (
    <MenuLanding
      menuName="Generic"
      editHref="/coursemenu/edit"
      fixHref="/coursemenu/fix"
      apiBase="/api/coursemenu"
      previewHref="/coursemenu-preview"
      printHref="/coursemenu-print"
      currentDate={formatMenuDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label, note: p.note }))}
      plainNav
      firstUse={!everPublished}
    />
  );
}
