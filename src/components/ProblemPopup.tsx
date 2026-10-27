'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ══════════════════════════════════════════════════════════════════════════
// One big, plain-English pop-up for menu problems (Oct 2026, Generic first).
// ══════════════════════════════════════════════════════════════════════════
// Two moments:
//  • While typing — only "doesn't fit" problems pop up, a moment after Chef
//    stops typing (never mid-word). "Show Me" / "OK". The same problem
//    doesn't pop up again until it's fixed and comes back.
//  • Print / Make Active — "Is this on purpose?" listing everything found:
//    serious things in RED (a blank menu name, an empty course, doesn't
//    fit), the rest in normal text (no price, no description, …).
//    "Fix It" jumps to the first one; "Yes, Print Anyway" / "Yes, Make It
//    Active" always goes through — nothing is ever blocked (Joe: people
//    must always be able to do it their way). Things answered "on purpose"
//    aren't asked again until they change (the editor tracks that).
// Every pop-up says the work is saved (typing always saves).

export interface Problem {
  key: string;        // stable id, e.g. 'no-price', 'course-2-empty'
  title: string;      // "There's no price on this menu."
  body: string;       // "Add one, or leave it off if that's on purpose."
  target?: string;    // data-problem="…" of the field to jump to
  serious?: boolean;  // shown in red
  /** One-click fix shown on the item, e.g. spelling "Use \u201cSautéed\u201d". */
  use?: { label: string; run: () => void };
  /** "Keep mine" — the restaurant spells it this way on purpose. */
  keep?: () => void;
}

/** 'spell' = the stand-alone Check Spelling button (no print / publish after). */
export interface PopupRequest { kind: 'print' | 'publish' | 'spell'; n: number; items: Problem[] }

const QUIET_MS = 1200;   // wait this long after the last change before popping up

export function flashTarget(target?: string) {
  if (!target) return;
  const el = document.querySelector(`[data-problem="${target}"]`) as HTMLElement | null;
  if (!el) return;
  // Inside a collapsed section (Dinner)? Ask it to open first. A container
  // marked data-reveal listens for 'pp-reveal' and opens itself.
  const holders = [] as HTMLElement[];
  for (let h = el.closest('[data-reveal]') as HTMLElement | null; h; h = h.parentElement?.closest('[data-reveal]') as HTMLElement | null) holders.push(h);
  holders.forEach((h) => h.dispatchEvent(new CustomEvent('pp-reveal')));
  setTimeout(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('pp-flash');
    void el.offsetWidth;          // restart the animation
    el.classList.add('pp-flash');
    const input = el.querySelector('input, textarea') as HTMLElement | null;
    setTimeout(() => input?.focus({ preventScroll: true }), 400);
  }, holders.length ? 350 : 0);
}

/** For a collapsible container: open when Fix It points inside it. */
export function useReveal(onReveal: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onReveal);
  cb.current = onReveal;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = () => cb.current();
    el.addEventListener('pp-reveal', h);
    return () => el.removeEventListener('pp-reveal', h);
  }, []);
  return ref;
}

