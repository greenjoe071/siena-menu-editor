'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

interface TuewedCourse {
  id: 'course-1' | 'course-2' | 'course-3';
  title: string;
  desc: string;
}

interface TuewedAddon {
  title: string;
  desc?: string;
  price?: string;
}

interface TuewedMenuData {
  price: string;
  courses: [TuewedCourse, TuewedCourse, TuewedCourse];
  addon?: TuewedAddon;
  policy_line?: string;
}

// ── Char limits (must match BUILD-SPEC.md and tueswed-schema.ts) ──────────

const L = {
  price:       3,
  courseTitle: 38,
  courseDesc:  140,
  addonTitle:  24,
  addonDesc:   70,
  addonPrice:  3,
  policyLine:  120,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

function filterDigits(v: string): string {
  return v.replace(/[^0-9]/g, '');
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function menuHasOverLimit(m: TuewedMenuData): boolean {
  if (m.price.length                   > L.price)       return true;
  for (const c of m.courses) {
    if (c.title.length                 > L.courseTitle)  return true;
    if (c.desc.length                  > L.courseDesc)   return true;
  }
  if (m.addon) {
    if (m.addon.title.length           > L.addonTitle)   return true;
    if ((m.addon.desc  ?? '').length   > L.addonDesc)    return true;
    if ((m.addon.price ?? '').length   > L.addonPrice)   return true;
  }
  if ((m.policy_line ?? '').length     > L.policyLine)   return true;
  return false;
}

// ── CharCount ─────────────────────────────────────────────────────────────

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const cls = len > max ? 'char-count over' : len > max * 0.85 ? 'char-count warn' : 'char-count';
  return <span className={cls}>{len}/{max}</span>;
}

// ── PriceInput (digits only) ──────────────────────────────────────────────

function PriceInput({ value, onChange, placeholder = '45', prefix = '$' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <div className="price-input-wrap">
      <span className="price-dollar">{prefix}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(filterDigits(e.target.value))}
        placeholder={placeholder}
        style={{ width: '60px' }}
      />
    </div>
  );
}

// ── CourseCard ─────────────────────────────────────────────────────────────

const ROMAN = ['I', 'II', 'III'] as const;
const COURSE_LABELS = ['First Course', 'Second Course', 'Third Course'] as const;

