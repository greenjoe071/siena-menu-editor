'use client';

import { useState } from 'react';
import Link from 'next/link';

// MOCKUP — for Joe's review only. Not wired to real data or real save
// actions. Demonstrates the proposed 4-option landing page (adds "Fix a
// Mistake") and the past-menus "add a note" idea. Delete this route once
// the real version is built and approved.

type SectionKey = 'current' | 'fix' | 'new' | 'past';

const PAST_MENUS = [
  { key: 'p1', label: 'Current as of July 21, 2026', note: '' },
  { key: 'p2', label: 'Current as of July 7, 2026', note: 'Summer version — lighter pastas, no braised short rib' },
];

export default function MockupFixPage() {
  const [active, setActive] = useState<SectionKey>('current');
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(PAST_MENUS.map((p) => [p.key, p.note])),
  );
  const [editingNote, setEditingNote] = useState<string | null>(null);

  const navItems: { key: SectionKey; label: string; hint?: string }[] = [
    { key: 'current', label: 'View & Print Current Menu', hint: 'Current as of August 1, 2026' },
    { key: 'fix', label: 'Fix a Mistake', hint: 'Correct a typo or price' },
    { key: 'new', label: 'Work on a New Menu', hint: undefined },
    { key: 'past', label: 'Past Menus', hint: `${PAST_MENUS.length} saved` },
  ];

  return (
    <div className="dinner-landing">
      <div className="mockup-flag">MOCKUP — for review only, not connected to real menus</div>

      <header className="dl-header">
        <div className="dl-header-inner">
          <Link href="/" className="dl-back">🏠 Home</Link>
          <h1 className="dl-title">Monday $26 Specials</h1>
          <p className="dl-subtitle">View or print the current menu, fix a mistake, or start a new draft.</p>
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
                <span className="dl-badge">Current Monday $26 Specials Menu</span>
                <span className="dl-asof">Current as of August 1, 2026</span>
              </div>
              <p className="dl-card-note">
                This is the menu in use. It stays locked so it can&rsquo;t be changed by accident —
                it only updates when you publish a new draft, or use &ldquo;Fix a Mistake.&rdquo;
              </p>
              <div className="dl-actions">
                <a className="dl-btn dl-btn--solid">View</a>
                <a className="dl-btn dl-btn--solid">Print</a>
              </div>
            </div>
          )}

          {active === 'fix' && (
            <div className="dl-pane dl-pane--fix">
              <div className="dl-card-top">
                <span className="dl-badge dl-badge--fix">Fix a Mistake</span>
              </div>
              <h2 className="dl-card-title">Correct the Live Menu</h2>
              <p className="dl-card-note">
                Use this when you spot a typo, a wrong price, or a small mistake on the menu that&rsquo;s
                already out. It opens the live menu for editing and <strong>saves right away</strong> —
                there&rsquo;s no draft and no publish button.
              </p>
              <p className="dl-card-note">
                For planning next week&rsquo;s specials, use &ldquo;Work on a New Menu&rdquo; instead — that one
                lets you take your time and keeps the live menu untouched until you&rsquo;re ready.
              </p>
              <div className="dl-actions">
                <a className="dl-btn dl-btn--primary">Open &amp; Fix →</a>
              </div>
            </div>
          )}

          {active === 'new' && (
            <div className="dl-pane">
              <h2 className="dl-card-title">Start a New Menu</h2>
              <p className="dl-card-note">
                Create a working draft based on the current menu. The current menu stays untouched while
                you edit — publish only when you&rsquo;re happy with it.
              </p>
              <div className="dl-actions">
                <a className="dl-btn dl-btn--primary">Start Draft →</a>
              </div>
            </div>
          )}

          {active === 'past' && (
            <div className="dl-pane">
              <h2 className="dl-card-title">Past Menus</h2>
              <div className="dl-past-list">
                {PAST_MENUS.map((p) => (
                  <div key={p.key} className="dl-past-row dl-past-row--note">
                    <div className="dl-past-main">
                      <span className="dl-past-label">{p.label}</span>
                      {editingNote === p.key ? (
                        <input
                          autoFocus
                          className="dl-note-input"
                          defaultValue={notes[p.key]}
                          placeholder="What changed on this menu? (optional)"
                          onBlur={(e) => { setNotes((n) => ({ ...n, [p.key]: e.target.value })); setEditingNote(null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                      ) : notes[p.key] ? (
                        <button type="button" className="dl-note-text" onClick={() => setEditingNote(p.key)}>
                          📝 {notes[p.key]}
                        </button>
                      ) : (
                        <button type="button" className="dl-note-add" onClick={() => setEditingNote(p.key)}>
                          + Add a note
                        </button>
                      )}
                    </div>
                    <div className="dl-past-actions">
                      <a className="dl-btn dl-btn--small">View</a>
                      <a className="dl-btn dl-btn--small">Print</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .mockup-flag {
          background: #b8272c;
          color: #fff;
          text-align: center;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.04em;
          padding: 8px;
        }
        .dl-pane--fix { border: 2px solid #b8272c; box-shadow: 0 6px 24px rgba(184, 39, 44, 0.14); }
        .dl-badge--fix { background: #b8272c; }
        .dl-past-row--note { align-items: flex-start; }
        .dl-past-main { display: flex; flex-direction: column; gap: 4px; }
        .dl-note-text, .dl-note-add {
          background: none; border: none; padding: 0; text-align: left; cursor: pointer;
          font-size: 13.5px; color: var(--muted); font-style: italic;
        }
        .dl-note-text:hover, .dl-note-add:hover { color: var(--navy); }
        .dl-note-add { color: var(--gold); font-style: normal; font-weight: 600; }
        .dl-note-input {
          font-size: 13.5px; padding: 6px 10px; border: 2px solid var(--gold);
          border-radius: 6px; width: 320px; max-width: 100%;
        }
      `}</style>
    </div>
  );
}