export default function ProblemPopup({ problems, request, onConfirm }: {
  /** "Doesn't fit" problems — pop up on their own while typing. */
  problems: Problem[];
  /** Set by the editor when Chef clicks Print / Make Active and something's off. */
  request?: PopupRequest | null;
  /** Chef said "yes, on purpose" — go ahead and print / make it active. */
  onConfirm?: (kind: 'print' | 'publish', items: Problem[]) => void;
}) {
  const [auto, setAuto] = useState(false);
  const [ask, setAsk] = useState<PopupRequest | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());   // items fixed / kept in this pop-up
  const [mounted, setMounted] = useState(false);
  const shownFor = useRef<string>('');   // fit problems already shown (don't nag)
  useEffect(() => setMounted(true), []);

  const sig = problems.map((p) => p.key).sort().join('|');

  useEffect(() => {
    if (!sig) { shownFor.current = ''; setAuto(false); return; }
    const isNew = sig.split('|').some((k) => !shownFor.current.split('|').includes(k));
    if (!isNew) return;
    const t = setTimeout(() => { shownFor.current = sig; setAuto(true); }, QUIET_MS);
    return () => clearTimeout(t);
  }, [sig]);

  useEffect(() => {
    if (request) { shownFor.current = sig; setAuto(false); setResolved(new Set()); setAsk(request); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.n]);

  if (!mounted) return null;

  // ── Print / Make Active: "Is this on purpose?" — or Check Spelling ───────
  if (ask) {
    const items = ask.items
      .filter((p) => !resolved.has(p.key))
      .sort((a, b) => Number(!!b.serious) - Number(!!a.serious));
    const close = () => setAsk(null);
    const done = (key: string) => {
      const next = new Set(resolved).add(key);
      setResolved(next);
      // Everything handled from a Print / Make Active pop-up → carry on.
      if (ask.kind !== 'spell' && ask.items.every((p) => next.has(p.key))) { close(); onConfirm?.(ask.kind, []); }
    };
    const spell = ask.kind === 'spell';
    if (!items.length && !spell) return null;
    return createPortal(
      <div className="pp-overlay" role="alertdialog" aria-modal="true" aria-labelledby="pp-title">
        <div className="pp-box">
          <div className="pp-icon" aria-hidden="true">{spell ? (items.length ? '\u{1F4DD}' : '\u2705') : '\u270B'}</div>
          <h2 id="pp-title" className="pp-title">
            {spell ? (items.length ? 'Spelling check' : ask.items.length ? 'All done' : 'No spelling problems found') : 'Is this on purpose?'}
          </h2>
          {items.length > 0 && (
            <ul className="pp-list">
              {items.map((p) => (
                <li key={p.key} className={p.serious ? 'pp-serious' : undefined}>
                  <strong>{p.title}</strong> {p.body}
                  {(p.use || p.keep) && (
                    <span className="pp-item-actions">
                      {p.use && <button className="pp-item-use" onClick={() => { p.use!.run(); done(p.key); }}>{p.use.label}</button>}
                      {p.keep && <button className="pp-item-keep" onClick={() => { p.keep!(); done(p.key); }}>Keep mine</button>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="pp-saved">✓ Don’t worry — your work is saved.</p>
          <div className="pp-actions">
            {spell ? (
              <button className="pp-primary" autoFocus onClick={close}>Done</button>
            ) : (
              <>
                <button className="pp-primary" autoFocus onClick={() => { close(); flashTarget(items[0].target); }}>Fix It</button>
                <button className="pp-secondary" onClick={() => { close(); onConfirm?.(ask.kind as 'print' | 'publish', ask.items); }}>
                  {ask.kind === 'print' ? 'Yes, Print Anyway' : 'Yes, Make It Active'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ── While typing: "doesn't fit" ──────────────────────────────────────────
  if (!auto || problems.length === 0) return null;
  const one = problems.length === 1;
  const close = () => setAuto(false);
  return createPortal(
    <div className="pp-overlay" role="alertdialog" aria-modal="true" aria-labelledby="pp-title">
      <div className="pp-box">
        <div className="pp-icon" aria-hidden="true">✋</div>
        <h2 id="pp-title" className="pp-title">
          {one ? problems[0].title : `${problems.length} things won’t fit on the menu`}
        </h2>
        {one ? (
          <p className="pp-body">{problems[0].body}</p>
        ) : (
          <ul className="pp-list">
            {problems.map((p) => <li key={p.key}><strong>{p.title}</strong> {p.body}</li>)}
          </ul>
        )}
        <p className="pp-saved">✓ Don’t worry — your work is saved.</p>
        <div className="pp-actions">
          <button className="pp-primary" autoFocus onClick={() => { close(); flashTarget(problems[0].target); }}>Show Me</button>
          <button className="pp-secondary" onClick={close}>OK</button>
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
