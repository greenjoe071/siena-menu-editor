'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSaveSafety } from '@/lib/use-save-safety';
import { publishErrorMessage } from '@/lib/publish-error';
import { confirmPrintWarnings } from '@/lib/print-warnings';
import { TUESWED_CHAR_LIMITS as L, TUESWED_DEFAULT_WEEKLY } from '@/lib/tueswed-schema';

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

// v3 (Oct 2026): "Tuesdays Only" box on top of the page.
interface TuewedSpecial {
  label: string;
  title: string;
  price: string;
  desc: string;
}

interface TuewedWeekly {
  id: 'week-1' | 'week-2' | 'week-3' | 'week-4';
  day: string;
  headline: string;
  detail: string;
}

interface TuewedMenuData {
  special?: TuewedSpecial;           // v3 only
  price: string;
  courses: [TuewedCourse, TuewedCourse, TuewedCourse];
  addon?: TuewedAddon;
  weekly?: [TuewedWeekly, TuewedWeekly, TuewedWeekly, TuewedWeekly];   // v3 only
  policy_line?: string;              // v2 only prints it; kept in the data either way
}

// Fit check posted back by the preview (handoff-tueswed/validate.js).
interface FitReport {
  fits: boolean;
  worstSection?: string | null;
  problems?: { code: string; section?: string }[];
}

const SECTION_NAMES: Record<string, string> = {
  special: 'the Tuesdays Only box',
  header: 'the title',
  'course-1': 'Course I',
  'course-2': 'Course II',
  'course-3': 'Course III',
  addon: 'the add-on',
  'week-1': 'weekly special 1',
  'week-2': 'weekly special 2',
  'week-3': 'weekly special 3',
  'week-4': 'weekly special 4',
  weekly: 'the weekly specials',
  footnotes: 'the footer',
};

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

