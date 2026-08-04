import { readCurrentMeta } from '@/lib/dessert-menu-store';
import { formatMenuDate } from '@/lib/draft-publish';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

export default async function DessertLandingPage() {
  const meta = await readCurrentMeta();

  return (
    <MenuLanding
      menuName="Desserts"
      fixHref="/dessert/fix"
      apiBase="/api/dessert"
      previewHref="/dessert-preview"
      printHref="/dessert-print"
      currentDate={formatMenuDate(meta.publishedAt)}
      editOnly
    />
  );
}
