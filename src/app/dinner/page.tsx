import Link from 'next/link';
import { readCurrentMeta, hasDraft, listPublished } from '@/lib/menu-store';
import DinnerActions from './DinnerActions';

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
  const currentDate = formatDate(meta.publishedAt);

  return (
    <div className="dinner-landing">
      <header className="dl-header">
        <div className="dl-header-inner">
          <Link href="/" className="dl-back">← All Menus</Link>
          <h1 className="dl-title">Dinner Menu</h1>
          <p className="dl-subtitle">View or print the current menu, or start a new draft.</p>
        </div>
      </header>

      <main className="dl-main">
        {/* ── Current menu (protected, view/print only) ── */}
        <section className="dl-card dl-card--current">
          <div className="dl-card-top">
            <span className="dl-badge">Current Menu</span>
            <span className="dl-asof">Current as of {currentDate}</span>
          </div>
          <p className="dl-card-note">
            This is the menu in use. It stays locked so it can&rsquo;t be changed by accident —
            it only updates when you publish a new draft.
          </p>
          <div className="dl-actions">
            <a className="dl-btn dl-btn--solid" href="/preview?src=current" target="_blank" rel="noopener noreferrer">View</a>
            <a className="dl-btn dl-btn--solid" href="/print?src=current" target="_blank" rel="noopener noreferrer">Print</a>
          </div>
        </section>

        {/* ── Make changes (new draft) ── */}
        <section className="dl-card">
          <h2 className="dl-card-title">{draftExists ? 'Draft in Progress' : 'Start a New Menu'}</h2>
          <p className="dl-card-note">
            {draftExists
              ? 'You have an unpublished draft. Keep editing where you left off, or start over from the current menu.'
              : 'Create a working draft based on the current menu. The current menu stays untouched while you edit — publish only when you’re happy with it.'}
          </p>
          <DinnerActions draftExists={draftExists} />
        </section>

        {/* ── Past menus ── */}
        <section className="dl-card dl-card--past">
          <h2 className="dl-card-title">Past Menus</h2>
          {published.length === 0 ? (
            <p className="dl-card-note dl-empty">
              No past menus yet. When you publish a new menu, the previous one is kept here (last 3) so you can view or reprint it.
            </p>
          ) : (
            <div className="dl-past-list">
              {published.map((p) => (
                <div key={p.key} className="dl-past-row">
                  <span className="dl-past-label">Current as of {p.label}</span>
                  <div className="dl-past-actions">
                    <a className="dl-btn dl-btn--small" href={`/preview?src=${p.key}`} target="_blank" rel="noopener noreferrer">View</a>
                    <a className="dl-btn dl-btn--small" href={`/print?src=${p.key}`} target="_blank" rel="noopener noreferrer">Print</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
