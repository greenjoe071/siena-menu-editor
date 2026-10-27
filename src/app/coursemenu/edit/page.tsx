'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSaveSafety } from '@/lib/use-save-safety';
import EarlierVersions from '@/components/EarlierVersions';
import ProblemPopup, { ProblemNote, type Problem, type PopupRequest } from '@/components/ProblemPopup';
import { publishErrorMessage } from '@/lib/publish-error';

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

// Validator issues -> plain words (Oct 2026: one big pop-up, child-simple).
function plainProblems(issues: ValidateIssue[]): Problem[] {
  return issues.map((i): Problem => {
    const course = /^course-(\d)$/.exec(i.section ?? '');
    switch (i.code) {
      case 'header-wrap':
        return { key: i.code, target: 'hero', title: 'The menu name is too long.', body: 'It has to fit on one line next to the price. Make it shorter.' };
      case 'desc-overflow':
        return { key: i.code, target: 'description', title: 'The line under the menu name is too long.', body: 'It has to fit on one line. Make it shorter.' };
      case 'course-count':
        return { key: i.code, title: 'A menu needs 2 to 4 courses.', body: 'Pick 2, 3, or 4 at the top.' };
      case 'page-overflow':
        return course
          ? { key: i.code, target: i.section!, title: 'The menu is too long for the page.', body: `Make Course ${ROMAN[+course[1] - 1]}’s description shorter.` }
          : { key: i.code, target: i.section ?? undefined, title: 'The menu is too long for the page.', body: 'Make a description shorter.' };
      default:
        return { key: i.code, target: i.section ?? undefined, title: 'Something doesn’t fit on the menu.', body: i.message };
    }
  });
}

// Words sent to the AI spelling check (Oct 2026), each labelled so Claude
// knows what it's reading. ids match setSpellField below.
interface SpellSuggestion { fieldId: string; original: string; suggestion: string; kind: 'misspelled' | 'style'; why: string }
function spellFields(m: CourseMenuData): { id: string; label: string; text: string }[] {
  const out = [
    { id: 'header', label: 'Menu name at the top', text: m.header },
    { id: 'description', label: 'One-line description under the menu name', text: m.description },
  ];
  m.courses.forEach((c, i) => {
    out.push({ id: `${c.id}.title`, label: `Course ${ROMAN[i]} dish name`, text: c.title });
    out.push({ id: `${c.id}.desc`, label: `Course ${ROMAN[i]} description`, text: c.desc });
  });
  out.push({ id: 'addon.title', label: 'Add-on name', text: m.addon.title });
  out.push({ id: 'addon.desc', label: 'Add-on note', text: m.addon.desc });
  return out.filter((f) => f.text.trim());
}
function spellTarget(fieldId: string): string {
  if (fieldId === 'header') return 'hero';
  if (fieldId === 'description') return 'description';
  if (fieldId.startsWith('addon')) return 'addon';
  return fieldId.split('.')[0];
}
function spellFieldName(fieldId: string): string {
  const course = /^course-(\d)\.(title|desc)$/.exec(fieldId);
  if (course) return `Course ${ROMAN[+course[1] - 1]}${course[2] === 'desc' ? ' description' : ''}`;
  return ({ header: 'the menu name', description: 'the line under the menu name', 'addon.title': 'the add-on', 'addon.desc': 'the add-on note' } as Record<string, string>)[fieldId] ?? 'the menu';
}

