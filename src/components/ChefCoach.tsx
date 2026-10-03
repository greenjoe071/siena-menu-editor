'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

// Coach-mark pop-ups for Chef on the menu landing pages (Oct 2026, Joe:
// train Chef to start each week with "Work on a New Menu" instead of typing
// over the live menu). Each tip has just "Got it" plus its own "Don't show
// this again" (remembered per device, per tip); tips show on every visit
// until that box is ticked.

export interface CoachStep {
  id: string;                          // per-tip "don't show again" key
  target: () => HTMLElement | null;
  title: string;
  body: string;
}

const HIDE_PREFIX = 'siena-chef-coach-hidden-';
const POP_W = 320;
const GAP = 18;

function isHidden(id: string): boolean {
  try { return localStorage.getItem(HIDE_PREFIX + id) === '1'; } catch { return false; }
}
function hide(id: string) {
  try { localStorage.setItem(HIDE_PREFIX + id, '1'); } catch { /* private mode etc. */ }
}

type Placement = { top: number; left: number; side: 'right' | 'below'; arrowOffset: number };

export default function ChefCoach({ steps }: { steps: CoachStep[] }) {
  const [queue, setQueue] = useState<CoachStep[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const [place, setPlace] = useState<Placement | null>(null);

  // Decide on the client only (localStorage), after first paint.
  useEffect(() => { setQueue(steps.filter((s) => !isHidden(s.id))); }, [steps]);

  const current = queue && idx < queue.length ? queue[idx] : null;

  const measure = useCallback(() => {
    const el = current?.target();
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
  }, [current]);

  useLayoutEffect(() => {
    if (!current) return;
    const el = current.target();
    el?.classList.add('dl-coach-target');
    el?.scrollIntoView({ block: 'nearest' });
    measure();
    window.addEventListener('resize', measure);
    return () => { el?.classList.remove('dl-coach-target'); window.removeEventListener('resize', measure); };
  }, [current, measure]);

  if (!current || !place) return null;

  function gotIt() {
    if (dontShow) hide(current!.id);
    setDontShow(false);
    setPlace(null);
    setIdx((i) => i + 1);
  }

  return (
    <>
      <div className="dl-coach-overlay" />
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
        <h3 id="dl-coach-title" className="dl-coach-title">{current.title}</h3>
        <p className="dl-coach-body">{current.body}</p>
        <div className="dl-coach-actions">
          <label className="dl-coach-hide">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
            Don&rsquo;t show this again
          </label>
          <button type="button" className="dl-coach-next" onClick={gotIt}>Got it</button>
        </div>
      </div>
    </>
  );
}
