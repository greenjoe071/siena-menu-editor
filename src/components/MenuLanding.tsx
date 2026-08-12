'use client';

import { useState } from 'react';
import Link from 'next/link';
import DraftActions from './DraftActions';
import PrintPicker from './PrintPicker';

// Shared landing page for every menu: view/print/fix the protected current
// menu, start/continue a draft, and view/print the last 3 past menus.
// Two-column layout — a numbered nav on the left, the selected section's
// content on the right, separated by a light divider.

// A print option other than the plain single "Print" button — e.g. Drinks &
// Dessert's "print just one sheet/page" choices. `query` is appended verbatim
// to the print URL (e.g. "&sheet=a" or "&page=cocktails"). `group` is an
// optional <optgroup> label when there are enough variants to organize.
export interface PrintVariant {
  label: string;
  query?: string;
  group?: string;
}

export interface PublishedMenuEntry {
  key: string;
  label: string;
  note?: string;
}

export interface MenuLandingProps {
  menuName:    string;   // "Happy Hour"  → badge "Current Happy Hour Menu"
  editHref?:   string;   // "/happyhour/edit" — omit when editOnly (no draft/publish flow)
  fixHref?:    string;   // "/happyhour/fix" — omit to hide the edit button (not built yet for this menu)
  apiBase:     string;   // "/api/happyhour"
  previewHref: string;   // "/happyhour-preview"
  printHref:   string;   // "/happyhour-print"
  currentDate: string;   // formatted "July 9, 2026"
  draftExists?: boolean;
  published?:   PublishedMenuEntry[];
  // When set, the Print button becomes a row of these options instead of a
  // single "Print" link (both for the current menu and each past menu).
  printVariants?: PrintVariant[];
  // Direct-edit-only mode (Drinks Menu + Desserts, Aug 2026): no draft/publish
  // flow at all — hides "Work on a New Menu" and "Past Menus" entirely, shows
  // just the current-menu card, and labels the edit button "Make a Change"
  // instead of "Fix a Mistake" (there's no draft to distinguish it from).
  editOnly?: boolean;
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

// Inline, click-to-edit note on a past-menu row. Saves on blur; no separate
// save button, matching the app's autosave feel elsewhere.
function PastMenuNote({
  apiBase, menuKey, initialNote,
}: {
  apiBase: string;
  menuKey: string;
  initialNote?: string;
}) {
  const [note, setNote] = useState(initialNote ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(value: string) {
    setNote(value);
    setEditing(false);
    if (value === (initialNote ?? '')) return;
    setSaving(true);
    try {
      await fetch(`${apiBase}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: menuKey, note: value }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="dl-note-input"
        defaultValue={note}
        placeholder="What changed on this menu? (optional)"
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
    );
  }

  return (
    <button type="button" className={note ? 'dl-note-text' : 'dl-note-add'} onClick={() => setEditing(true)} disabled={saving}>
      {saving ? 'Saving…' : note ? `📝 ${note}` : '+ Add a note'}
    </button>
  );
}

type SectionKey = 'current' | 'new' | 'past';

export default function MenuLanding({
  menuName, editHref, fixHref, apiBase, previewHref, printHref, currentDate,
  draftExists = false, published = [], printVariants, editOnly = false,
}: MenuLandingProps) {
  const [active, setActive] = useState<SectionKey>('current');

  const navItems: { key: SectionKey; label: string; hint?: string }[] = editOnly
    ? [{ key: 'current', label: 'View, Print, or Make a Change', hint: `Current as of ${currentDate}` }]
    : [
        { key: 'current', label: 'View, Print, or Fix Current Menu', hint: `Current as of ${currentDate}` },
        { key: 'new', label: 'Work on a New Menu', hint: draftExists ? 'Draft in progress' : undefined },
        { key: 'past', label: 'Past Menus', hint: published.length ? `${published.length} saved` : undefined },
      ];

  return (
    <div className="dinner-landing">
      <header className="dl-header">
        <div className="dl-header-inner">
          {editOnly && <Link href="/" className="dl-back-btn">← Back</Link>}
          <Link href="/" className="dl-back">🏠 Home</Link>
          <h1 className="dl-title">{menuName}</h1>
          <p className="dl-subtitle">{editOnly ? 'View or print the current menu, or make a change.' : 'View or print the current menu, fix a mistake, or start a new draft.'}</p>
        </div>
      </header>

      <main className={`dl-split ${editOnly ? 'dl-split--single' : ''}`}>
        {!editOnly && (
          <>
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
          </>
        )}

        <div className="dl-content">
          {(editOnly || active === 'current') && (
            <div className="dl-pane dl-pane--current">
              <div className="dl-card-top">
                <span className="dl-badge">Current {menuName} Menu</span>
                <span className="dl-asof">Current as of {currentDate}</span>
              </div>
              <p className="dl-card-note">
                {editOnly
                  ? 'This is the menu in use. Print it any time, or make a change below — changes save right away.'
                  : <>This is the menu in use. It stays locked so it can&rsquo;t be changed by accident —
                      it only updates when you publish a new menu{fixHref ? ', or use the fix option below' : ''}.</>}
              </p>
              <div className="dl-actions">
                <a className="dl-btn dl-btn--solid" href={`${previewHref}?src=current`} target="_blank" rel="noopener noreferrer">View</a>
                <PrintLinks printHref={printHref} src="current" variants={printVariants} size="solid" />
              </div>

              {fixHref && (
                <div className="dl-fix-row">
                  <Link className="dl-btn dl-btn--fix" href={fixHref}>✏️ {editOnly ? 'Make a Change' : 'Fix a Mistake'}</Link>
                  <span className="dl-fix-hint">
                    {editOnly
                      ? 'Opens the menu for editing — every change saves the second you make it.'
                      : <>Spot a typo or wrong price? This opens the live menu, and saves the second you make a
                          change — no draft, no publish button. For planning ahead instead, use &ldquo;Work on a New Menu.&rdquo;</>}
                  </span>
                </div>
              )}
            </div>
          )}

          {!editOnly && active === 'new' && (
            <div className="dl-pane">
              <h2 className="dl-card-title">{draftExists ? 'Draft in Progress' : 'Start a New Menu'}</h2>
              <p className="dl-card-note">
                {draftExists
                  ? 'You have an unpublished draft. Keep editing where you left off, or start over from the current menu.'
                  : 'Create a working draft based on the current menu. The current menu stays untouched while you edit — publish only when you’re happy with it.'}
              </p>
              <DraftActions draftExists={draftExists} editHref={editHref ?? ''} apiBase={apiBase} />
            </div>
          )}

          {!editOnly && active === 'past' && (
            <div className="dl-pane">
              <h2 className="dl-card-title">Past Menus</h2>
              {published.length === 0 ? (
                <p className="dl-card-note dl-empty">
                  No past menus yet. When you publish a new menu, the previous one is kept here (last 3) so you can view or reprint it.
                </p>
              ) : (
                <div className="dl-past-list">
                  {published.map((p) => (
                    <div key={p.key} className="dl-past-row dl-past-row--note">
                      <div className="dl-past-main">
                        <span className="dl-past-label">Current as of {p.label}</span>
                        <PastMenuNote apiBase={apiBase} menuKey={p.key} initialNote={p.note} />
                      </div>
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
