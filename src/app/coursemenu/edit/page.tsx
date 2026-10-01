'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// Generic 2–4 course menu editor (handoff-coursemenu). Same flow as Tue–Wed:
// /coursemenu/edit edits the draft, /coursemenu/fix (same component) edits the
// live menu. Layout-budget model — the validator in the preview iframe decides
// whether a change fits; nothing saves while it doesn't (BUILD-SPEC §4).

// ── Types ─────────────────────────────────────────────────────────────────

type CourseId = 'course-1' | 'course-2' | 'course-3' | 'course-4';

interface Course {
  id: CourseId;
  title: string;
  desc: string;
}

interface CourseMenuData {
  header: string;
  price: string;
  description: string;
  courses: Course[];
  addon: { title: string; price: string; desc: string };
  footer: { enabled: boolean; policy_line: string };
}

interface ValidateIssue { code: string; section: string | null; message: string }
interface ValidateReport { fits: boolean; issues?: ValidateIssue[]; worstSection?: string | null }

// Paste-safety caps (must match coursemenu-schema.ts — the validator is authoritative)
const L = {
  header:      60,
  price:       3,
  description: 120,
  courseTitle: 60,
  courseDesc:  240,
  addonTitle:  40,
  addonPrice:  3,
  addonDesc:   120,
  policyLine:  300,
} as const;

const MIN_COURSES = 2;
const MAX_COURSES = 4;
const ROMAN = ['I', 'II', 'III', 'IV'] as const;
const COUNT_WORDS = ['', '', 'Two', 'Three', 'Four'] as const;
const headerFor = (n: number) => `${COUNT_WORDS[n]} Course Special`;

// Removing/adding courses renumbers them; ids always follow position.
function renumber(courses: Course[]): Course[] {
  return courses.map((c, i) => ({ ...c, id: `course-${i + 1}` as CourseId }));
}

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

function PriceInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="price-input-wrap">
      <span className="price-dollar">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        maxLength={L.price}
        onChange={e => onChange(filterDigits(e.target.value))}
        placeholder={placeholder}
        style={{ width: '60px' }}
      />
    </div>
  );
}

const toggleLabelStyle = {
  display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#d4b57a',
  fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em',
} as const;
const toggleBoxStyle = { width: '16px', height: '16px', cursor: 'pointer', accentColor: '#b8821e' } as const;

// ── CourseCard ────────────────────────────────────────────────────────────

