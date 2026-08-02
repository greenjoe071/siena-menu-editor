'use client';

import { useState } from 'react';
import Link from 'next/link';
import DraftActions from './DraftActions';
import PrintPicker from './PrintPicker';

// Shared landing page for every menu: view/print the protected current menu,
// start/continue a draft, and view/print the last 3 past menus. Two-column
// layout — a numbered nav on the left, the selected section's content on
// the right, separated by a light divider.

// A print option other than the plain single "Print" button — e.g. Drinks &
// Dessert's "print just one sheet/page" choices. `query` is appended verbatim
// to the print URL (e.g. "&sheet=a" or "&page=cocktails"). `group` is an
// optional <optgroup> label when there are enough variants to organize.
export interface PrintVariant {
  label: string;
  query?: string;
  group?: string;
}

export interface MenuLandingProps {
  menuName:    string;   // "Happy Hour"  → badge "Current Happy Hour Menu"
  editHref:    string;   // "/happyhour/edit"
  apiBase:     string;   // "/api/happyhour"
  previewHref: string;   // "/happyhour-preview"
  printHref:   string;   // "/happyhour-print"
  currentDate: string;   // formatted "July 9, 2026"
  draftExists: boolean;
  published:   { key: string; label: string }[];
  // When set, the Print button becomes a row of these options instead of a
  // single "Print" link (both for the current menu and each past menu).
  printVariants?: PrintVariant[];
}

function PrintLinks({
  printHref, src, variants, size,
}: {
  printHref: string;
  src: string;
  variants?: PrintVariant[];
  size: 'solid' | 'small';
}) {
  const cls = size === 'solid' ? 'dl-btn dl-btn--solid' : 'dl-btn dl-btn--small';
  if (!variants) {
    return <a className={cls} href={`${printHref}?src=${src}`} target="_blank" rel="noopener noreferrer">Print</a>;
  }
  return <PrintPicker printHref={printHref} src={src} variants={variants} size={size} />;
}

type SectionKey = 'current' | 'new' | 'past';

export default function MenuLanding({
  menuName, editHref, apiBase, previewHref, printHref, currentDate, draftExists, published, printVariants,
}: MenuLandingProps) {
  const [active, setActive] = useState<SectionKey>('current');

  const navItems: { key: SectionKey; label: string; hint?: string }[] = [
    { key: 'current', label: 'Work on current menu', hint: `Current as of ${currentDate}` },
    { key: 'new', label: 'Work on a new menu', hint: draftExists ? 'Draft in progress' : undefined },
    { key: 'past', label: 'Past menus: view or print', hint: published.length ? `${published.length} saved` : undefined },
  ];

  return (
    <div className="dinner-landing">
      <header className="dl-header">
        <div className="dl-header-inner">
          <Link href="/" className="dl-back">🏠 Home</Link>
          <h1 className="dl-title">{menuName}</h1>
          <p className="dl-subtitle">View or print the current menu, or start a new draft.</p>
        </div>
      </header>

      <main className="dl-split">
        <nav className="dl-nav">
          {navItems.map((item, i) => (
            <button
              key={item.key}
              type="button"
              className={`dl-nav-item ${active === item.key ? 'active' : ''}`}
              onClick={() => setActive(item.key)}
            >
              <span className="dl-nav-num">{i + 1}</span>
              <span className="dl-nav-text">
                <span className="dl-nav-label">{item.label}</span>
                {item.hint && <span className="dl-nav-hint">{item.hint}</span>}
              </span>
            </button>
          ))}
        </nav>

        <div className="dl-divider" />

        <div className="dl-content">
          {active === 'current' && (
            <div className="dl-pane dl-pane--current">
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
                <PrintLinks printHref={printHref} src="current" variants={printVariants} size="solid" />
              </div>
            </div>
          )}

          {active === 'new' && (
            <div className="dl-pane">
              <h2 className="dl-card-title">{draftExists ? 'Draft in Progress' : 'Start a New Menu'}</h2>
              <p className="dl-card-note">
                {draftExists
                  ? 'You have an unpublished draft. Keep editing where you left off, or start over from the current menu.'
                  : 'Create a working draft based on the current menu. The current menu stays untouched while you edit — publish only when you’re happy with it.'}
              </p>
              <DraftActions draftExists={draftExists} editHref={editHref} apiBase={apiBase} />
            </div>
          )}

          {active === 'past' && (
            <div className="dl-pane">
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
                        <PrintLinks printHref={printHref} src={p.key} variants={printVariants} size="small" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
