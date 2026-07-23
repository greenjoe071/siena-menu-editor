import Link from 'next/link';
import { PRIVATEDINING_MENU_IDS, type PrivateDiningMenuId } from '@/lib/privatedining-schema';
import { readPrivateDiningMenu } from '@/lib/privatedining-menu-store';

export const dynamic = 'force-dynamic';

export default async function PrivateDiningHomePage() {
  const menus = await Promise.all(
    PRIVATEDINING_MENU_IDS.map(async (id: PrivateDiningMenuId) => ({
      id,
      data: await readPrivateDiningMenu(id),
    })),
  );

  return (
    <div className="pd-home">
      <div className="pd-home-header">
        <Link href="/" className="btn-home">🏠 Home</Link>
        <h1>Private Dining</h1>
        <p className="pd-home-hint">
          These labels and prices are for you, picking a menu — they never appear on the printed page.
        </p>
      </div>
      <div className="pd-home-grid">
        {menus.map(({ id, data }) => (
          <Link key={id} href={`/privatedining/${id}`} className="pd-menu-card">
            <div className="pd-menu-card-label">{data.label}</div>
            <div className="pd-menu-card-ref">{data.internalPriceRef} per person (staff reference only)</div>
            <div className="pd-menu-card-courses">{data.courses.length} course groups</div>
            <div className="pd-menu-card-action">Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
