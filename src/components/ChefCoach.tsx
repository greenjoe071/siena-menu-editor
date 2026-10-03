'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

// Two-step coach marks for Chef on the menu landing pages (Oct 2026, Joe:
// train Chef to start each week with "Work on a New Menu" instead of typing
// over the live menu via "Fix a Mistake"). Shows on every visit until Chef
// ticks "Don't show these again" (remembered per device).

export interface CoachStep {
  target: () => HTMLElement | null;
  title: string;
  body: string;
}

const HIDE_KEY = 'siena-chef-coach-hidden';
const POP_W = 320;
const GAP = 18;

function readHidden(): boolean {
  try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
}
function writeHidden(v: boolean) {
  try { if (v) localStorage.setItem(HIDE_KEY, '1'); else localStorage.removeItem(HIDE_KEY); } catch { /* private mode etc. */ }
}

type Placement = { top: number; left: number; side: 'right' | 'below'; arrowOffset: number };

export default function ChefCoach({ steps }: { steps: CoachStep[] }) {
  const [step, setStep] = useState<number | null>(null);
  const [hideNext, setHideNext] = useState(false);
  const [place, setPlace] = useState<Placement | null>(null);

  // Decide on the client only (localStorage), after first paint.
  useEffect(() => { if (!readHidden()) setStep(0); }, []);

  const measure = useCallback(() => {
    if (step === null) return;
    const el = steps[step]?.target();
    if (!el) return;
    const r = el.getBoundingClientRect();
    const sx = window.scrollX, sy = window.scrollY;
    const roomRight = window.innerWidth - r.right - GAP - 16;
    if (roomRight >= POP_W) {
      const top = Math.max(sy + 12, r.top + sy + r.height / 2 - 60);
      setPlace({ side: 'right', left: r.right + sx + GAP, top, arrowOffset: r.top + sy + r.height / 2 - top });
    } else {
      const left = Math.max(12, Math.min(r.left + sx, window.innerWidth - POP_W - 12));
      setPlace({ side: 'below', left, top: r.bottom + sy + GAP, arrowOffset: Math.min(POP_W - 30, Math.max(24, r.left + sx + 40 - left)) });
    }
  }, [step, steps]);

  useLayoutEffect(() => {
    if (step === null) return;
    const el = steps[step]?.target();
    el?.classList.add('dl-coach-target');
    el?.scrollIntoView({ block: 'nearest' });
    measure();
    window.addEventListener('resize', measure);
    return () => { el?.classList.remove('dl-coach-target'); window.removeEventListener('resize', measure); };
  }, [step, steps, measure]);

  if (step === null || !place) return null;

  const last = step === steps.length - 1;
  function close() {
    if (hideNext) writeHidden(true);
    setStep(null);
  }

  const s = steps[step];
  return (
    <>
      <div className="dl-coach-overlay" onClick={close} />
      <div
        className={`dl-coach-pop dl-coach-pop--${place.side}`}
        style={{ top: place.top, left: place.left, width: POP_W }}
        role="dialog"
        aria-labelledby="dl-coach-title"
      >
        <span
          className="dl-coach-arrow"
          style={place.side === 'right' ? { top: place.arrowOffset - 9 } : { left: place.arrowOffset - 9 }}
        />
        <div className="dl-coach-step">Tip {step + 1} of {steps.length}</div>
        <h3 id="dl-coach-title" className="dl-coach-title">{s.title}</h3>
        <p className="dl-coach-body">{s.body}</p>
        <label className="dl-coach-hide">
          <input type="checkbox" checked={hideNext} onChange={(e) => setHideNext(e.target.checked)} />
          Don&rsquo;t show these again
        </label>
        <div className="dl-coach-actions">
          <button type="button" className="dl-coach-skip" onClick={close}>Close</button>
          <button type="button" className="dl-coach-next" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? 'Got it' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
}