// Things worth a second look at Print / Make Active (Oct 2026). Nothing is
// ever blocked — the pop-up asks "Is this on purpose?". serious = red.
function menuChecks(m: CourseMenuData): Problem[] {
  const out: Problem[] = [];
  const has = (v: string) => v.trim() !== '';
  if (!has(m.header)) out.push({ key: 'no-header', target: 'hero', serious: true,
    title: 'The menu has no name at the top.', body: 'The top of the menu will be blank.' });
  m.courses.forEach((c, i) => {
    const n = ROMAN[i];
    if (!has(c.title) && !has(c.desc)) out.push({ key: `${c.id}-empty`, target: c.id, serious: true,
      title: `Course ${n} is empty.`, body: `It will print as a lonely “${n}” with nothing under it.` });
    else if (!has(c.title)) out.push({ key: `${c.id}-no-name`, target: c.id, serious: true,
      title: `Course ${n} has a description but no dish name.`, body: 'The description will print with no name above it.' });
    else if (!has(c.desc)) out.push({ key: `${c.id}-no-desc`, target: c.id,
      title: `Course ${n} (${c.title.trim()}) has no description.`, body: 'Only the dish name will print.' });
  });
  if (!has(m.price)) out.push({ key: 'no-price', target: 'price',
    title: 'There\u2019s no price on this menu.', body: 'No price will print at the top.' });
  const a = m.addon;
  if (has(a.title) && !has(a.price)) out.push({ key: 'addon-no-price', target: 'addon',
    title: `The add-on \u201c${a.title.trim()}\u201d has no price.`, body: 'It will print without one.' });
  if (!has(a.title) && (has(a.price) || has(a.desc))) out.push({ key: 'addon-no-name', target: 'addon',
    title: 'The add-on has no name.', body: 'Without a name, the add-on won\u2019t print at all.' });
  return out;
}