/** Older (v2) menus get the v3 parts added when a DRAFT is opened. */
function upgradeToV3(m: TuewedMenuData): TuewedMenuData {
  return {
    ...m,
    special: m.special ?? { label: 'Tuesdays Only', title: '', price: '', desc: '' },
    weekly: m.weekly ?? (TUESWED_DEFAULT_WEEKLY.map(w => ({ ...w })) as TuewedMenuData['weekly']),
  };
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

// ── Main editor ───────────────────────────────────────────────────────────

export default function TuewedEditorPage() {
  // "Fix a Mistake" (/tueswed/fix) reuses this exact editor — same fields,
  // same validation, same live preview — but reads/writes the LIVE menu
  // directly instead of a draft, and hides the publish/New-Week footer.
  const pathname = usePathname();
  const isFix = pathname?.endsWith('/fix') ?? false;
  const apiPath = isFix ? '/api/tueswed/fix' : '/api/tueswed/draft';
  const src = isFix ? 'current' : 'draft';
  // Drafts are always edited in the new (v3) design. "Make a Change" on an
  // active menu that's still in the old design keeps it in the old design —
  // it never turns the live menu into a half-filled new one.
  const pkg = isFix ? '' : '&pkg=v3';

  const [menu, setMenu]                 = useState<TuewedMenuData | null>(null);
  const [saveStatus, setSaveStatus]     = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg]           = useState('');
  // Safety net: browser copy, retries, save-on-leave (see use-save-safety.tsx).
  const [loadedJson, setLoadedJson] = useState<string | null>(null);
  const { confirmSaved, banner: recoveryBanner } = useSaveSafety({
    storageKey: 'tueswed:' + (isFix ? 'fix' : 'draft'), url: apiPath, payload: menu, loadedJson,
    setSaveStatus, setSaveMsg, onRestore: setMenu,
  });
  const [previewUrl, setPreviewUrl]     = useState(`/tueswed-preview?src=${src}${pkg}`);
  const [fit, setFit]                   = useState<FitReport | null>(null);
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const prevJsonRef  = useRef<string>('');

  useEffect(() => {
    fetch(apiPath)
      .then(r => r.json())
      .then((data: TuewedMenuData) => {
        // Opening the editor never saves by itself — only Chef's typing does.
        // (Oct 2026: an automatic save-on-open could write an older copy of the
        // draft over newer work.) An upgraded v2 draft is saved on the first edit.
        const loaded = isFix ? data : upgradeToV3(data);
        prevJsonRef.current = JSON.stringify(loaded); setLoadedJson(prevJsonRef.current);
        setMenu(loaded);
      })
      .catch(() => setSaveStatus('error'));
  }, [apiPath, isFix]);

  const debouncedMenu = useDebounce(menu, 800);

  // Server save. Joe, Oct 2026: typing ALWAYS saves — a menu that doesn't
  // fit the page only blocks "Make This the Active Menu".
  const saveToServer = useCallback(async (data: TuewedMenuData) => {
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
        saveFailed(msg);
        return;
      }
      setSaveStatus('saved'); confirmSaved(json);
      setSaveMsg('Saved');
      setTimeout(() => setSaveStatus(st => (st === 'saved' ? 'idle' : st)), 3000);
    } catch {
      saveFailed('Not saved yet — no connection. Retrying…');
    }

    // A failed save must not count as saved (the safety net retries it).
    function saveFailed(msg: string) {
      prevJsonRef.current = '__unsaved__';
      setSaveStatus('error');
      setSaveMsg(msg);
    }
  }, [apiPath, confirmSaved]);

  // ── Fit check from the preview ──────────────────────────────────────────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!e.data || e.data.type !== 'SIENA_TUESWED_VALIDATE_RESULT') return;
      setFit(e.data.report as FitReport);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Debounced edits → live preview + fit check, and save.
  useEffect(() => {
    if (!debouncedMenu || prevJsonRef.current === '') return;
    if (JSON.stringify(debouncedMenu) !== prevJsonRef.current) setFit(null);
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SIENA_TUESWED_UPDATE', payload: debouncedMenu },
      '*'
    );
    saveToServer(debouncedMenu);
  }, [debouncedMenu, saveToServer]);

  // ── New Week ────────────────────────────────────────────────────────────

  function handleNewWeek() {
    if (!confirm('Start a new week?\n\nThis clears the Tuesdays Only dish, all course names and descriptions, and the add-on. The price and the weekly specials stay as they are.')) return;
    setMenu(m => {
      if (!m) return m;
      return {
        ...m,
        special: m.special ? { ...m.special, title: '', price: '', desc: '' } : m.special,
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

  function setSpecial(field: keyof TuewedSpecial, value: string) {
    setMenu(m => m && m.special ? { ...m, special: { ...m.special, [field]: value } } : m);
  }

  function setWeekly(index: number, field: 'day' | 'headline' | 'detail', value: string) {
    setMenu(m => {
      if (!m || !m.weekly) return m;
      const weekly = m.weekly.map((w, i) => (i === index ? { ...w, [field]: value } : w)) as TuewedMenuData['weekly'];
      return { ...m, weekly };
    });
  }

  // ── Publish ─────────────────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);

  function publishBlockers(m: TuewedMenuData): string[] {
    const out: string[] = [];
    if (m.special) {
      if (!m.special.title.trim()) out.push('the Tuesdays Only dish name');
      if (!m.special.price.trim()) out.push('the Tuesdays Only price');
      if (!m.special.label.trim()) out.push('the Tuesdays Only label');
    }
    if (!m.price.trim()) out.push('the prix-fixe price');
    m.courses.forEach((c, i) => {
      if (!c.title.trim()) out.push(`Course ${ROMAN[i]} name`);
      if (!c.desc.trim()) out.push(`Course ${ROMAN[i]} description`);
    });
    return out;
  }

  async function handlePublish() {
    if (!menu) return;
    const blanks = publishBlockers(menu);
    if (blanks.length) {
      setSaveStatus('error');
      setSaveMsg('Before making this the active menu, fill in: ' + blanks.join(', ') + '.');
      return;
    }
    if (!fit || !fit.fits) {
      setSaveStatus('error');
      setSaveMsg(fit ? 'This menu doesn’t fit the page yet — see the red note at the top. Your draft is saved.' : 'Still checking the page fit — try again in a second.');
      return;
    }
    setPublishing(true);
    setSaveMsg('Publishing…');
    try {
      await fetch('/api/tueswed/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menu) });
      const res = await fetch('/api/tueswed/publish', { method: 'POST' });
      if (!res.ok) { setPublishing(false); setSaveStatus('error'); setSaveMsg(await publishErrorMessage(res)); return; }
      window.location.href = '/tueswed';
    } catch { setPublishing(false); setSaveStatus('error'); setSaveMsg('Network error while publishing'); }
  }

  if (!menu) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading menu…
      </div>
    );
  }

  const showAddon = menu.addon !== undefined;
  const isV3 = !!menu.special;
  const fitProblems = fit && !fit.fits
    ? [
        ...(fit.problems ?? []).filter(p => p.code === 'label-overflow').map(() => 'The Tuesdays Only label is too wide for the box border — shorten it.'),
        ...((fit.problems ?? []).some(p => p.code === 'page-overflow') || !(fit.problems ?? []).length
          ? [`The page is too full${fit.worstSection ? ` — ${SECTION_NAMES[fit.worstSection] ?? fit.worstSection} is the biggest part` : ''}. Shorten something.`]
          : []),
      ]
    : [];

  const saveStatusClass =
    saveStatus === 'saved'  ? 'save-status saved'  :
    saveStatus === 'saving' ? 'save-status saving' :
    saveStatus === 'error'  ? 'save-status error'  : 'save-status';

  return (
    <div className="app">
      {recoveryBanner}

      {/* ── Editor pane ──────────────────────────────────────────── */}
      <div className="editor-pane">
        <div className="editor-header">
          <Link href="/tueswed" className="btn-back">← Back</Link>
          <h1>Tuesday &amp; Wednesday</h1>
            <Link href="/" className="btn-home">🏠 Home</Link>
        </div>

        {fitProblems.length > 0 && (
          <div className="overflow-banner">
            ⚠ {isFix
              ? 'This menu no longer fits the page — your changes ARE saved, but shorten something before printing.'
              : 'This menu doesn’t fit the page yet — your draft IS saved, but it can’t become the active menu until it fits.'}
            <ul style={{ margin: '6px 0 0 18px' }}>
              {fitProblems.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}

          {isFix && (
            <div className="draft-banner fix-banner">
              ✏️ You&rsquo;re editing the <strong>active menu</strong>. Every change saves right away — there&rsquo;s no draft and no publish step.
              {!isV3 && <> This menu is in the <strong>older design</strong>; it switches to the new one the next time a new menu is made active.</>}
            </div>
          )}
        <div className="editor-scroll chef-mode">

          {/* Tuesdays Only (v3) */}
          {menu.special && (
            <div className="page-group">
              <div className="page-group-label">Tuesdays Only box (top of the page)</div>
              <div className="dish-row">
                <div className="dish-fields">
                  <div className="dish-field-row" style={{ alignItems: 'flex-end', marginBottom: '10px' }}>
                    <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
                      <div className="field-label-row">
                        <label>Dish name</label>
                        <CharCount value={menu.special.title} max={L.specialTitle} />
                      </div>
                      <input
                        value={menu.special.title}
                        onChange={e => setSpecial('title', e.target.value)}
                        placeholder="e.g. Costata di Maiale"
                      />
                    </div>
                    <div className="field-group" style={{ width: '100px', flexShrink: 0, marginBottom: 0 }}>
                      <div className="field-label-row">
                        <label>Price</label>
                        <CharCount value={menu.special.price} max={L.specialPrice} />
                      </div>
                      <PriceInput value={menu.special.price} onChange={v => setSpecial('price', v)} placeholder="25" />
                    </div>
                  </div>
                  <div className="field-group">
                    <div className="field-label-row">
                      <label>Description (optional)</label>
                      <CharCount value={menu.special.desc} max={L.specialDesc} />
                    </div>
                    <textarea
                      rows={2}
                      value={menu.special.desc}
                      onChange={e => setSpecial('desc', e.target.value)}
                      placeholder="e.g. Bone-in pork chop with mashed potatoes and sautéed spinach."
                    />
                  </div>
                  <div className="field-group" style={{ marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Label on the box border</label>
                      <CharCount value={menu.special.label} max={L.specialLabel} />
                    </div>
                    <input
                      value={menu.special.label}
                      onChange={e => setSpecial('label', e.target.value)}
                      placeholder="Tuesdays Only"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Price */}
          <div className="page-group">
            <div className="page-group-label">Three-course menu price</div>
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

          {/* Weekly specials (v3) */}
          {menu.weekly && (
            <div className="page-group">
              <div className="page-group-label">Weekly specials (bottom of the page)</div>
              <div className="dish-list">
                {menu.weekly.map((w, i) => (
                  <div key={w.id} className="dish-row">
                    <div className="dish-fields">
                      <div className="dish-field-row" style={{ gap: '8px', marginBottom: '8px' }}>
                        <div className="field-group" style={{ width: '120px', flexShrink: 0, marginBottom: 0 }}>
                          <label>Day</label>
                          <input value={w.day} onChange={e => setWeekly(i, 'day', e.target.value)} placeholder="Mondays" />
                        </div>
                        <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label>Headline</label>
                          <input value={w.headline} onChange={e => setWeekly(i, 'headline', e.target.value)} placeholder="$26 for 26 Years" />
                        </div>
                      </div>
                      <div className="field-group" style={{ marginBottom: 0 }}>
                        <label>Details</label>
                        <textarea rows={2} value={w.detail} onChange={e => setWeekly(i, 'detail', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Policy line — older (v2) design only; the new design has no footer line */}
          {!isV3 && (
            <div className="page-group">
              <div className="page-group-label">Footer</div>
              <div className="dish-row">
                <div className="dish-fields">
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
                </div>
              </div>
            </div>
          )}

        </div>{/* end editor-scroll */}


          {!isFix && (
            <div className="editor-footer editor-footer--publish">
              <span className="publish-hint">You&rsquo;re editing a draft — the active menu is unchanged until you publish.</span>
              <button
                className="btn-publish"
                onClick={handlePublish}
                disabled={publishing || (!!fit && !fit.fits)}
                title={fit && !fit.fits ? 'The menu doesn’t fit the page yet — see the red note at the top' : undefined}
              >
                {publishing ? 'Publishing…' : 'Make This the Active Menu'}
              </button>
            </div>
          )}
        <div className="editor-footer">
          {!isFix && <button className="btn-new-week" onClick={handleNewWeek}>New Week</button>}
          <span className={saveStatusClass} style={{ flex: 1, marginLeft: '8px' }}>
            {saveStatus === 'saved'  ? '✓ Saved' :
             saveStatus === 'saving' ? 'Saving…' :
             saveStatus === 'error'  ? `⚠ ${saveMsg}` :
             'Auto-saves as you type'}
          </span>
          <button
            className="btn-print"
            onClick={() => {
              if (menu && !confirmPrintWarnings('tueswed', menu, saveStatus === 'error')) return;
              if (menu) localStorage.setItem('siena-tueswed-print-data', JSON.stringify(menu));
              window.open(`/tueswed-print?src=${src}${pkg}&warned=1`, '_blank');
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
            onClick={() => setPreviewUrl(`/tueswed-preview?src=${src}${pkg}&` + Date.now())}
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
