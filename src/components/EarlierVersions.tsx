'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ══════════════════════════════════════════════════════════════════════════
// "Earlier Versions" (Oct 2026 — Monday, Tue–Wed, Weekend).
// ══════════════════════════════════════════════════════════════════════════
// Footer button → full-screen panel: saved versions on the left (newest
// first), a real preview of the selected one on the right. Nothing changes
// until "Continue with this version" — and what's open now is kept as a
// version first (server side), so going back is never one-way.
//
// Draft editor → versions of the draft (/api/{menu}/draft?history).
// "Make a Change" → versions of the active menu (/api/{menu}/fix?history).
//
// First time the button is seen on this computer, a tip points at it.

interface Version { key: string; ts: number; data: unknown; summary: string }

const TIP_KEY = 'siena-tip-earlier-versions-seen';

function whenLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = (x: Date) => x.toDateString();
  if (day(d) === day(now)) return `Today ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (day(d) === day(y)) return `Yesterday ${time}`;
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`;
}

// A few dish names so Chef can recognize a version at a glance.
function summarize(data: unknown): string {
  const names: string[] = [];
  const walk = (x: unknown) => {
    if (names.length >= 3 || x == null) return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x === 'object') {
      const o = x as Record<string, unknown>;
      for (const k of ['title', 'name']) {
        const v = o[k];
        if (typeof v === 'string' && v.trim() && !/^(tuesdays only|starters|entr)/i.test(v.trim()) && names.length < 3) names.push(v.trim());
      }
      for (const [k, v] of Object.entries(o)) if (k !== 'weekly' && typeof v === 'object') walk(v);
    }
  };
  walk(data);
  return names.length ? names.join(' · ') : '(no dishes typed yet)';
}

export default function EarlierVersions({
  apiPath, previewBase, isFix, getEditorMenu, beforeReload,
}: {
  apiPath: string;                 // '/api/monday/draft' or '/api/monday/fix'
  previewBase: string;             // '/monday-preview'
  isFix: boolean;
  getEditorMenu: () => unknown;    // what's open right now (kept as a version on restore)
  beforeReload: () => void;        // mark the editor saved so the reload doesn't warn
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tip, setTip] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [tipPos, setTipPos] = useState<{ left: number; bottom: number; arrow: number } | null>(null);

  // First view on this computer → tip pointing at the button.
  useEffect(() => {
    try { if (localStorage.getItem(TIP_KEY) !== '1') setTip(true); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!tip) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const W = 330;
      const left = Math.max(12, Math.min(r.left + r.width / 2 - W / 2, window.innerWidth - W - 12));
      setTipPos({ left, bottom: window.innerHeight - r.top + 14, arrow: r.left + r.width / 2 - left });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [tip]);
  function closeTip() {
    try { localStorage.setItem(TIP_KEY, '1'); } catch { /* ignore */ }
    setTip(false);
  }

  async function openPanel() {
    closeTip();
    setOpen(true); setVersions(null); setSel(0); setError('');
    try {
      const list: { key: string; ts: number }[] = await fetch(`${apiPath}?history&cb=${Date.now()}`).then((r) => r.json());
      const now = JSON.stringify(getEditorMenu());
      const loaded = await Promise.all(list.map(async (v) => {
        const data = await fetch(`${apiPath}?snapshot=${encodeURIComponent(v.key)}`).then((r) => r.json());
        return { ...v, data, summary: summarize(data) };
      }));
      // Hide versions identical to the one just newer than them, and to what's open now.
      const out: Version[] = [];
      let prev = now;
      for (const v of loaded) {
        const j = JSON.stringify(v.data);
        if (j !== prev) out.push(v);
        prev = j;
      }
      setVersions(out);
    } catch {
      setError('Couldn’t load earlier versions — check the connection and try again.');
      setVersions([]);
    }
  }

  async function useVersion(v: Version) {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${apiPath}?restore=${encodeURIComponent(v.key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(getEditorMenu()),
      });
      if (!res.ok) throw new Error();
      beforeReload();
      window.location.reload();
    } catch {
      setBusy(false);
      setError('That didn’t go through — nothing was changed. Try again.');
    }
  }

  const v = versions && versions[sel];

  return (
    <>
      <button ref={btnRef} className="btn-versions" onClick={openPanel} title="Look at earlier saved versions of this menu">
        🕘 Earlier Versions
      </button>

      {tip && tipPos && !open && createPortal(
        <div className="ev-tip" style={{ left: tipPos.left, bottom: tipPos.bottom }} role="dialog" aria-label="New: Earlier Versions">
          <div className="ev-tip-title">New: Earlier Versions</div>
          <div className="ev-tip-body">
            Everything you type is saved as you go — and now we keep earlier versions too, so work never gets lost.
            If something ever disappears, or you want to go back to how the menu looked before, click
            <strong> Earlier Versions</strong> to look through them and pick one to continue with.
          </div>
          <button className="ev-tip-ok" onClick={closeTip}>Got it</button>
          <span className="ev-tip-arrow" style={{ left: tipPos.arrow - 9 }} />
        </div>,
        document.body,
      )}

      {open && createPortal(
        <div className="ev-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div className="ev-panel" role="dialog" aria-label="Earlier versions">
            <div className="ev-head">
              <div>
                <div className="ev-title">🕘 Earlier versions of {isFix ? 'the active menu' : 'your draft'}</div>
                <div className="ev-sub">Click a time to look at it. Nothing changes until you choose “Continue with this version.”</div>
              </div>
              <button className="ev-close" onClick={() => setOpen(false)} disabled={busy}>Close</button>
            </div>

            <div className="ev-body">
              <div className="ev-list">
                {versions === null && <div className="ev-empty">Loading…</div>}
                {versions && versions.length === 0 && !error && (
                  <div className="ev-empty">No earlier versions yet. They’re kept automatically from now on as you type.</div>
                )}
                {versions && versions.map((x, i) => (
                  <button key={x.key} className={'ev-item' + (i === sel ? ' ev-item--sel' : '')} onClick={() => setSel(i)}>
                    <span className="ev-item-when">{whenLabel(x.ts)}</span>
                    <span className="ev-item-sum">{x.summary}</span>
                  </button>
                ))}
              </div>

              <div className="ev-preview">
                {v ? (
                  <>
                    <div className="ev-frame-wrap">
                      <iframe key={v.key} className="ev-frame" src={`${previewBase}?src=${encodeURIComponent(v.key)}`} title={`Version from ${whenLabel(v.ts)}`} />
                    </div>
                    <div className="ev-actions">
                      <button className="ev-use" onClick={() => useVersion(v)} disabled={busy}>
                        {busy ? 'Switching…' : 'Continue with this version'}
                      </button>
                      <button className="ev-keep" onClick={() => setOpen(false)} disabled={busy}>Keep what I have now</button>
                    </div>
                    <div className="ev-note">What you have open now is saved as a version first, so you can always switch back.</div>
                  </>
                ) : (
                  <div className="ev-empty">{error || (versions && versions.length ? '' : ' ')}</div>
                )}
                {error && v && <div className="ev-error">{error}</div>}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
