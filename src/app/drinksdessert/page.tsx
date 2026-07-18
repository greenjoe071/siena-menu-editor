import { readCurrentMeta, hasDraft, listPublished } from '@/lib/drinksdessert-menu-store';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default async function DrinksDessertLandingPage() {
  const [meta, draftExists, published] = await Promise.all([
    readCurrentMeta(),
    hasDraft(),
    listPublished(),
  ]);

  return (
    <MenuLanding
      menuName="Drinks & Dessert"
      editHref="/drinksdessert/edit"
      apiBase="/api/drinksdessert"
      previewHref="/drinksdessert-preview"
      printHref="/drinksdessert-print"
      currentDate={formatDate(meta.publishedAt)}
      draftExists={draftExists}
      published={published.map((p) => ({ key: p.key, label: p.label }))}
      printVariants={[
        { label: 'Print Both' },
        { label: 'Sheet A only', query: '&sheet=a' },
        { label: 'Sheet B only', query: '&sheet=b' },
      ]}
    />
  );
}