function CourseCard({ course, index, count, flagged, problem, onChange, onMove }: {
  course: Course;
  index: number;
  count: number;
  flagged: boolean;
  problem?: Problem;
  onChange: (index: number, updated: Course) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  return (
    <div className="dish-row" data-problem={course.id} style={flagged ? { outline: '3px solid #c0392b', outlineOffset: '2px' } : undefined}>
      <div className="dish-row-header">
        <span className="dish-name-preview">
          {ROMAN[index]} — {course.title || 'Course ' + ROMAN[index]}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
          <button
            className="btn-move-course"
            disabled={index === 0}
            title="Move this course up"
            onClick={() => onMove(index, -1)}
          >↑</button>
          <button
            className="btn-move-course"
            disabled={index === count - 1}
            title="Move this course down"
            onClick={() => onMove(index, 1)}
          >↓</button>
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
        <ProblemNote problem={problem} />
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
  // Safety net: browser copy, retries, save-on-leave (see use-save-safety.tsx).
  const [loadedJson, setLoadedJson] = useState<string | null>(null);
  // Page-fit problem shown in the footer — a warning only; saving never waits on it.
  const [fitMsg, setFitMsg] = useState('');
  const [popupReq, setPopupReq] = useState<PopupRequest | null>(null);
  // Things Chef already answered "yes, on purpose" — not asked again until they change.
  const [okd, setOkd] = useState<Set<string>>(new Set());
  const [spellBusy, setSpellBusy] = useState(false);
  // Show Check Spelling only once the AI key is set up on the server.
  const [spellOn, setSpellOn] = useState(false);
  useEffect(() => { fetch('/api/spellcheck').then(r => r.json()).then(d => setSpellOn(!!d.configured)).catch(() => {}); }, []);
  const { confirmSaved, banner: recoveryBanner } = useSaveSafety({
    storageKey: 'coursemenu:' + (isFix ? 'fix' : 'draft'), url: apiPath, payload: menu, loadedJson,
    setSaveStatus, setSaveMsg, onRestore: setMenu,
  });
  const menuRef = useRef(menu);
  menuRef.current = menu;
  const [previewUrl, setPreviewUrl] = useState(`/coursemenu-preview?src=${src}`);
  const [report, setReport]         = useState<ValidateReport | null>(null);
  // Add-on is "on" when it has a title; this keeps the fields open while the
  // title is still blank right after ticking the box.
  const [addonOpen, setAddonOpen]   = useState(false);
  const [everPublished, setEverPublished] = useState(true);
  const iframeRef      = useRef<HTMLIFrameElement>(null);
  const prevJsonRef    = useRef<string>('');

  useEffect(() => {
    fetch(apiPath)
      .then(r => r.json())
      .then((data: CourseMenuData) => {
        setMenu(data);
        prevJsonRef.current = JSON.stringify(data); setLoadedJson(prevJsonRef.current);
      })
      .catch(() => setSaveStatus('error'));
  }, [apiPath]);

  useEffect(() => {
    fetch('/api/coursemenu/status').then(r => r.json()).then(d => setEverPublished(!!d.published)).catch(() => {});
  }, []);

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
      setSaveStatus('saved'); confirmSaved(json);
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
      // Only the editor's own preview — not an Earlier Versions preview.
      if (e.source !== iframeRef.current?.contentWindow) return;
      const r = e.data.report as ValidateReport;
      setReport(r);
      setFitMsg(r.fits ? '' : 'Doesn’t fit the page yet — fix the highlighted problem before printing');
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [saveToServer]);

  // Debounce edits → send to iframe for live preview + validation
  useEffect(() => {
    if (!debouncedMenu || prevJsonRef.current === '') return;
    saveToServer(debouncedMenu);   // typing always saves; fit is only a warning
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

  // The 2 / 3 / 4 picker at the top. Going down drops courses off the END
  // (use the arrows first to keep a different one) — confirm if they have text.
  function handleSetCount(target: number) {
    if (!menu || target === menu.courses.length) return;
    if (target < menu.courses.length) {
      const dropped = menu.courses.slice(target).filter(c => c.title || c.desc);
      if (dropped.length && !confirm(
        `Switch to ${target} courses?\n\nThis removes ${dropped.map(c => c.title || 'an unnamed course').join(' and ')} from the end of the menu.`
      )) return;
    }
    setMenu(m => {
      if (!m) return m;
      const courses = m.courses.slice(0, target);
      while (courses.length < target) courses.push({ id: 'course-4', title: '', desc: '' });
      return withCourses(m, courses);
    });
  }

  function handleMoveCourse(index: number, dir: -1 | 1) {
    setMenu(m => {
      if (!m) return m;
      const j = index + dir;
      if (j < 0 || j >= m.courses.length) return m;
      const courses = [...m.courses];
      [courses[index], courses[j]] = [courses[j], courses[index]];
      return { ...m, courses: renumber(courses) };
    });
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

  async function doPublish() {
    if (!menu) return;
    setPublishing(true);
    setSaveMsg('Publishing…');
    try {
      await fetch('/api/coursemenu/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menu) });
      const res = await fetch('/api/coursemenu/publish', { method: 'POST' });
      if (!res.ok) { setPublishing(false); setSaveStatus('error'); setSaveMsg(await publishErrorMessage(res)); return; }
      window.location.href = '/coursemenu';
    } catch { setPublishing(false); setSaveStatus('error'); setSaveMsg('Network error while publishing'); }
  }

  // An "on purpose" answer lasts only while that problem is still there:
  // once it's fixed, it's forgotten, so if it comes back Chef is asked again.
  useEffect(() => {
    if (!menu) return;
    const fit = report && !report.fits ? (report.issues ?? []).map(i => 'fit-' + i.code) : [];
    const keys = new Set([...fit, ...menuChecks(menu).map(p => p.key)]);
    setOkd(prev => {
      const next = new Set([...prev].filter(k => { const key = k.slice(k.indexOf(':') + 1); return keys.has(key) || key.startsWith('spell-'); }));
      return next.size === prev.size ? prev : next;
    });
  }, [menu, report]);

  if (!menu) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading menu…
      </div>
    );
  }

  const issues = report && !report.fits ? report.issues ?? [] : [];
  const flagged = new Set(issues.map(i => i.section));
  const problems = plainProblems(issues);
  const problemFor = (target: string) => problems.find(p => p.target === target);
  // Everything worth asking about at Print / Make Active.
  const askItems: Problem[] = [
    ...problems.map(p => ({ ...p, key: 'fit-' + p.key, serious: true })),
    ...menuChecks(menu),
  ];
  const askKeys = askItems.map(p => p.key).join('|');

  // ── AI spelling check (Oct 2026) ─────────────────────────────────────────
  function setSpellField(fieldId: string, original: string, suggestion: string) {
    const fix = (t: string) => t.replace(original, suggestion);
    setMenu(m => {
      if (!m) return m;
      if (fieldId === 'header') return { ...m, header: fix(m.header) };
      if (fieldId === 'description') return { ...m, description: fix(m.description) };
      if (fieldId === 'addon.title') return { ...m, addon: { ...m.addon, title: fix(m.addon.title) } };
      if (fieldId === 'addon.desc') return { ...m, addon: { ...m.addon, desc: fix(m.addon.desc) } };
      const [cid, part] = fieldId.split('.');
      return { ...m, courses: m.courses.map(c => c.id === cid ? { ...c, [part]: fix(c[part as 'title' | 'desc']) } : c) };
    });
  }
  /** Ask the AI. null = not available right now (not set up, slow, offline) — skip it. */
  async function spellItems(): Promise<Problem[] | null> {
    if (!menu) return [];
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch('/api/spellcheck', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ menu: 'Generic course menu', fields: spellFields(menu) }),
      });
      if (!res.ok) return null;
      const { suggestions } = await res.json() as { suggestions: SpellSuggestion[] };
      return suggestions.map((sg): Problem => ({
        key: `spell-${sg.fieldId}-${sg.original}`,
        target: spellTarget(sg.fieldId),
        title: sg.kind === 'misspelled'
          ? `Spelling: \u201c${sg.original}\u201d \u2192 \u201c${sg.suggestion}\u201d?`
          : `Usually written as \u201c${sg.suggestion}\u201d (you have \u201c${sg.original}\u201d).`,
        body: `${sg.why} (In ${spellFieldName(sg.fieldId)}.)`,
        use: { label: `Use \u201c${sg.suggestion}\u201d`, run: () => setSpellField(sg.fieldId, sg.original, sg.suggestion) },
        keep: () => { fetch('/api/spellcheck/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word: sg.original }) }).catch(() => {}); },
      }));
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  async function askOrGo(kind: 'print' | 'publish') {
    if (spellBusy) return;
    setSpellBusy(true);
    const spelling = await spellItems();   // skipped quietly if unavailable
    setSpellBusy(false);
    // Answers are per action: "yes" for Print doesn't count for Make Active.
    const pending = [...askItems, ...(spelling ?? [])].filter(p => !okd.has(kind + ':' + p.key));
    if (pending.length) { setPopupReq({ kind, n: Date.now(), items: pending }); return; }
    if (kind === 'print') doPrint(); else doPublish();
  }
  async function checkSpelling() {
    if (spellBusy) return;
    setSpellBusy(true);
    const spelling = await spellItems();
    setSpellBusy(false);
    setPopupReq({ kind: 'spell', n: Date.now(), items: spelling ?? [{
      key: 'spell-unavailable', title: 'The spelling check isn\u2019t available right now.', body: 'Try again in a minute.',
    }] });
  }
  function confirmed(kind: 'print' | 'publish', items: Problem[]) {
    setOkd(prev => new Set([...prev, ...items.map(p => kind + ':' + p.key)]));
    if (kind === 'print') doPrint(); else doPublish();
  }
  const showAddon = menu.addon.title !== '' || addonOpen;
  const n = menu.courses.length;

  const saveStatusClass =
    saveStatus === 'saved'  ? 'save-status saved'  :
    saveStatus === 'saving' ? 'save-status saving' :
    saveStatus === 'error' ? 'save-status error'  : 'save-status';

  const flagStyle = (section: string) =>
    flagged.has(section) ? { outline: '3px solid #c0392b', outlineOffset: '2px' } : undefined;

  function doPrint() {
    localStorage.setItem('siena-coursemenu-print-data', JSON.stringify(menu));
    // The pop-up already asked about everything (fit included), so the print
    // page shouldn't ask again.
    window.open(`/coursemenu-print?src=${src}&warned=1&fitwarned=1`, '_blank');
  }

  return (
    <div className="app">
      {recoveryBanner}

      {/* ── Editor pane ──────────────────────────────────────────── */}
      <div className="editor-pane">
        <div className="editor-header">
          <Link href="/coursemenu" className="btn-back">← Back</Link>
          <h1>Generic Menu</h1>
          <Link href="/" className="btn-home">🏠 Home</Link>
        </div>

        <ProblemPopup problems={problems} request={popupReq} onConfirm={confirmed} />

        {isFix && (
          <div className="draft-banner fix-banner">
            ✏️ You&rsquo;re editing the <strong>active menu</strong>. Every change saves right away — there&rsquo;s no draft and no publish step.
          </div>
        )}

        <div className="editor-scroll chef-mode">

          {/* Course count */}
          <div className="page-group">
            <div className="page-group-label">How many courses?</div>
            <div className="course-count-picker" role="radiogroup" aria-label="Number of courses">
              {[2, 3, 4].map(c => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={n === c}
                  className={`course-count-btn ${n === c ? 'active' : ''}`}
                  onClick={() => handleSetCount(c)}
                >
                  {c} Courses
                </button>
              ))}
            </div>
          </div>

          {/* Header + price + description */}
          <div className="page-group">
            <div className="page-group-label">Top of the menu</div>
            <div className="dish-row" style={flagStyle('hero') ?? flagStyle('description')}>
              <div className="dish-fields">
                <div className="dish-field-row" style={{ alignItems: 'flex-end', marginBottom: '10px' }}>
                  <div className="field-group" data-problem="hero" style={{ flex: 1, marginBottom: 0 }}>
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
                  <div className="field-group" data-problem="price" style={{ width: '100px', flexShrink: 0, marginBottom: 0 }}>
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
                <ProblemNote problem={problemFor('hero')} />
                <div className="field-group" data-problem="description" style={{ marginBottom: 0 }}>
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
                <ProblemNote problem={problemFor('description')} />
              </div>
            </div>
          </div>

          {/* Courses */}
          <div className="page-group">
            <div className="page-group-label">The courses</div>
            <div className="dish-list">
              {menu.courses.map((course, i) => (
                <CourseCard
                  key={i}
                  course={course}
                  index={i}
                  count={n}
                  flagged={flagged.has(course.id)}
                  problem={problemFor(course.id)}
                  onChange={handleCourseChange}
                  onMove={handleMoveCourse}
                />
              ))}
            </div>
          </div>

          {/* Add-on */}
          <div className="page-group">
            <div className="page-group-label">Add-on (optional)</div>
            <div className="dish-row" data-problem="addon" style={flagStyle('addon')}>
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
            <span className="publish-hint">You&rsquo;re editing a draft — the active menu is unchanged until you publish.</span>
            <button className="btn-publish" onClick={() => askOrGo('publish')} disabled={publishing}>{publishing ? 'Publishing…' : spellBusy ? 'Checking spelling…' : 'Make This the Active Menu'}</button>
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
          {spellOn && <button className="btn-spell" onClick={checkSpelling} disabled={spellBusy} title="Check spelling with AI (English, Italian, Spanish)">
            {spellBusy ? 'Checking\u2026' : '\u{1F524} Check Spelling'}
          </button>}
          <EarlierVersions
            apiPath={apiPath} previewBase="/coursemenu-preview" isFix={isFix}
            getEditorMenu={() => menuRef.current}
            beforeReload={() => confirmSaved(JSON.stringify(menuRef.current))}
          />
          <button
            className="btn-print"
            onClick={() => askOrGo('print')}
            disabled={spellBusy}
          >
            {spellBusy ? 'Checking spelling…' : 'Print Menu'}
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
