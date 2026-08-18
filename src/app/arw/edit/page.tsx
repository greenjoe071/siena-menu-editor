'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

interface ArwItem {
  id: string;
  name: string;
  desc: string;
  upcharge: string;
}

interface ArwCourse {
  items: ArwItem[];
}

interface ArwMenuData {
  subtitle: string;
  courses: {
    antipasti: ArwCourse;
    entree: ArwCourse;
    dolci: ArwCourse;
  };
}

type CourseKey = 'antipasti' | 'entree' | 'dolci';

interface Violation { field: string; rule: string; lines: number }
interface ValidateReport { fits: boolean; overflowPx: number; violations: Violation[]; worstField: string | null }

// ── Char limits (must match BUILD-SPEC.md and arw-schema.ts — paste-safety
//    caps only, validate.js's live line-count check is authoritative) ──────
const L = {
  subtitle: 45,
  name:     40,
  desc:     140,
  upcharge: 3,
} as const;

const COURSES: { key: CourseKey; numeral: string; title: string }[] = [
  { key: 'antipasti', numeral: 'I',   title: 'Antipasti' },
  { key: 'entree',    numeral: 'II',  title: 'Entrée' },
  { key: 'dolci',     numeral: 'III', title: 'Dolci' },
];

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

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const cls = len > max ? 'char-count over' : len > max * 0.85 ? 'char-count warn' : 'char-count';
  return <span className={cls}>{len}/{max}</span>;
}

// ── Item slot ─────────────────────────────────────────────────────────────

function ItemSlotCard({
  item, index, violations, onChange,
}: {
  item: ArwItem;
  index: number;
  violations: Set<string>;
  onChange: (updated: ArwItem) => void;
}) {
  const isEmpty = !item.name.trim();
  const nameBad = violations.has(`${item.id}-name`);
  const descBad = violations.has(`${item.id}-desc`);

  function clearSlot() {
    if (isEmpty) return;
    if (!confirm(`Remove "${item.name}" from the menu?\n\nThis clears the slot. The dish grid will reflow automatically.`)) return;
    onChange({ ...item, name: '', desc: '', upcharge: '' });
  }

  return (
    <div className="dish-row">
      <div className="dish-row-header">
        <span className="dish-name-preview">
          Slot {index + 1}{isEmpty ? ' — empty' : ''}
        </span>
        {!isEmpty && (
          <button className="btn-remove-dish" title="Clear this slot" onClick={clearSlot}>×</button>
        )}
      </div>
      <div className="dish-fields">
        <div className="dish-field-row" style={{ alignItems: 'flex-end', gap: '10px' }}>
          <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
            <div className="field-label-row">
              <label>Dish name{nameBad && <span className="dd-chip dd-chip--bad" style={{ marginLeft: '6px' }}>wraps to 2 lines</span>}</label>
              <CharCount value={item.name} max={L.name} />
            </div>
            <input
              value={item.name}
              onChange={e => onChange({ ...item, name: e.target.value })}
              placeholder="Dish name"
            />
          </div>
          <div className="field-group" style={{ width: '90px', flexShrink: 0, marginBottom: 0 }}>
            <div className="field-label-row">
              <label>+$</label>
              <CharCount value={item.upcharge} max={L.upcharge} />
            </div>
            <input
              value={item.upcharge}
              onChange={e => onChange({ ...item, upcharge: filterDigits(e.target.value) })}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="field-group" style={{ marginBottom: 0, marginTop: '8px' }}>
          <div className="field-label-row">
            <label>Description{descBad && <span className="dd-chip dd-chip--bad" style={{ marginLeft: '6px' }}>too long (max 2 lines)</span>}</label>
            <CharCount value={item.desc} max={L.desc} />
          </div>
          <textarea
            rows={2}
            value={item.desc}
            onChange={e => onChange({ ...item, desc: e.target.value })}
            placeholder="Ingredients"
          />
        </div>
      </div>
    </div>
  );
}

