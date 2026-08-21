'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

interface ArwCocktail {
  name: string;
  desc: string;
  price: string;
}

interface ArwMenuData {
  subtitle: string;
  cocktail: ArwCocktail;
  courses: {
    antipasti: ArwCourse;
    entree: ArwCourse;
    dolci: ArwCourse;
  };
}

type ArwStyle = 'classic' | 'left-aligned';
type CourseKey = 'antipasti' | 'entree' | 'dolci';

interface Violation { field: string; rule: string; lines: number | null }
// `fits` is driven only by per-field line-count violations — page-level
// overflowPx/pageFits are informational only (see validate.js for why: the
// on-screen scrollHeight check has repeatedly diverged from real printed
// output on this handoff and no longer gates Save/Print).
interface ValidateReport { fits: boolean; overflowPx: number; pageFits: boolean; violations: Violation[]; worstField: string | null }

const STYLE_LABEL: Record<ArwStyle, string> = { classic: 'Two-Column Classic', 'left-aligned': 'Left-Aligned' };
const OTHER_STYLE: Record<ArwStyle, ArwStyle> = { classic: 'left-aligned', 'left-aligned': 'classic' };

// ── Char limits (must match BUILD-SPEC.md and arw-schema.ts — paste-safety
//    caps only, validate.js's live line-count check is authoritative) ──────
const L = {
  subtitle:      45,
  name:          40,
  desc:          140,
  upcharge:      3,
  cocktailName:  40,
  cocktailDesc:  140,
  cocktailPrice: 3,
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

function fieldLabel(field: string): string {
  if (field === 'subtitle') return 'the subtitle';
  if (field === 'cocktail-name') return 'the cocktail name';
  if (field === 'cocktail-desc') return 'the cocktail description';
  if (field === 'cocktail-price') return 'the cocktail price';
  return `"${field}"`;
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
  const [open, setOpen] = useState(false);
  const filledCount = course.items.filter(it => it.name.trim()).length;
  const hasViolation = course.items.some(it => violations.has(`${it.id}-name`) || violations.has(`${it.id}-desc`));

  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => setOpen(o => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">{numeral} — {title}</span>
        {hasViolation && <span className="dd-chip dd-chip--bad">⚠ needs a fix</span>}
        <span className="section-count">{filledCount}/{course.items.length} filled</span>
      </div>
      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body">
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
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────

export default function ArwEditorPage() {
  const router = useRouter();

  // Read ?style= from the plain browser URL on mount (not next/navigation's
  // useSearchParams, which needs a Suspense boundary in the App Router and
  // has no precedent elsewhere in this codebase — usePathname is used
  // instead on every other editor page). After mount, `style` is plain
  // client state — router.replace() below keeps the URL bar in sync for
  // shareability/refresh, but a soft navigation on the same route doesn't
  // remount this component, so re-reading the URL wouldn't pick it up.
  const [style, setStyle] = useState<ArwStyle | null>(null);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('style');
    if (fromUrl !== 'classic' && fromUrl !== 'left-aligned') {
      router.replace('/arw');
      return;
    }
    setStyle(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apiPath = '/api/arw/fix';

  const [menu, setMenu]             = useState<ArwMenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg]       = useState('');
  const [reports, setReports]       = useState<Record<ArwStyle, ValidateReport | null>>({ classic: null, 'left-aligned': null });
  const [cacheBust]                 = useState(() => Date.now());

  const iframeRefs: Record<ArwStyle, React.RefObject<HTMLIFrameElement>> = {
    classic: useRef<HTMLIFrameElement>(null),
    'left-aligned': useRef<HTMLIFrameElement>(null),
  };
  const prevJsonRef    = useRef<string>('');
  const pendingSaveRef = useRef<ArwMenuData | null>(null);

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

  // Server save — fires once the CURRENTLY OPEN style reports fits:true.
  // (BUILD-SPEC §4 recommends gating on both styles at once, since either
  // could get printed — but with the real approved menu content, Left-Aligned
  // doesn't reliably fit regardless of what's typed, which made saving
  // impossible in either style. Gating on just the active style unblocks
  // editing/saving now; switching to a style that doesn't fit still shows
  // its own overflow warning and blocks Print for that style specifically.)
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

  function maybeSave(nextReports: Record<ArwStyle, ValidateReport | null>, activeStyle: ArwStyle) {
    const activeReport = nextReports[activeStyle];
    if (!activeReport) return; // still waiting on the active style's iframe
    if (activeReport.fits) {
      if (pendingSaveRef.current) {
        saveToServer(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
      setSaveStatus(s => (s === 'error' ? 'idle' : s));
    } else {
      // fits is false only when there's an actual per-field violation now —
      // worstField is always set in that case (see ValidateReport note above).
      pendingSaveRef.current = null;
      setSaveStatus('error');
      setSaveMsg(`Content overflows in ${fieldLabel(activeReport.worstField!)} — shorten the text`);
    }
  }

  // ── Validation listener — both iframes (visible + hidden) report in, but
  // only the CURRENTLY OPEN style's report gates Save (see saveToServer note
  // above). Re-subscribes whenever `style` changes so the closure always has
  // the current value — a stale `style` here would gate Save against
  // whichever style was active when the listener was first attached.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || e.data.type !== 'SIENA_ARW_VALIDATE_RESULT') return;
      const msgStyle = e.data.style as ArwStyle;
      if (e.source !== iframeRefs[msgStyle]?.current?.contentWindow) return;
      const report = e.data.report as ValidateReport;
      setReports(prev => {
        const next = { ...prev, [msgStyle]: report };
        if (style) maybeSave(next, style);
        return next;
      });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveToServer, style]);

  // Debounce menu edits → push to BOTH iframes for live preview + dual validation
  useEffect(() => {
    if (!debouncedMenu || prevJsonRef.current === '') return;
    pendingSaveRef.current = debouncedMenu;
    setReports({ classic: null, 'left-aligned': null });
    (['classic', 'left-aligned'] as ArwStyle[]).forEach(s => {
      iframeRefs[s].current?.contentWindow?.postMessage(
        { type: 'SIENA_ARW_UPDATE', payload: debouncedMenu },
        '*'
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedMenu]);

  // ── Mutations ───────────────────────────────────────────────────────────

  function handleItemChange(courseKey: CourseKey, itemId: string, updated: ArwItem) {
    setMenu(m => {
      if (!m) return m;
      const items = m.courses[courseKey].items.map(it => (it.id === itemId ? updated : it));
      return { ...m, courses: { ...m.courses, [courseKey]: { items } } };
    });
  }

  function handleCocktailChange(updated: ArwCocktail) {
    setMenu(m => m && { ...m, cocktail: updated });
  }

  function switchStyle(next: ArwStyle) {
    if (!style || next === style) return;
    setStyle(next);
    router.replace(`/arw/edit?style=${next}`, { scroll: false });
  }

  if (!style || !menu) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading menu…
      </div>
    );
  }

  const activeReport = reports[style];
  const otherStyle = OTHER_STYLE[style];
  const violationFields = new Set((activeReport?.violations ?? []).map(v => v.field));
  const subtitleBad = violationFields.has('subtitle');
  const cocktailNameBad = violationFields.has('cocktail-name');
  const cocktailDescBad = violationFields.has('cocktail-desc');
  const cocktailPriceBad = violationFields.has('cocktail-price');
  const activeOverflow = activeReport ? !activeReport.fits : false;
  const otherReport = reports[otherStyle];
  const otherStyleAlsoOverflows = otherReport ? !otherReport.fits : false;
  const showCocktail = !!menu.cocktail.name.trim();

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

        {activeOverflow && (
          <div className="overflow-banner">
            ⚠ {saveMsg || `Menu is too long to fit in ${STYLE_LABEL[style]}`}
          </div>
        )}

        <div className="draft-banner fix-banner">
          ✏️ Editing in <strong>{STYLE_LABEL[style]}</strong>. Every change saves right away.
          {otherStyleAlsoOverflows && !activeOverflow && (
            <> Note: <strong>{STYLE_LABEL[otherStyle]}</strong> currently doesn&rsquo;t fit this content — switch to it before printing that style.</>
          )}
        </div>

        <div className="editor-scroll chef-mode">

          <div className="weekend-instructions" style={{ margin: '12px 0 8px' }}>
            <p>Three fixed courses — 5 Antipasti, 8 Entr&eacute;e, 3 Dolci — plus one featured cocktail. You can edit any dish or clear a slot to remove it, but slots can&rsquo;t be added. The $50 price, dates, and all other page chrome are locked.</p>
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

          {/* Featured cocktail */}
          <div className="page-group">
            <div className="page-group-label">Featured Cocktail (optional)</div>
            <div className="dish-row">
              <div className="dish-fields">
                <div style={{ marginBottom: showCocktail ? '12px' : 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#d4b57a', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <input
                      type="checkbox"
                      checked={showCocktail}
                      onChange={e => handleCocktailChange(e.target.checked ? menu.cocktail : { name: '', desc: '', price: '' })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#b8821e' }}
                    />
                    Include a featured cocktail
                  </label>
                  {!showCocktail && (
                    <div style={{ fontSize: '12px', color: 'rgba(212,181,122,0.5)', marginTop: '4px', paddingLeft: '24px' }}>
                      Clearing the name hides the whole cocktail block
                    </div>
                  )}
                </div>

                {showCocktail && (
                  <>
                    <div className="dish-field-row" style={{ alignItems: 'flex-end', gap: '10px', marginBottom: '10px' }}>
                      <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
                        <div className="field-label-row">
                          <label>Cocktail name{cocktailNameBad && <span className="dd-chip dd-chip--bad" style={{ marginLeft: '6px' }}>wraps to 2 lines</span>}</label>
                          <CharCount value={menu.cocktail.name} max={L.cocktailName} />
                        </div>
                        <input
                          value={menu.cocktail.name}
                          onChange={e => handleCocktailChange({ ...menu.cocktail, name: e.target.value })}
                          placeholder="e.g. The Siena Sunbeam"
                        />
                      </div>
                      <div className="field-group" style={{ width: '90px', flexShrink: 0, marginBottom: 0 }}>
                        <div className="field-label-row">
                          <label>Price{cocktailPriceBad && <span className="dd-chip dd-chip--bad" style={{ marginLeft: '6px' }}>digits only</span>}</label>
                          <CharCount value={menu.cocktail.price} max={L.cocktailPrice} />
                        </div>
                        <input
                          value={menu.cocktail.price}
                          onChange={e => handleCocktailChange({ ...menu.cocktail, price: filterDigits(e.target.value) })}
                          placeholder="14"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'rgba(212,181,122,0.55)', marginTop: '-6px', marginBottom: '8px' }}>
                      Price prints as digits only — no $ shown on the menu.
                    </div>
                    <div className="field-group" style={{ marginBottom: 0 }}>
                      <div className="field-label-row">
                        <label>Description{cocktailDescBad && <span className="dd-chip dd-chip--bad" style={{ marginLeft: '6px' }}>too long (max 2 lines)</span>}</label>
                        <CharCount value={menu.cocktail.desc} max={L.cocktailDesc} />
                      </div>
                      <textarea
                        rows={2}
                        value={menu.cocktail.desc}
                        onChange={e => handleCocktailChange({ ...menu.cocktail, desc: e.target.value })}
                        placeholder="Ingredients"
                      />
                    </div>
                  </>
                )}
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

        <div className="editor-footer">
          <span className={saveStatusClass} style={{ flex: 1 }}>
            {saveStatus === 'saved'  ? '✓ Saved' :
             saveStatus === 'saving' ? 'Saving…' :
             saveStatus === 'error'  ? `⚠ ${saveMsg}` :
             'Auto-saves as you type'}
          </span>
          <button
            className="btn-print"
            disabled={activeOverflow}
            title={activeOverflow ? `${STYLE_LABEL[style]} overflows — shorten text before printing` : undefined}
            onClick={() => {
              if (menu) localStorage.setItem('siena-arw-print-data', JSON.stringify(menu));
              window.open(`/arw-print?style=${style}`, '_blank');
            }}
          >
            Print Menu
          </button>
        </div>
      </div>

      {/* ── Preview pane ─────────────────────────────────────────── */}
      <div className="preview-pane">
        <div className="preview-toolbar">
          <span>Live preview — {STYLE_LABEL[style]}</span>
          <button
            className="btn-ghost"
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px 10px' }}
            onClick={() => switchStyle(otherStyle)}
          >
            ⇄ Switch to {STYLE_LABEL[otherStyle]}
          </button>
        </div>
        <iframe
          ref={iframeRefs.classic}
          src={`/arw-preview?style=classic&v=${cacheBust}`}
          className="preview-iframe"
          title="ARW menu preview — Two-Column Classic"
          style={style !== 'classic' ? { position: 'fixed', top: '-9999px', left: '-9999px', width: '816px', height: '1056px' } : undefined}
        />
        <iframe
          ref={iframeRefs['left-aligned']}
          src={`/arw-preview?style=left-aligned&v=${cacheBust}`}
          className="preview-iframe"
          title="ARW menu preview — Left-Aligned"
          style={style !== 'left-aligned' ? { position: 'fixed', top: '-9999px', left: '-9999px', width: '816px', height: '1056px' } : undefined}
        />
      </div>

    </div>
  );
}
