'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ══════════════════════════════════════════════════════════════════════════
// Save safety net — shared by every menu editor (Oct 2026).
// ══════════════════════════════════════════════════════════════════════════
// Each editor still saves the way it always has (debounced POST while Chef
// types). This hook sits next to it and makes sure nothing typed is lost:
//
//  1. Browser copy — any change the server hasn't confirmed is also kept in
//     this browser (localStorage), together with the server copy it was
//     based on. Next time the editor opens:
//       • server unchanged since → a card offers "Bring It Back";
//       • server has NEWER saves since (someone kept working, maybe on
//         another computer) → the old copy is NEVER offered back; it's
//         quietly filed away as an Earlier Version instead (Oct 27 2026 —
//         on Oct 24 an old Weekend copy came back over Chef's later fixes).
//  2. Retry — a change that still isn't on the server a few seconds later
//     (Wi-Fi blip, server hiccup) is re-sent, every few seconds, until it is.
//  3. Leaving — closing the tab, the browser, or clicking Back sends any
//     unsaved change right away; if one is still unconfirmed, the browser
//     shows its own "Leave site?" warning.
//
// The editor calls `confirmSaved(json)` after each successful save so the
// hook knows what the server has.

type Status = 'idle' | 'saving' | 'saved' | 'error';

interface Options<T> {
  /** Unique per menu + mode, e.g. 'tueswed:draft' or 'tueswed:fix'. */
  storageKey: string;
  /** Where the current payload is saved. */
  url: string;
  method?: 'POST' | 'PATCH';
  /** What the editor would save right now (null while loading). */
  payload: T | null;
  /** JSON the server had when the editor opened; null until loaded. */
  loadedJson: string | null;
  setSaveStatus: (s: Status) => void;
  setSaveMsg: (m: string) => void;
  /** Put a recovered copy back into the editor (it then saves normally). */
  onRestore: (data: T) => void;
}

// base = the server copy this change was made on top of (missing on copies
// saved before Oct 27 2026 — those are treated as old).
interface Stored { json: string; url: string; at: number; base?: string | null }

const PREFIX = 'siena-unsaved:';
const RETRY_AFTER_MS = 4000;
const KEEP_DAYS = 14;

function readStored(key: string): Stored | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (typeof s?.json !== 'string' || typeof s.at !== 'number') return null;
    if (Date.now() - s.at > KEEP_DAYS * 86400000) { localStorage.removeItem(PREFIX + key); return null; }
    return s;
  } catch { return null; }
}
function writeStored(key: string, s: Stored) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(s)); } catch { /* storage full/blocked */ }
}
function clearStored(key: string) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

function whenLabel(ts: number): string {
  return new Date(ts).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function useSaveSafety<T>(o: Options<T>) {
  const { storageKey, url, payload, loadedJson } = o;
  const method = o.method ?? 'POST';

  const latestJson = payload == null ? null : JSON.stringify(payload);

  const confirmedRef  = useRef<string | null>(null);   // what the server has
  const latestRef     = useRef<string | null>(null);
  const lastChangeRef = useRef(0);
  const inflightRef   = useRef(false);
  const rejectedRef   = useRef<string | null>(null);   // server said no (4xx) — don't hammer
  const optsRef       = useRef(o);
  optsRef.current = o;

  const [recovery, setRecovery] = useState<Stored | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Server copy known once loaded; check this browser for unsaved work.
  useEffect(() => {
    if (loadedJson == null) return;
    confirmedRef.current = loadedJson;
    const stored = readStored(storageKey);
    if (!stored) return;
    if (stored.json === loadedJson || stored.url !== url) { clearStored(storageKey); return; }
    if (stored.base != null && stored.base === loadedJson) { setRecovery(stored); return; }
    // The server moved on since this copy was made — don't offer it back
    // over newer work. Keep it as an Earlier Version so nothing is lost.
    fetch(`${url}?keep=${stored.at}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stored.json })
      .then((r) => { if (r.ok) clearStored(storageKey); })
      .catch(() => { /* leave it in this browser; try again next time */ });
  }, [loadedJson, storageKey, url]);

  // Every change: remember it in this browser until the server confirms it.
  useEffect(() => {
    if (latestJson === latestRef.current) return;
    latestRef.current = latestJson;
    lastChangeRef.current = Date.now();
    if (confirmedRef.current == null || latestJson == null) return;
    if (latestJson === confirmedRef.current) clearStored(storageKey);
    else writeStored(storageKey, { json: latestJson, url, at: Date.now(), base: confirmedRef.current });
  }, [latestJson, storageKey, url]);

  const confirmSaved = useCallback((json: string) => {
    confirmedRef.current = json;
    rejectedRef.current = null;
    if (latestRef.current === json) clearStored(optsRef.current.storageKey);
  }, []);

  const unsaved = () =>
    confirmedRef.current != null && latestRef.current != null && latestRef.current !== confirmedRef.current;

  // Retry: anything still unconfirmed a few seconds after the last keystroke.
  useEffect(() => {
    const t = setInterval(async () => {
      if (!unsaved() || inflightRef.current) return;
      if (Date.now() - lastChangeRef.current < RETRY_AFTER_MS) return;
      const json = latestRef.current!;
      if (json === rejectedRef.current) return;
      inflightRef.current = true;
      try {
        const res = await fetch(optsRef.current.url, { method, headers: { 'Content-Type': 'application/json' }, body: json });
        if (res.ok) {
          confirmSaved(json);
          if (latestRef.current === json) { optsRef.current.setSaveStatus('saved'); optsRef.current.setSaveMsg('Saved'); }
        } else if (res.status >= 400 && res.status < 500) {
          rejectedRef.current = json;   // the editor already shows why; browser copy is kept
        }
      } catch { /* offline — try again next tick */ }
      finally { inflightRef.current = false; }
    }, 2000);
    return () => clearInterval(t);
  }, [method, confirmSaved]);

  // Leaving: send unsaved work now (keepalive survives the page closing).
  useEffect(() => {
    let flushed: string | null = null;
    function flush() {
      if (!unsaved()) return;
      const json = latestRef.current!;
      if (json === flushed) return;
      flushed = json;
      try {
        fetch(optsRef.current.url, { method, headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true })
          .then((r) => { if (r.ok) confirmSaved(json); })
          .catch(() => { /* browser copy stays for next time */ });
      } catch { /* ignore */ }
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!unsaved()) return;
      flush();
      e.preventDefault();
      e.returnValue = '';
    }
    function onHidden() { if (document.visibilityState === 'hidden') flush(); }
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      flush();   // in-app navigation (← Back, 🏠 Home) unmounts the editor
    };
  }, [method, confirmSaved]);

  function restore() {
    if (!recovery) return;
    try { optsRef.current.onRestore(JSON.parse(recovery.json) as T); } catch { /* corrupt copy */ }
    setRecovery(null);
  }
  function dismiss() {
    clearStored(storageKey);
    setRecovery(null);
  }

  const banner = mounted && recovery ? createPortal(
    <div className="save-recovery" role="alertdialog" aria-label="Unsaved changes found">
      <div className="save-recovery-title">We found changes that didn&rsquo;t reach the server</div>
      <div className="save-recovery-body">
        Typed in this browser on <strong>{whenLabel(recovery.at)}</strong>. Bring them back into this menu?
      </div>
      <div className="save-recovery-actions">
        <button className="save-recovery-yes" onClick={restore}>Bring It Back</button>
        <button className="save-recovery-no" onClick={dismiss}>No Thanks</button>
      </div>
    </div>,
    document.body,
  ) : null;

  return { confirmSaved, banner };
}