function CourseCard({ course, index, canRemove, flagged, onChange, onRemove }: {
  course: Course;
  index: number;
  canRemove: boolean;
  flagged: boolean;
  onChange: (index: number, updated: Course) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="dish-row" style={flagged ? { outline: '2px solid #c0392b', outlineOffset: '2px' } : undefined}>
      <div className="dish-row-header">
        <span className="dish-name-preview">
          {ROMAN[index]} — {course.title || 'Course ' + ROMAN[index]}
        </span>
        <button
          className="btn-remove-dish"
          disabled={!canRemove}
          title={canRemove ? 'Remove this course' : `A menu needs at least ${MIN_COURSES} courses`}
          onClick={() => onRemove(index)}
        >×</button>
      </div>
      <div className="dish-fields">
        <div className="field-group">
          <div className="field-label-row">
            <label>Dish name</label>
            <CharCount value={course.title} max={L.courseTitle} />
          </div>
          <input
            value={course.title}
            maxLength={L.courseTitle}
            onChange={e => onChange(index, { ...course, title: e.target.value })}
            placeholder="e.g. Risotto ai Funghi"
          />
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <div className="field-label-row">
            <label>Description (optional)</label>
            <CharCount value={course.desc} max={L.courseDesc} />
          </div>
          <textarea
            rows={2}
            value={course.desc}
            maxLength={L.courseDesc}
            onChange={e => onChange(index, { ...course, desc: e.target.value })}
            placeholder="Ingredients and preparation"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────

export default function CourseMenuEditorPage() {
  const pathname = usePathname();
  const isFix = pathname?.endsWith('/fix') ?? false;
  const apiPath = isFix ? '/api/coursemenu/fix' : '/api/coursemenu/draft';
  const src = isFix ? 'current' : 'draft';

  const [menu, setMenu]             = useState<CourseMenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg]       = useState('');
  const [previewUrl, setPreviewUrl] = useState(`/coursemenu-preview?src=${src}`);
  const [report, setReport]         = useState<ValidateReport | null>(null);
  // Add-on is "on" when it has a title; this keeps the fields open while the
  // title is still blank right after ticking the box.
  const [addonOpen, setAddonOpen]   = useState(false);
  const iframeRef      = useRef<HTMLIFrameElement>(null);
  const prevJsonRef    = useRef<string>('');
  const pendingSaveRef = useRef<CourseMenuData | null>(null);

  useEffect(() => {
    fetch(apiPath)
      .then(r => r.json())
      .then((data: CourseMenuData) => {
        setMenu(data);
        prevJsonRef.current = JSON.stringify(data);
      })
      .catch(() => setSaveStatus('error'));
  }, [apiPath]);

  const debouncedMenu = useDebounce(menu, 800);

  // Server save — only called after validation confirms the page fits
  const saveToServer = useCallback(async (data: CourseMenuData) => {
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
        const msg  = body.issues
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
      if (!e.data || e.data.type !== 'SIENA_COURSEMENU_VALIDATE_RESULT') return;
      const r = e.data.report as ValidateReport;
      setReport(r);
      if (r.fits) {
        if (pendingSaveRef.current) {
          saveToServer(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }
      } else {
        pendingSaveRef.current = null;
        setSaveStatus('error');
        setSaveMsg('Not saved — fix the highlighted problem first');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [saveToServer]);

  // Debounce edits → send to iframe for live preview + validation
  useEffect(() => {
    if (!debouncedMenu || prevJsonRef.current === '') return;
    pendingSaveRef.current = debouncedMenu;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SIENA_COURSEMENU_UPDATE', payload: debouncedMenu },
      '*'
    );
  }, [debouncedMenu]);

  // ── Mutations ───────────────────────────────────────────────────────────

  // When the course count changes, swap the header to match — but only if
  // it's still one of the auto-suggested headers (never overwrite typed text).
  function withCourses(m: CourseMenuData, courses: Course[]): CourseMenuData {
    const autoHeader = m.header.trim() === '' || m.header === headerFor(m.courses.length);
    return { ...m, courses: renumber(courses), header: autoHeader ? headerFor(courses.length) : m.header };
  }

  function handleCourseChange(index: number, updated: Course) {
    setMenu(m => {
      if (!m) return m;
      const courses = [...m.courses];
      courses[index] = updated;
      return { ...m, courses };
    });
  }

  function handleAddCourse() {
    setMenu(m => m && m.courses.length < MAX_COURSES
      ? withCourses(m, [...m.courses, { id: 'course-4', title: '', desc: '' }])
      : m);
  }

  function handleRemoveCourse(index: number) {
    if (!menu) return;
    const c = menu.courses[index];
    if ((c.title || c.desc) && !confirm(`Remove course ${ROMAN[index]}${c.title ? ` (${c.title})` : ''}?`)) return;
    setMenu(m => m && m.courses.length > MIN_COURSES
      ? withCourses(m, m.courses.filter((_, i) => i !== index))
      : m);
  }

  function handleClearAll() {
    if (!confirm('Clear the menu?\n\nThis blanks the price, description, every dish, and the add-on so you can start fresh. The number of courses and the footer stay.')) return;
    setMenu(m => m && {
      ...m,
      price: '',
      description: '',
      courses: m.courses.map(c => ({ ...c, title: '', desc: '' })),
      addon: { title: '', price: '', desc: '' },
    });
  }

  // ── Publish / discard ──────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);

  function missingRequired(m: CourseMenuData): string[] {
    const missing: string[] = [];
    if (!m.header.trim()) missing.push('the header');
    if (!m.price.trim()) missing.push('the price');
    m.courses.forEach((c, i) => { if (!c.title.trim()) missing.push(`the course ${ROMAN[i]} dish name`); });
    return missing;
  }

  async function handlePublish() {
    if (!menu) return;
    const missing = missingRequired(menu);
    if (missing.length) { alert(`Before publishing, fill in ${missing.join(', ')}.`); return; }
    if (report && !report.fits) { alert('The menu doesn’t fit on the page yet — fix the problem shown at the top first.'); return; }
    if (!confirm('Make this draft the current menu?\n\nThe menu people are printing now will be moved to "Past Menus," and this draft becomes the current menu dated today.')) return;
    setPublishing(true);
    setSaveMsg('Publishing…');
    try {
      await fetch('/api/coursemenu/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menu) });
      const res = await fetch('/api/coursemenu/publish', { method: 'POST' });
      if (!res.ok) { setPublishing(false); setSaveStatus('error'); setSaveMsg('Publish failed — try again'); return; }
      window.location.href = '/coursemenu';
    } catch { setPublishing(false); setSaveStatus('error'); setSaveMsg('Network error while publishing'); }
  }

  async function handleDiscard() {
    if (!confirm('Discard this draft?\n\nAll changes since the current menu will be lost. The current menu is not affected.')) return;
    try { await fetch('/api/coursemenu/draft', { method: 'DELETE' }); }
    finally { window.location.href = '/coursemenu'; }
  }

  if (!menu) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading menu…
      </div>
    );
  }

  const issues = report && !report.fits ? report.issues ?? [] : [];
  const flagged = new Set(issues.map(i => i.section));
  const showAddon = menu.addon.title !== '' || addonOpen;
  const n = menu.courses.length;

  const saveStatusClass =
    saveStatus === 'saved'  ? 'save-status saved'  :
    saveStatus === 'saving' ? 'save-status saving' :
    saveStatus === 'error'  ? 'save-status error'  : 'save-status';

  const flagStyle = (section: string) =>
    flagged.has(section) ? { outline: '2px solid #c0392b', outlineOffset: '2px' } : undefined;

  return (
    <div className="app">

      {/* ── Editor pane ──────────────────────────────────────────── */}
      <div className="editor-pane">
        <div className="editor-header">
          <Link href="/coursemenu" className="btn-back">← Back</Link>
          <h1>Generic Menu</h1>
          <Link href="/" className="btn-home">🏠 Home</Link>
        </div>

        {issues.length > 0 && (
          <div className="overflow-banner">
            {issues.map(i => <div key={i.code}>⚠ {i.message}</div>)}
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

          {/* Header + price + description */}
          <div className="page-group">
            <div className="page-group-label">Top of the menu</div>
            <div className="dish-row" style={flagStyle('hero') ?? flagStyle('description')}>
              <div className="dish-fields">
                <div className="dish-field-row" style={{ alignItems: 'flex-end', marginBottom: '10px' }}>
                  <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Header</label>
                      <CharCount value={menu.header} max={L.header} />
                    </div>
                    <input
                      value={menu.header}
                      maxLength={L.header}
                      onChange={e => setMenu(m => m && { ...m, header: e.target.value })}
                      placeholder={headerFor(n)}
                    />
                  </div>
                  <div className="field-group" style={{ width: '100px', flexShrink: 0, marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Price</label>
                    </div>
                    <PriceInput
                      value={menu.price}
                      onChange={v => setMenu(m => m && { ...m, price: v })}
                      placeholder="55"
                    />
                  </div>
                </div>
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <div className="field-label-row">
                    <label>One-line description (optional)</label>
                    <CharCount value={menu.description} max={L.description} />
                  </div>
                  <input
                    value={menu.description}
                    maxLength={L.description}
                    onChange={e => setMenu(m => m && { ...m, description: e.target.value })}
                    placeholder="e.g. Available for a limited time"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Courses */}
          <div className="page-group">
            <div className="page-group-label">The courses ({n} of {MAX_COURSES})</div>
            <div className="dish-list">
              {menu.courses.map((course, i) => (
                <CourseCard
                  key={i}
                  course={course}
                  index={i}
                  canRemove={n > MIN_COURSES}
                  flagged={flagged.has(course.id)}
                  onChange={handleCourseChange}
                  onRemove={handleRemoveCourse}
                />
              ))}
            </div>
            <button className="btn-add-dish" disabled={n >= MAX_COURSES} onClick={handleAddCourse}>
              {n >= MAX_COURSES ? `${MAX_COURSES} courses is the most this menu holds` : `+ Add course ${ROMAN[n]}`}
            </button>
          </div>

          {/* Add-on */}
          <div className="page-group">
            <div className="page-group-label">Add-on (optional)</div>
            <div className="dish-row" style={flagStyle('addon')}>
              <div className="dish-fields">
                <div style={{ marginBottom: showAddon ? '12px' : 0 }}>
                  <label style={toggleLabelStyle}>
                    <input
                      type="checkbox"
                      checked={showAddon}
                      onChange={e => {
                        setAddonOpen(e.target.checked);
                        if (!e.target.checked) setMenu(m => m && { ...m, addon: { title: '', price: '', desc: '' } });
                      }}
                      style={toggleBoxStyle}
                    />
                    Include an add-on
                  </label>
                  {!showAddon && (
                    <div style={{ fontSize: '12px', color: 'rgba(212,181,122,0.5)', marginTop: '4px', paddingLeft: '24px' }}>
                      e.g. wine pairing, espresso &amp; biscotti
                    </div>
                  )}
                </div>

                {showAddon && (
                  <>
                    <div className="dish-field-row" style={{ alignItems: 'flex-end', marginBottom: '10px' }}>
                      <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
                        <div className="field-label-row">
                          <label>Title</label>
                          <CharCount value={menu.addon.title} max={L.addonTitle} />
                        </div>
                        <input
                          value={menu.addon.title}
                          maxLength={L.addonTitle}
                          onChange={e => setMenu(m => m && { ...m, addon: { ...m.addon, title: e.target.value } })}
                          placeholder="e.g. Wine Pairing"
                        />
                      </div>
                      <div className="field-group" style={{ width: '100px', flexShrink: 0, marginBottom: 0 }}>
                        <div className="field-label-row">
                          <label>Add $</label>
                        </div>
                        <PriceInput
                          value={menu.addon.price}
                          onChange={v => setMenu(m => m && { ...m, addon: { ...m.addon, price: v } })}
                          placeholder="25"
                        />
                      </div>
                    </div>
                    <div className="field-group" style={{ marginBottom: 0 }}>
                      <div className="field-label-row">
                        <label>Note (optional)</label>
                        <CharCount value={menu.addon.desc} max={L.addonDesc} />
                      </div>
                      <input
                        value={menu.addon.desc}
                        maxLength={L.addonDesc}
                        onChange={e => setMenu(m => m && { ...m, addon: { ...m.addon, desc: e.target.value } })}
                        placeholder="e.g. Three wines, one per course"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="page-group">
            <div className="page-group-label">Footer</div>
            <div className="dish-row" style={flagStyle('footer')}>
              <div className="dish-fields">
                <label style={{ ...toggleLabelStyle, marginBottom: menu.footer.enabled ? '12px' : 0 }}>
                  <input
                    type="checkbox"
                    checked={menu.footer.enabled}
                    onChange={e => setMenu(m => m && { ...m, footer: { ...m.footer, enabled: e.target.checked } })}
                    style={toggleBoxStyle}
                  />
                  Show the policy line
                </label>
                {menu.footer.enabled && (
                  <div className="field-group" style={{ marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Policy line (HTML: &lt;strong&gt; allowed)</label>
                      <CharCount value={menu.footer.policy_line} max={L.policyLine} />
                    </div>
                    <textarea
                      rows={2}
                      value={menu.footer.policy_line}
                      maxLength={L.policyLine}
                      onChange={e => setMenu(m => m && { ...m, footer: { ...m.footer, policy_line: e.target.value } })}
                      placeholder="e.g. <strong>No split checks.</strong>"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>{/* end editor-scroll */}

        {!isFix && (
          <div className="editor-footer editor-footer--publish">
            <button className="btn-discard-draft" onClick={handleDiscard} disabled={publishing}>Discard Draft</button>
            <span className="publish-hint">You&rsquo;re editing a draft — the current menu is unchanged until you publish.</span>
            <button className="btn-publish" onClick={handlePublish} disabled={publishing}>{publishing ? 'Publishing…' : 'Make This the Current Menu'}</button>
          </div>
        )}
        <div className="editor-footer">
          {!isFix && <button className="btn-new-week" onClick={handleClearAll}>Clear All</button>}
          <span className={saveStatusClass} style={{ flex: 1, marginLeft: '8px' }}>
            {saveStatus === 'saved'  ? '✓ Saved' :
             saveStatus === 'saving' ? 'Saving…' :
             saveStatus === 'error'  ? `⚠ ${saveMsg}` :
             'Auto-saves as you type'}
          </span>
          <button
            className="btn-print"
            disabled={issues.length > 0}
            title={issues.length > 0 ? 'Fix the problem shown at the top before printing' : undefined}
            onClick={() => {
              localStorage.setItem('siena-coursemenu-print-data', JSON.stringify(menu));
              window.open(`/coursemenu-print?src=${src}`, '_blank');
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
            onClick={() => setPreviewUrl(`/coursemenu-preview?src=${src}&` + Date.now())}
          >
            ↺ Reload from server
          </button>
        </div>
        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="preview-iframe"
          title="Generic menu preview"
        />
      </div>

    </div>
  );
}
