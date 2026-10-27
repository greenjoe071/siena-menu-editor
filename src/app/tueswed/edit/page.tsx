'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSaveSafety } from '@/lib/use-save-safety';
import EarlierVersions from '@/components/EarlierVersions';
import ProblemPopup, { type Problem, type PopupRequest } from '@/components/ProblemPopup';
import { listChecks, duplicateChecks } from '@/lib/menu-checks';
import { publishErrorMessage } from '@/lib/publish-error';
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

// ── Problem pop-up (Oct 2026): fit + "Is this on purpose?" — never blocks ──
const SECTION_TARGET: Record<string, string> = {
  special: 'special', header: 'price', 'course-1': 'course-1', 'course-2': 'course-2', 'course-3': 'course-3',
  addon: 'addon', 'week-1': 'weekly', 'week-2': 'weekly', 'week-3': 'weekly', 'week-4': 'weekly', weekly: 'weekly',
};
function tueswedFitProblems(fit: FitReport | null): Problem[] {
  if (!fit || fit.fits) return [];
  const out: Problem[] = [];
  const probs = fit.problems ?? [];
  if (probs.some((p) => p.code === 'label-overflow')) out.push({
    key: 'fit-label', target: 'special', title: 'The \u201cTuesdays Only\u201d label is too wide.',
    body: 'It has to fit in the gap on the box border. Make it shorter.',
  });
  if (probs.some((p) => p.code === 'page-overflow') || !probs.length) {
    const ws = fit.worstSection ?? '';
    out.push({
      key: 'fit-page', target: SECTION_TARGET[ws], title: 'The menu is too long for the page.',
      body: `Make something shorter${ws && SECTION_NAMES[ws] ? ` \u2014 ${SECTION_NAMES[ws]} is the biggest part` : ''}.`,
    });
  }
  return out;
}
function tueswedChecks(m: TuewedMenuData): Problem[] {
  const out: Problem[] = [];
  const has = (v?: string) => !!v && v.trim() !== '';
  const names: { name: string; target?: string }[] = [];
  if (m.special) {
    const sp = m.special;
    if (!has(sp.title)) out.push({ key: 'special-noname', target: 'special', serious: true,
      title: 'The Tuesdays Only box has no dish name.', body: 'The sample dish (Costata di Maiale) would print instead.' });
    else {
      if (!has(sp.price)) out.push({ key: 'special-noprice', target: 'special',
        title: `The Tuesdays Only dish \u201c${sp.title.trim()}\u201d has no price.`, body: 'It will print without one.' });
      names.push({ name: sp.title, target: 'special' });
    }
    if (!has(sp.label)) out.push({ key: 'special-nolabel', target: 'special',
      title: 'The Tuesdays Only box has no label.', body: 'The words on the box border will be blank.' });
  }
  if (!has(m.price)) out.push({ key: 'no-price', target: 'price',
    title: 'There\u2019s no price for the three-course menu.', body: 'No price will print next to the title.' });
  m.courses.forEach((c, i) => {
    const n = ROMAN[i];
    if (!has(c.title) && !has(c.desc)) out.push({ key: `${c.id}-empty`, target: c.id, serious: true,
      title: `Course ${n} is empty.`, body: `It will print as a lonely \u201c${n}\u201d with nothing under it.` });
    else if (!has(c.title)) out.push({ key: `${c.id}-noname`, target: c.id, serious: true,
      title: `Course ${n} has a description but no dish name.`, body: 'The description will print with no name above it.' });
    else {
      if (!has(c.desc)) out.push({ key: `${c.id}-nodesc`, target: c.id,
        title: `Course ${n} (${c.title.trim()}) has no description.`, body: 'Only the dish name will print.' });
      names.push({ name: c.title, target: c.id });
    }
  });
  const a = m.addon;
  if (a) {
    if (has(a.title) && !has(a.price)) out.push({ key: 'addon-noprice', target: 'addon',
      title: `The add-on \u201c${a.title.trim()}\u201d has no price.`, body: 'It will print without one.' });
    if (!has(a.title) && (has(a.price) || has(a.desc))) out.push({ key: 'addon-noname', target: 'addon',
      title: 'The add-on has no name.', body: 'Without a name, the add-on won\u2019t print at all.' });
  }
  if (m.weekly) out.push(...listChecks(m.weekly.map((w) => ({ id: w.id, name: w.headline, desc: w.detail, prices: [], target: 'weekly' })), 'the weekly specials', 'weekly'));
  out.push(...duplicateChecks(names));
  return out;
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
    <div className="dish-row" data-problem={course.id}>
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
  const menuRef = useRef(menu);
  menuRef.current = menu;
  const [popupReq, setPopupReq] = useState<PopupRequest | null>(null);
  // "Yes, on purpose" answers per action, forgotten once that problem goes away.
  const [okd, setOkd] = useState<Set<string>>(new Set());
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

  async function doPublish() {
    if (!menu) return;
    setPublishing(true);
    setSaveMsg('Publishing…');
    try {
      await fetch('/api/tueswed/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menu) });
      const res = await fetch('/api/tueswed/publish', { method: 'POST' });
      if (!res.ok) { setPublishing(false); setSaveStatus('error'); setSaveMsg(await publishErrorMessage(res)); return; }
      window.location.href = '/tueswed';
    } catch { setPublishing(false); setSaveStatus('error'); setSaveMsg('Network error while publishing'); }
  }

  useEffect(() => {
    if (!menu) return;
    const keys = new Set(tueswedChecks(menu).map((p) => p.key));
    const fitKnown = fit !== null;
    tueswedFitProblems(fit).forEach((p) => keys.add(p.key));
    setOkd((prev) => {
      const next = new Set([...prev].filter((k) => {
        const key = k.slice(k.indexOf(':') + 1);
        return keys.has(key) || (!fitKnown && key.startsWith('fit-'));
      }));
      return next.size === prev.size ? prev : next;
    });
  }, [menu, fit]);

  // Print / Make Active → "Is this on purpose?" (never blocks).
  function askOrGo(kind: 'print' | 'publish') {
    if (!menu) return;
    const items = [...tueswedFitProblems(fit).map((p) => ({ ...p, serious: true })), ...tueswedChecks(menu)];
    const pending = items.filter((p) => !okd.has(kind + ':' + p.key));
    if (pending.length) { setPopupReq({ kind, n: Date.now(), items: pending }); return; }
    if (kind === 'print') doPrint(); else doPublish();
  }
  function confirmed(kind: 'print' | 'publish', items: Problem[]) {
    setOkd((prev) => new Set([...prev, ...items.map((p) => kind + ':' + p.key)]));
    if (kind === 'print') doPrint(); else doPublish();
  }
  function doPrint() {
    if (menu) localStorage.setItem('siena-tueswed-print-data', JSON.stringify(menu));
    window.open(`/tueswed-print?src=${src}${pkg}&warned=1&fitwarned=1`, '_blank');
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

        <ProblemPopup problems={tueswedFitProblems(fit)} request={popupReq} onConfirm={confirmed} />

          {isFix && (
            <div className="draft-banner fix-banner">
              ✏️ You&rsquo;re editing the <strong>active menu</strong>. Every change saves right away — there&rsquo;s no draft and no publish step.
              {!isV3 && <> This menu is in the <strong>older design</strong>; it switches to the new one the next time a new menu is made active.</>}
            </div>
          )}
        <div className="editor-scroll chef-mode">

          {/* Tuesdays Only (v3) */}
          {menu.special && (
            <div className="page-group" data-problem="special">
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
          <div className="page-group" data-problem="price">
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
          <div className="page-group" data-problem="addon">
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
            <div className="page-group" data-problem="weekly">
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
                onClick={() => askOrGo('publish')}
                disabled={publishing}
              >
                {publishing ? 'Publishing…' : 'Make This the Active Menu'}
              </button>
            </div>
          )}
        <div className="editor-footer">
          <span className={saveStatusClass} style={{ flex: 1, marginLeft: '8px' }}>
            {saveStatus === 'saved'  ? '✓ Saved' :
             saveStatus === 'saving' ? 'Saving…' :
             saveStatus === 'error'  ? `⚠ ${saveMsg}` :
             'Auto-saves as you type'}
          </span>
          <EarlierVersions
            apiPath={apiPath} previewBase="/tueswed-preview" isFix={isFix}
            getEditorMenu={() => menuRef.current}
            beforeReload={() => confirmSaved(JSON.stringify(menuRef.current))}
          />
          <button
            className="btn-print"
            onClick={() => askOrGo('print')}
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
