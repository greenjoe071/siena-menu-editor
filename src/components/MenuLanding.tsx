import Link from 'next/link';
import DraftActions from './DraftActions';

// Shared landing page for every menu: view/print the protected current menu,
// start/continue a draft, and view/print the last 3 past menus.

export interface MenuLandingProps {
  menuName:    string;   // "Happy Hour"  → badge "Current Happy Hour Menu"
  editHref:    string;   // "/happyhour/edit"
  apiBase:     string;   // "/api/happyhour"
  previewHref: string;   // "/happyhour-preview"
  printHref:   string;   // "/happyhour-print"
  currentDate: string;   // formatted "July 9, 2026"
  draftExists: boolean;
  published:   { key: string; label: string }[];
}

export default function MenuLanding({
  menuName, editHref, apiBase, previewHref, printHref, currentDate, draftExists, published,
}: MenuLandingProps) {
  return (
    <div className="dinner-landing">
      <header className="dl-header">
        <div className="dl-header-inner">
          <Link href="/" className="dl-back">🏠 Home</Link>
          <h1 className="dl-title">{menuName}</h1>
          <p className="dl-subtitle">View or print the current menu, or start a new draft.</p>
        </div>
      </header>

      <main className="dl-main">
        {/* ── Current menu (protected, view/print only) ── */}
        <section className="dl-card dl-card--current">
          <div className="dl-card-top">
            <span className="dl-badge">Current {menuName} Menu</span>
            <span className="dl-asof">Current as of {currentDate}</span>
          </div>
          <p className="dl-card-note">
            This is the menu in use. It stays locked so it can&rsquo;t be changed by accident —
            it only updates when you publish a new draft.
          </p>
          <div className="dl-actions">
            <a className="dl-btn dl-btn--solid" href={`${previewHref}?src=current`} target="_blank" rel="noopener noreferrer">View</a>
            <a className="dl-btn dl-btn--solid" href={`${printHref}?src=current`} target="_blank" rel="noopener noreferrer">Print</a>
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
          <DraftActions draftExists={draftExists} editHref={editHref} apiBase={apiBase} />
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
                    <a className="dl-btn dl-btn--small" href={`${previewHref}?src=${p.key}`} target="_blank" rel="noopener noreferrer">View</a>
                    <a className="dl-btn dl-btn--small" href={`${printHref}?src=${p.key}`} target="_blank" rel="noopener noreferrer">Print</a>
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
