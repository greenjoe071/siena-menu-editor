'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ══════════════════════════════════════════════════════════════════════════
// One big, plain-English pop-up for "something doesn't fit" (Oct 2026).
// ══════════════════════════════════════════════════════════════════════════
// Joe: the old warnings (small red line at the top, squished footer note)
// were easy to miss. This replaces them with ONE pop-up:
//   • Appears a moment after Chef stops typing — never mid-word.
//   • Says what's wrong in words a child would understand, and that his
//     work IS saved (typing always saves).
//   • "Show Me" jumps to the field and makes it flash; "OK" just closes.
//   • The same problem doesn't pop up again until it's fixed and comes back.
//   • Print / Make Active with a problem → the pop-up again, with
//     "Fix It" / "Print Anyway" (warnings never block printing).
// The field itself also stays outlined in red with a plain note under it.

export interface Problem {
  key: string;        // stable id, e.g. 'header-wrap'
  title: string;      // "The menu name is too long."
  body: string;       // "It has to fit on one line next to the price. Make it shorter."
  target?: string;    // data-problem="…" of the field to jump to
}

const QUIET_MS = 1200;   // wait this long after the last change before popping up

export function flashTarget(target?: string) {
  if (!target) return;
  const el = document.querySelector(`[data-problem="${target}"]`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('pp-flash');
  void el.offsetWidth;          // restart the animation
  el.classList.add('pp-flash');
  const input = el.querySelector('input, textarea') as HTMLElement | null;
  setTimeout(() => input?.focus({ preventScroll: true }), 400);
}

export interface PopupRequest { kind: 'print' | 'publish'; n: number }

export default function ProblemPopup({ problems, request, onPrintAnyway }: {
  problems: Problem[];
  /** Set by the editor when Chef clicks Print / Make Active while problems exist. */
  request?: PopupRequest | null;
  onPrintAnyway?: () => void;
}) {
  const [open, setOpen] = useState<'auto' | 'print' | 'publish' | null>(null);
  const [mounted, setMounted] = useState(false);
  const shownFor = useRef<string>('');   // problem set already shown (don't nag)
  useEffect(() => setMounted(true), []);

  const sig = problems.map((p) => p.key).sort().join('|');

  // Pop up once the problems have been the same for a moment.
  useEffect(() => {
    if (!sig) { shownFor.current = ''; if (open === 'auto') setOpen(null); return; }
    const isNew = sig.split('|').some((k) => !shownFor.current.split('|').includes(k));
    if (!isNew) return;
    const t = setTimeout(() => { shownFor.current = sig; setOpen((o) => o ?? 'auto'); }, QUIET_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (request) { shownFor.current = sig; setOpen(request.kind); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.n]);

  if (!mounted || !open || problems.length === 0) return null;
  const one = problems.length === 1;
  const close = () => setOpen(null);

  return createPortal(
    <div className="pp-overlay" role="alertdialog" aria-modal="true" aria-labelledby="pp-title">
      <div className="pp-box">
        <div className="pp-icon" aria-hidden="true">✋</div>
        <h2 id="pp-title" className="pp-title">
          {open === 'publish'
            ? 'This can’t be the active menu yet'
            : open === 'print'
            ? (one ? 'Wait — one thing won’t fit on the menu' : `Wait — ${problems.length} things won’t fit on the menu`)
            : (one ? problems[0].title : `${problems.length} things won’t fit on the menu`)}
        </h2>
        {one && open === 'auto' ? (
          <p className="pp-body">{problems[0].body}</p>
        ) : (
          <ul className="pp-list">
            {problems.map((p) => <li key={p.key}><strong>{p.title}</strong> {p.body}</li>)}
          </ul>
        )}
        <p className="pp-saved">✓ Don’t worry — your work is saved.</p>
        <div className="pp-actions">
          <button className="pp-primary" autoFocus onClick={() => { close(); flashTarget(problems[0].target); }}>
            {open === 'auto' ? 'Show Me' : 'Fix It'}
          </button>
          {open === 'print' ? (
            <button className="pp-secondary" onClick={() => { close(); onPrintAnyway?.(); }}>Print Anyway</button>
          ) : (
            <button className="pp-secondary" onClick={close}>OK</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Plain note shown right under a field that has a problem. */
export function ProblemNote({ problem }: { problem?: Problem }) {
  if (!problem) return null;
  return <div className="pp-note">✋ {problem.title} {problem.body}</div>;
}