function CourseSection({
  courseKey, numeral, title, course, violations, onItemChange,
}: {
  courseKey: CourseKey;
  numeral: string;
  title: string;
  course: ArwCourse;
  violations: Set<string>;
  onItemChange: (courseKey: CourseKey, itemId: string, updated: ArwItem) => void;
}) {
  const filledCount = course.items.filter(it => it.name.trim()).length;
  return (
    <div className="page-group">
      <div className="page-group-label">
        {numeral} — {title} <span style={{ opacity: 0.6, fontWeight: 400 }}>({filledCount}/{course.items.length} filled)</span>
      </div>
      <div className="dish-list">
        {course.items.map((item, i) => (
          <ItemSlotCard
            key={item.id}
            item={item}
            index={i}
            violations={violations}
            onChange={updated => onItemChange(courseKey, item.id, updated)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────

export default function ArwEditorPage() {
  // "Fix a Mistake" (/arw/fix) reuses this exact editor — same fields, same
  // validation, same live preview — but reads/writes the LIVE menu directly
  // instead of a draft, and hides the publish/discard footer.
  const pathname = usePathname();
  const isFix = pathname?.endsWith('/fix') ?? false;
  const apiPath = isFix ? '/api/arw/fix' : '/api/arw/draft';

  const [menu, setMenu]                     = useState<ArwMenuData | null>(null);
  const [saveStatus, setSaveStatus]         = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg]               = useState('');
  const [previewUrl, setPreviewUrl]         = useState(`/arw-preview?src=${isFix ? 'current' : 'draft'}`);
  const [report, setReport]                 = useState<ValidateReport | null>(null);
  const iframeRef       = useRef<HTMLIFrameElement>(null);
  const prevJsonRef     = useRef<string>('');
  const pendingSaveRef  = useRef<ArwMenuData | null>(null);

  useEffect(() => {
    fetch(apiPath)
      .then(r => r.json())
      .then(data => {
        setMenu(data);
        prevJsonRef.current = JSON.stringify(data);
      })
      .catch(() => setSaveStatus('error'));
  }, [apiPath]);

  const debouncedMenu = useDebounce(menu, 800);

  // Server save — only called after validation confirms the page fits
  const saveToServer = useCallback(async (data: ArwMenuData) => {
    const json = JSON.stringify(data);
    if (json === prevJsonRef.current) return;
    prevJsonRef.current = json;
    setSaveStatus('saving');
    setSaveMsg('Saving…');
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.issues
          ? body.issues.map((i: { message: string }) => i.message).join('; ')
          : (body.error || 'Save failed');
        setSaveStatus('error');
        setSaveMsg(msg);
        return;
      }
      setSaveStatus('saved');
      setSaveMsg('Saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setSaveMsg('Network error');
    }
  }, [apiPath]);

  // ── Validation listener ─────────────────────────────────────────────────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || e.data.type !== 'SIENA_ARW_VALIDATE_RESULT') return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const rep = e.data.report as ValidateReport;
      setReport(rep);
      if (rep.fits) {
        if (pendingSaveRef.current) {
          saveToServer(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }
      } else {
        pendingSaveRef.current = null;
        setSaveStatus('error');
        if (rep.overflowPx > 0 && rep.violations.length === 0) {
          setSaveMsg('Page is too long to fit — shorten a description or remove an item');
        } else if (rep.worstField) {
          const label = rep.worstField === 'subtitle' ? 'the subtitle' : `"${rep.worstField}"`;
          setSaveMsg(`Content overflows in ${label} — shorten the text`);
        } else {
          setSaveMsg('Content overflows — shorten the text');
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [saveToServer]);

  // Debounce menu edits → send to iframe for live preview + validation
  useEffect(() => {
    if (!debouncedMenu || prevJsonRef.current === '') return;
    pendingSaveRef.current = debouncedMenu;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SIENA_ARW_UPDATE', payload: debouncedMenu },
      '*'
    );
  }, [debouncedMenu]);

  // ── Mutations ───────────────────────────────────────────────────────────

  function handleItemChange(courseKey: CourseKey, itemId: string, updated: ArwItem) {
    setMenu(m => {
      if (!m) return m;
      const items = m.courses[courseKey].items.map(it => (it.id === itemId ? updated : it));
      return { ...m, courses: { ...m.courses, [courseKey]: { items } } };
    });
  }

  // ── Publish / discard ──────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    if (!menu) return;
    if (!confirm('Make this draft the current menu?\n\nThe menu people are printing now will be moved to "Past Menus," and this draft becomes the current menu dated today.')) return;
    setPublishing(true);
    setSaveMsg('Publishing…');
    try {
      await fetch('/api/arw/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menu) });
      const res = await fetch('/api/arw/publish', { method: 'POST' });
      if (!res.ok) { setPublishing(false); setSaveStatus('error'); setSaveMsg('Publish failed — try again'); return; }
      window.location.href = '/arw';
    } catch { setPublishing(false); setSaveStatus('error'); setSaveMsg('Network error while publishing'); }
  }

  async function handleDiscard() {
    if (!confirm('Discard this draft?\n\nAll changes since the current menu will be lost. The current menu is not affected.')) return;
    try { await fetch('/api/arw/draft', { method: 'DELETE' }); }
    finally { window.location.href = '/arw'; }
  }

  if (!menu) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading menu…
      </div>
    );
  }

  const violationFields = new Set((report?.violations ?? []).map(v => v.field));
  const subtitleBad = violationFields.has('subtitle');
  const anyOverflow = report ? !report.fits : false;

  const saveStatusClass =
    saveStatus === 'saved'  ? 'save-status saved'  :
    saveStatus === 'saving' ? 'save-status saving' :
    saveStatus === 'error'  ? 'save-status error'  : 'save-status';

  return (
    <div className="app">

      {/* ── Editor pane ──────────────────────────────────────────── */}
      <div className="editor-pane">
        <div className="editor-header">
          <Link href="/arw" className="btn-back">← Back</Link>
          <h1>Austin Restaurant Weeks</h1>
          <Link href="/" className="btn-home">🏠 Home</Link>
        </div>

        {anyOverflow && (
          <div className="overflow-banner">
            ⚠ {saveMsg || 'Menu is too long to fit on one page'}
          </div>
        )}

        {isFix ? (
          <div className="draft-banner fix-banner">
            ✏️ You&rsquo;re editing the <strong>live menu</strong>. Every change saves right away — there&rsquo;s no draft and no publish step.
          </div>
        ) : (
          <div className="draft-banner">
            ✎ You&rsquo;re editing a <strong>draft</strong>. The current menu stays locked and unchanged until you press <strong>Make This the Current Menu</strong>.
          </div>
        )}

        <div className="editor-scroll chef-mode">

          <div className="weekend-instructions" style={{ margin: '12px 0 8px' }}>
            <p>Three fixed courses — 5 Antipasti, 8 Entr&eacute;e, 3 Dolci. You can edit any dish or clear a slot to remove it, but slots can&rsquo;t be added. The $50 price, dates, and all other page chrome are locked.</p>
          </div>

          {/* Subtitle */}
          <div className="page-group">
            <div className="page-group-label">Subtitle</div>
            <div className="dish-row">
              <div className="dish-fields">
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <div className="field-label-row">
                    <label>Menu subtitle{subtitleBad && <span className="dd-chip dd-chip--bad" style={{ marginLeft: '6px' }}>wraps to 2 lines</span>}</label>
                    <CharCount value={menu.subtitle} max={L.subtitle} />
                  </div>
                  <input
                    value={menu.subtitle}
                    onChange={e => setMenu(m => m && { ...m, subtitle: e.target.value })}
                    placeholder="Three-Course Prix Fixe Dinner"
                  />
                </div>
              </div>
            </div>
          </div>

          {COURSES.map(c => (
            <CourseSection
              key={c.key}
              courseKey={c.key}
              numeral={c.numeral}
              title={c.title}
              course={menu.courses[c.key]}
              violations={violationFields}
              onItemChange={handleItemChange}
            />
          ))}

        </div>{/* end editor-scroll */}

        {!isFix && (
          <div className="editor-footer editor-footer--publish">
            <button className="btn-discard-draft" onClick={handleDiscard} disabled={publishing}>Discard Draft</button>
            <span className="publish-hint">You&rsquo;re editing a draft — the current menu is unchanged until you publish.</span>
            <button className="btn-publish" onClick={handlePublish} disabled={publishing}>{publishing ? 'Publishing…' : 'Make This the Current Menu'}</button>
          </div>
        )}
        <div className="editor-footer">
          <span className={saveStatusClass} style={{ flex: 1 }}>
            {saveStatus === 'saved'  ? '✓ Saved' :
             saveStatus === 'saving' ? 'Saving…' :
             saveStatus === 'error'  ? `⚠ ${saveMsg}` :
             'Auto-saves as you type'}
          </span>
          <button
            className="btn-print"
            disabled={anyOverflow}
            title={anyOverflow ? 'Menu overflows — shorten text before printing' : undefined}
            onClick={() => {
              if (menu) localStorage.setItem('siena-arw-print-data', JSON.stringify(menu));
              window.open(`/arw-print?src=${isFix ? 'current' : 'draft'}`, '_blank');
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
            onClick={() => setPreviewUrl(`/arw-preview?src=${isFix ? 'current' : 'draft'}&` + Date.now())}
          >
            ↺ Reload from server
          </button>
        </div>
        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="preview-iframe"
          title="ARW menu preview"
        />
      </div>

    </div>
  );
}
