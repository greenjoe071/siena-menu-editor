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
        { label: 'Entire menu (all 4 pages)', group: 'Full menu' },
        { label: 'Cocktails & Spirits and Beer', query: '&sheet=a', group: 'By sheet (2 pages)' },
        { label: 'Dopa Cena & Desserts', query: '&sheet=b', group: 'By sheet (2 pages)' },
        { label: 'Signature Cocktails only', query: '&page=cocktails', group: 'Single page' },
        { label: 'Spirits and Beer only', query: '&page=spirits', group: 'Single page' },
        { label: 'Siena Dopa Cena only', query: '&page=dopacena', group: 'Single page' },
        { label: 'Desserts only', query: '&page=dolci', group: 'Single page' },
      ]}
    />
  );
}
