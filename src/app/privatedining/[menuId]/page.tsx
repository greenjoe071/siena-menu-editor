import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMenuDraftPublish, readAlternates } from '@/lib/privatedining-menu-store';
import { PRIVATEDINING_MENU_IDS, type PrivateDiningMenuId } from '@/lib/privatedining-schema';
import PrivateDiningAlternatesPanel from '@/components/PrivateDiningAlternatesPanel';

export const dynamic = 'force-dynamic';

function isValidMenuId(id: string): id is PrivateDiningMenuId {
  return (PRIVATEDINING_MENU_IDS as readonly string[]).includes(id);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default async function PrivateDiningMenuLandingPage({ params }: { params: { menuId: string } }) {
  if (!isValidMenuId(params.menuId)) notFound();
  const menuId = params.menuId;

  const dp = getMenuDraftPublish(menuId);
  const [meta, draftExists, alternates, current] = await Promise.all([
    dp.readCurrentMeta(),
    dp.hasDraft(),
    readAlternates(menuId),
    dp.readMenuBySrc('current'),
  ]);

  return (
    <div className="pd-home">
      <div className="pd-home-header">
        <Link href="/privatedining" className="btn-back">← All Private Dining Menus</Link>
        <h1>{current.label}</h1>
        <p className="pd-home-hint">
          {current.internalPriceRef} per person (staff reference only — never printed) ·{' '}
          Current as of {formatDate(meta.publishedAt)}
        </p>
      </div>

      <div className="pd-landing-section">
        <div className="pd-landing-section-header">
          <h2>Default Menu</h2>
          {draftExists && <span className="dd-chip dd-chip--warn">draft in progress</span>}
        </div>
        <p className="pd-empty-hint">
          {current.courses.length} course groups, view/edit/print the standard menu here.
        </p>
        <Link href={`/privatedining/${menuId}/edit`} className="btn-publish" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Edit / Print Default
        </Link>
      </div>

      <div className="pd-landing-section">
        <div className="pd-landing-section-header">
          <h2>Saved Alternates</h2>
        </div>
        <p className="pd-empty-hint">
          Named variants management approved for a specific event — each may add up to 2 extra items total.
        </p>
        <PrivateDiningAlternatesPanel menuId={menuId} initialAlternates={alternates} />
      </div>
    </div>
  );
}