function CourseCard({ course, index, onChange }: {
  course: TuewedCourse;
  index: number;
  onChange: (index: number, updated: TuewedCourse) => void;
}) {
  return (
    <div className="dish-row">
      <div className="dish-row-header">
        <span className="dish-name-preview">
          {ROMAN[index]} — {COURSE_LABELS[index]}
        </span>
      </div>
      <div className="dish-fields">
        <div className="field-group">
          <div className="field-label-row">
            <label>Dish name</label>
            <CharCount value={course.title} max={L.courseTitle} />
          </div>
          <input
            value={course.title}
            onChange={e => onChange(index, { ...course, title: e.target.value })}
            placeholder={
              index === 0 ? 'e.g. Burrata e Fichi' :
              index === 1 ? 'e.g. Risotto ai Funghi' :
              'e.g. Branzino al Forno'
            }
          />
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <div className="field-label-row">
            <label>Description</label>
            <CharCount value={course.desc} max={L.courseDesc} />
          </div>
          <textarea
            rows={2}
            value={course.desc}
            onChange={e => onChange(index, { ...course, desc: e.target.value })}
            placeholder="Ingredients and preparation"
          />
        </div>
      </div>
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────

interface BackupEntry { key: string; ts: number; label: string; }

function HistoryPanel({ onRestore }: { onRestore: (data: TuewedMenuData) => void }) {
  const [backups, setBackups]     = useState<BackupEntry[]>([]);
  const [open, setOpen]           = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/tueswed/backups');
    if (res.ok) setBackups(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function restore(entry: BackupEntry) {
    if (!confirm(`Restore Tue–Wed menu to the version saved on ${entry.label}?\n\nThis will overwrite your current menu.`)) return;
    setRestoring(entry.key);
    try {
      const res = await fetch('/api/tueswed/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: entry.key }),
      });
      if (!res.ok) { alert('Restore failed — try again.'); return; }
      onRestore(await res.json());
      await load();
    } finally { setRestoring(null); }
  }

  if (backups.length === 0) return null;

  return (
    <div className="history-panel">
      <button className="history-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▲' : '▼'} Save history ({backups.length})
      </button>
      {open && (
        <div className="history-list">
          {backups.map(b => (
            <div key={b.key} className="history-entry">
              <span className="history-label">{b.label}</span>
              <button className="btn-restore" disabled={restoring === b.key} onClick={() => restore(b)}>
                {restoring === b.key ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────

export default function TuewedEditorPage() {
  const [menu, setMenu]             = useState<TuewedMenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg]       = useState('');
  const [historyKey, setHistoryKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('/tueswed-preview');
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const prevJsonRef = useRef<string>('');

  useEffect(() => {
    fetch('/api/tueswed')
      .then(r => r.json())
      .then(data => { setMenu(data); prevJsonRef.current = JSON.stringify(data); })
      .catch(() => setSaveStatus('error'));
  }, []);

  const debouncedMenu = useDebounce(menu, 800);

  const saveAndRefresh = useCallback(async (data: TuewedMenuData) => {
    const json = JSON.stringify(data);
    if (json === prevJsonRef.current) return;
    prevJsonRef.current = json;

    if (menuHasOverLimit(data)) {
      setSaveStatus('error');
      setSaveMsg('Fix fields shown in red before saving');
      return;
    }

    setSaveStatus('saving');
    setSaveMsg('Saving…');
    try {
      const res = await fetch('/api/tueswed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg  = body.issues
          ? body.issues.map((i: { message: string }) => i.message).join('; ')
          : (body.error || 'Save failed');
        setSaveStatus('error');
        setSaveMsg(msg);
        return;
      }
      setSaveStatus('saved');
      setSaveMsg('Saved');
      setHistoryKey(k => k + 1);
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SIENA_TUESWED_UPDATE', payload: data }, '*'
      );
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setSaveMsg('Network error');
    }
  }, []);

  useEffect(() => {
    if (debouncedMenu && prevJsonRef.current !== '') saveAndRefresh(debouncedMenu);
  }, [debouncedMenu, saveAndRefresh]);

  // ── New Week ────────────────────────────────────────────────────────────

  function handleNewWeek() {
    if (!confirm('Start a new week?\n\nThis will clear all course names and descriptions. The price and add-on will also be reset. Your current menu will be saved as a backup.')) return;
    setMenu(m => {
      if (!m) return m;
      return {
        ...m,
        courses: m.courses.map(c => ({ ...c, title: '', desc: '' })) as TuewedMenuData['courses'],
        addon: m.addon ? { title: '', desc: '', price: '' } : undefined,
      };
    });
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  function handleCourseChange(index: number, updated: TuewedCourse) {
    setMenu(m => {
      if (!m) return m;
      const courses = [...m.courses] as TuewedMenuData['courses'];
      courses[index] = updated;
      return { ...m, courses };
    });
  }

  function handleAddonToggle(on: boolean) {
    setMenu(m => m && { ...m, addon: on ? { title: '', desc: '', price: '' } : undefined });
  }

  function handleAddonChange(updated: TuewedAddon) {
    setMenu(m => m && { ...m, addon: updated });
  }

  function handlePolicyToggle(on: boolean) {
    setMenu(m => m && { ...m, policy_line: on ? '' : undefined });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (!menu) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading menu…
      </div>
    );
  }

  const showAddon  = menu.addon !== undefined;
  const showPolicy = menu.policy_line !== undefined;

  const saveStatusClass =
    saveStatus === 'saved'  ? 'save-status saved'  :
    saveStatus === 'saving' ? 'save-status saving' :
    saveStatus === 'error'  ? 'save-status error'  : 'save-status';

  return (
    <div className="app">

      {/* ── Editor pane ──────────────────────────────────────────── */}
      <div className="editor-pane">
        <div className="editor-header">
          <Link href="/" className="btn-back">← All Menus</Link>
          <h1>Tue–Wed $45 Prix Fixe</h1>
        </div>

        <div className="editor-scroll chef-mode">

          {/* Price */}
          <div className="page-group">
            <div className="page-group-label">Menu price</div>
            <div className="dish-row">
              <div className="dish-fields">
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <div className="field-label-row">
                    <label>Prix-fixe price</label>
                    <CharCount value={menu.price} max={L.price} />
                  </div>
                  <PriceInput
                    value={menu.price}
                    onChange={v => setMenu(m => m && { ...m, price: v })}
                    placeholder="45"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Three courses */}
          <div className="page-group">
            <div className="page-group-label">The three courses</div>
            <div className="dish-list">
              {menu.courses.map((course, i) => (
                <CourseCard key={course.id} course={course} index={i} onChange={handleCourseChange} />
              ))}
            </div>
          </div>

          {/* Add-on */}
          <div className="page-group">
            <div className="page-group-label">Add-on (optional)</div>
            <div className="dish-row">
              <div className="dish-fields">
                <div style={{ marginBottom: showAddon ? '12px' : 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#d4b57a', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <input
                      type="checkbox"
                      checked={showAddon}
                      onChange={e => handleAddonToggle(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#b8821e' }}
                    />
                    Include add-on this week
                  </label>
                  {!showAddon && (
                    <div style={{ fontSize: '12px', color: 'rgba(212,181,122,0.5)', marginTop: '4px', paddingLeft: '24px' }}>
                      e.g. wine pairing, cheese course
                    </div>
                  )}
                </div>

                {showAddon && menu.addon && (
                  <>
                    <div className="dish-field-row" style={{ alignItems: 'flex-end', marginBottom: '10px' }}>
                      <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
                        <div className="field-label-row">
                          <label>Title</label>
                          <CharCount value={menu.addon.title} max={L.addonTitle} />
                        </div>
                        <input
                          value={menu.addon.title}
                          onChange={e => handleAddonChange({ ...menu.addon!, title: e.target.value })}
                          placeholder="e.g. Wine Pairing"
                        />
                      </div>
                      <div className="field-group" style={{ width: '100px', flexShrink: 0, marginBottom: 0 }}>
                        <div className="field-label-row">
                          <label>Add $</label>
                          <CharCount value={menu.addon.price ?? ''} max={L.addonPrice} />
                        </div>
                        <PriceInput
                          value={menu.addon.price ?? ''}
                          onChange={v => handleAddonChange({ ...menu.addon!, price: v })}
                          placeholder="25"
                        />
                      </div>
                    </div>
                    <div className="field-group" style={{ marginBottom: 0 }}>
                      <div className="field-label-row">
                        <label>Note (optional)</label>
                        <CharCount value={menu.addon.desc ?? ''} max={L.addonDesc} />
                      </div>
                      <input
                        value={menu.addon.desc ?? ''}
                        onChange={e => handleAddonChange({ ...menu.addon!, desc: e.target.value })}
                        placeholder="e.g. Three wines, one per course"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Policy line */}
          <div className="page-group">
            <div className="page-group-label">Footer (optional)</div>
            <div className="dish-row">
              <div className="dish-fields">
                <div style={{ marginBottom: showPolicy ? '12px' : 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#d4b57a', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <input
                      type="checkbox"
                      checked={showPolicy}
                      onChange={e => handlePolicyToggle(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#b8821e' }}
                    />
                    Include policy line
                  </label>
                </div>
                {showPolicy && (
                  <div className="field-group" style={{ marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Policy line (HTML: &lt;strong&gt;, &lt;em&gt; allowed)</label>
                      <CharCount value={menu.policy_line ?? ''} max={L.policyLine} />
                    </div>
                    <textarea
                      rows={2}
                      value={menu.policy_line ?? ''}
                      onChange={e => setMenu(m => m && { ...m, policy_line: e.target.value })}
                      placeholder="e.g. <strong>No split checks.</strong>"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>{/* end editor-scroll */}

        <HistoryPanel
          key={historyKey}
          onRestore={data => {
            setMenu(data);
            prevJsonRef.current = JSON.stringify(data);
            setSaveStatus('saved');
            setSaveMsg('Restored');
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'SIENA_TUESWED_UPDATE', payload: data }, '*'
            );
            setTimeout(() => setSaveStatus('idle'), 3000);
          }}
        />

        <div className="editor-footer">
          <button className="btn-new-week" onClick={handleNewWeek}>New Week</button>
          <span className={saveStatusClass} style={{ flex: 1, marginLeft: '8px' }}>
            {saveStatus === 'saved'  ? '✓ Saved' :
             saveStatus === 'saving' ? 'Saving…' :
             saveStatus === 'error'  ? `⚠ ${saveMsg}` :
             'Auto-saves as you type'}
          </span>
          <button
            className="btn-print"
            onClick={() => {
              if (menu) localStorage.setItem('siena-tueswed-print-data', JSON.stringify(menu));
              window.open('/tueswed-print', '_blank');
            }}
          >
            Print Menu
          </button>
        </div>
      </div>

      {/* ── Preview pane ─────────────────────────────────────────── */}
      <div className="preview-pane">
        <div className="preview-toolbar">
          <span>Live preview</span>
          <button
            className="btn-ghost"
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px 10px' }}
            onClick={() => setPreviewUrl('/tueswed-preview?' + Date.now())}
          >
            ↺ Reload from server
          </button>
        </div>
        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="preview-iframe"
          title="Tue–Wed menu preview"
        />
      </div>

    </div>
  );
}
