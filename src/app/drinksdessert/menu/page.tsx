import { readCurrentMeta } from '@/lib/drinksdessert-menu-store';
import { formatMenuDate } from '@/lib/draft-publish';
import MenuLanding from '@/components/MenuLanding';

export const dynamic = 'force-dynamic';

export default async function DrinksMenuLandingPage() {
  const meta = await readCurrentMeta();

  return (
    <MenuLanding
      menuName="Drinks"
      fixHref="/drinksdessert/fix"
      apiBase="/api/drinksdessert"
      previewHref="/drinksdessert-preview"
      printHref="/drinksdessert-print"
      currentDate={formatMenuDate(meta.publishedAt)}
      editOnly
      printVariants={[
        { label: 'Entire menu (all 4 pages)', group: 'Full menu' },
        { label: 'Signature Cocktails & Spritz Menu', query: '&sheet=a', group: 'By sheet (2 pages)' },
        { label: 'Spirits and Beer & Siena Dopa Cena', query: '&sheet=b', group: 'By sheet (2 pages)' },
        { label: 'Signature Cocktails only', query: '&page=cocktails', group: 'Single page' },
        { label: 'Spritz Menu only', query: '&page=spritz', group: 'Single page' },
        { label: 'Spirits and Beer only', query: '&page=spirits', group: 'Single page' },
        { label: 'Siena Dopa Cena only', query: '&page=dopacena', group: 'Single page' },
      ]}
    />
  );
}
