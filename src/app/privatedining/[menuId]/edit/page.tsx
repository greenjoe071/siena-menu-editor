'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

interface Dish { name: string; desc?: string; }
interface Course { label: string; dishes: Dish[]; }
interface DefaultMenu { label: string; internalPriceRef: string; courses: Course[]; }
interface ExtraItem { courseIndex: number; name: string; desc?: string; }
interface Alternate { id: string; name: string; extraItems: ExtraItem[]; }

interface ValidateReport { fits: boolean; overflowPx?: number; tier?: string; titleWrapped?: boolean; error?: string; }

const MAX_EXTRA_ITEMS = 2;

function useDebounce<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return d;
}

function mergeCourses(base: Course[], extraItems: ExtraItem[]): Course[] {
  return base.map((course, idx) => ({
    label: course.label,
    dishes: [...course.dishes, ...extraItems.filter((e) => e.courseIndex === idx)],
  }));
}

// ── Small editable dish row (default-mode: full edit; alternate-mode: extra items only) ──

function DishEditor({
  dish, onChange, onRemove, namePlaceholder,
}: {
  dish: Dish; onChange: (d: Dish) => void; onRemove: () => void; namePlaceholder: string;
}) {
  return (
    <div className="dish-row">
      <div className="dish-row-header">
        <span className="dish-name-preview">{dish.name || '(new dish)'}</span>
        <button className="btn-remove-dish" title="Remove" onClick={onRemove}>×</button>
      </div>
      <div className="dish-fields">
        <div className="field-group" style={{ marginBottom: '8px' }}>
          <label>Name</label>
          <input value={dish.name} onChange={(e) => onChange({ ...dish, name: e.target.value })} placeholder={namePlaceholder} />
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Description (optional)</label>
          <textarea rows={2} value={dish.desc ?? ''} onChange={(e) => onChange({ ...dish, desc: e.target.value })} placeholder="e.g. Assorted young greens with truffle vinaigrette" />
        </div>
      </div>
    </div>
  );
}

export default function PrivateDiningEditorPage() {
  const params = useParams<{ menuId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const menuId = params.menuId;
  const altId = search.get('alt');
  const mode: 'default' | 'alternate' = altId ? 'alternate' : 'default';

  const [loading, setLoading] = useState(true);
  const [baseCourses, setBaseCourses] = useState<Course[] | null>(null); // current (published) courses — read-only in alternate mode
  const [defaultMenu, setDefaultMenu] = useState<DefaultMenu | null>(null); // the draft, editable in default mode
  const [alternate, setAlternate] = useState<Alternate | null>(null);
  const [menuLabel, setMenuLabel] = useState('');

  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [report, setReport] = useState<ValidateReport | null>(null);
  const [publishing, setPublishing] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevJsonRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    async function load() {
      const currentRes = await fetch(`/api/privatedining/${menuId}`);
      const current = await currentRes.json();
      setMenuLabel(current.label);
      setBaseCourses(current.courses);

      if (mode === 'default') {
        const draftRes = await fetch(`/api/privatedining/${menuId}/draft`);
        const draft = await draftRes.json();
        setDefaultMenu(draft);
        prevJsonRef.current = JSON.stringify(draft);
      } else {
        const altsRes = await fetch(`/api/privatedining/${menuId}/alternates`);
        const alts: Alternate[] = await altsRes.json();
        const found = alts.find((a) => a.id === altId) ?? null;
        setAlternate(found);
        prevJsonRef.current = JSON.stringify(found);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId, mode, altId]);

  // ── Derived render payload ───────────────────────────────────────────
  const extraCount = mode === 'alternate' ? (alternate?.extraItems.length ?? 0) : 0;
  const courses = mode === 'default'
    ? (defaultMenu?.courses ?? [])
    : mergeCourses(baseCourses ?? [], alternate?.extraItems ?? []);

  const renderPayload = { eventTitle, eventDate, logoUrl, extraCount, courses };
  const debouncedPayload = useDebounce(renderPayload, 400);
  const debouncedEditable = useDebounce(mode === 'default' ? defaultMenu : alternate, 500);

  // Push to preview iframe whenever the rendered content changes.
  useEffect(() => {
    if (loading) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SIENA_PRIVATEDINING_UPDATE', payload: debouncedPayload }, '*',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debouncedPayload), loading]);

  // Autosave the editable part (draft for default mode, PATCH for alternate mode).
  const saveToServer = useCallback(async (data: DefaultMenu | Alternate | null) => {
    if (!data) return;
    const json = JSON.stringify(data);
    if (json === prevJsonRef.current) return;
    prevJsonRef.current = json;
    setSaveStatus('saving'); setSaveMsg('Saving…');
    try {
      const url = mode === 'default'
        ? `/api/privatedining/${menuId}/draft`
        : `/api/privatedining/${menuId}/alternates/${altId}`;
      const res = await fetch(url, {
        method: mode === 'default' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveStatus('error'); setSaveMsg(body.error || 'Save failed'); return;
      }
      setSaveStatus('saved'); setSaveMsg(mode === 'default' ? 'Draft saved' : 'Alternate saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch { setSaveStatus('error'); setSaveMsg('Network error'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, menuId, altId]);

  useEffect(() => {
    if (loading || !debouncedEditable) return;
    saveToServer(debouncedEditable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debouncedEditable), loading]);

  // Fit safety-net result from the preview iframe.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || e.data.type !== 'SIENA_PRIVATEDINING_VALIDATE_RESULT') return;
      setReport(e.data.report as ValidateReport);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // ── Default-mode mutations ───────────────────────────────────────────
  function updateCourse(idx: number, next: Course) {
    setDefaultMenu((m) => {
      if (!m) return m;
      const courses = [...m.courses]; courses[idx] = next;
      return { ...m, courses };
    });
  }
  function updateDish(courseIdx: number, dishIdx: number, dish: Dish) {
    if (!defaultMenu) return;
    const course = defaultMenu.courses[courseIdx];
    const dishes = [...course.dishes]; dishes[dishIdx] = dish;
    updateCourse(courseIdx, { ...course, dishes });
  }
  function removeDish(courseIdx: number, dishIdx: number) {
    if (!defaultMenu) return;
    const course = defaultMenu.courses[courseIdx];
    updateCourse(courseIdx, { ...course, dishes: course.dishes.filter((_, i) => i !== dishIdx) });
  }
  function addDish(courseIdx: number) {
    if (!defaultMenu) return;
    const course = defaultMenu.courses[courseIdx];
    updateCourse(courseIdx, { ...course, dishes: [...course.dishes, { name: '', desc: '' }] });
  }

  // ── Alternate-mode mutations ──────────────────────────────────────────
  function addExtraItem(courseIndex: number) {
    setAlternate((a) => {
      if (!a) return a;
      if (a.extraItems.length >= MAX_EXTRA_ITEMS) return a;
      return { ...a, extraItems: [...a.extraItems, { courseIndex, name: '', desc: '' }] };
    });
  }
  function updateExtraItem(itemIdx: number, item: ExtraItem) {
    setAlternate((a) => {
      if (!a) return a;
      const extraItems = [...a.extraItems]; extraItems[itemIdx] = item;
      return { ...a, extraItems };
    });
  }
  function removeExtraItem(itemIdx: number) {
    setAlternate((a) => (a ? { ...a, extraItems: a.extraItems.filter((_, i) => i !== itemIdx) } : a));
  }
  function renameAlternate(name: string) {
    setAlternate((a) => (a ? { ...a, name } : a));
  }

  // ── Publish / discard (default mode only) ────────────────────────────
  async function handlePublish() {
    if (!defaultMenu) return;
    if (report && !report.fits) { alert('This menu is too long to fit one page. Shorten a description before publishing.'); return; }
    if (!confirm('Make this draft the current default menu?\n\nThe current menu will be moved to past menus, and this draft becomes current, dated today.')) return;
    setPublishing(true); setSaveMsg('Publishing…');
    try {
      await fetch(`/api/privatedining/${menuId}/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(defaultMenu) });
      const res = await fetch(`/api/privatedining/${menuId}/publish`, { method: 'POST' });
      if (!res.ok) { setPublishing(false); setSaveStatus('error'); setSaveMsg('Publish failed — try again'); return; }
      router.push(`/privatedining/${menuId}`);
    } catch { setPublishing(false); setSaveStatus('error'); setSaveMsg('Network error while publishing'); }
  }
  async function handleDiscard() {
    if (!confirm("Discard this draft? Changes since the current menu will be lost.")) return;
    try { await fetch(`/api/privatedining/${menuId}/draft`, { method: 'DELETE' }); }
    finally { router.push(`/privatedining/${menuId}`); }
  }
  async function handleDeleteAlternate() {
    if (!alternate) return;
    if (!confirm(`Delete the alternate "${alternate.name}"? This can't be undone.`)) return;
    await fetch(`/api/privatedining/${menuId}/alternates/${alternate.id}`, { method: 'DELETE' });
    router.push(`/privatedining/${menuId}`);
  }

  // ── Logo upload — pure client-side (data URL), no server storage ──────
  function handleLogoFile(file: File | null) {
    if (!file) { setLogoUrl(null); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function handlePrint() {
    localStorage.setItem('siena-privatedining-print-data', JSON.stringify(renderPayload));
    const q = mode === 'alternate' ? `&alt=${altId}` : '&src=draft';
    window.open(`/privatedining-print?menu=${menuId}${q}`, '_blank');
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading…</div>;
  }
  if (mode === 'alternate' && !alternate) {
    return <div style={{ padding: 40 }}>Alternate not found. <Link href={`/privatedining/${menuId}`}>Back</Link></div>;
  }

  const anyOverflow = report ? !report.fits : false;
  const capReached = mode === 'alternate' && (alternate?.extraItems.length ?? 0) >= MAX_EXTRA_ITEMS;

  return (
    <div className="app">
      <div className="editor-pane">
        <div className="editor-header">
          <Link href={`/privatedining/${menuId}`} className="btn-back">← Back</Link>
          <h1>{menuLabel} — {mode === 'default' ? 'Editing Default' : `Alternate: ${alternate?.name}`}</h1>
          <Link href="/" className="btn-home">🏠 Home</Link>
        </div>

        {mode === 'default' && (
          <div className="draft-banner">
            ✎ You&rsquo;re editing a <strong>draft</strong> of the default menu. It stays locked until you press <strong>Make This the Current Menu</strong>.
          </div>
        )}

        <div className="editor-scroll chef-mode">
          {/* Event details — entered fresh per event, never saved with the menu */}
          <div className="section-block">
            <div className="section-block-header" style={{ cursor: 'default' }}>
              <span className="section-title-label">Event Details (this print only — not saved)</span>
            </div>
            <div className="section-body">
              <div className="field-group">
                <label>Event Title</label>
                <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="e.g. Bob and Mary Smith's 50th Anniversary" />
              </div>
              <div className="field-group">
                <label>Event Date</label>
                <input value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="e.g. Saturday, June 14, 2026" />
              </div>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label>Logo (optional — fixed 64×64 on the printed page)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo preview" style={{ width: 40, height: 40, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 4 }} />
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoFile(e.target.files?.[0] ?? null)}
                  />
                  {logoUrl && (
                    <button className="btn-link-remove" onClick={() => { setLogoUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>remove</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {mode === 'alternate' && (
            <div className="field-group">
              <label>Alternate Name</label>
              <input value={alternate?.name ?? ''} onChange={(e) => renameAlternate(e.target.value)} placeholder="e.g. Vegetarian Alt" />
            </div>
          )}

          {mode === 'alternate' && (alternate?.extraItems.length ?? 0) > 0 && (
            <p className="pd-cap-note">Adding items shrinks the type to fit — {MAX_EXTRA_ITEMS} max. {capReached ? 'Cap reached.' : `${MAX_EXTRA_ITEMS - (alternate?.extraItems.length ?? 0)} more allowed.`}</p>
          )}

          {mode === 'default' && defaultMenu?.courses.map((course, ci) => (
            <div className="section-block" key={ci}>
              <div className="section-block-header" style={{ cursor: 'default' }}>
                <input
                  className="pd-course-label-input"
                  value={course.label}
                  onChange={(e) => updateCourse(ci, { ...course, label: e.target.value })}
                />
              </div>
              <div className="section-body">
                <div className="dish-list">
                  {course.dishes.map((dish, di) => (
                    <DishEditor
                      key={di}
                      dish={dish}
                      namePlaceholder="Dish name"
                      onChange={(d) => updateDish(ci, di, d)}
                      onRemove={() => removeDish(ci, di)}
                    />
                  ))}
                </div>
                <button className="btn-add-dish" onClick={() => addDish(ci)}>+ Add dish</button>
              </div>
            </div>
          ))}

          {mode === 'alternate' && (baseCourses ?? []).map((course, ci) => {
            const extras = alternate?.extraItems.map((item, idx) => ({ item, idx })).filter((x) => x.item.courseIndex === ci) ?? [];
            return (
              <div className="section-block" key={ci}>
                <div className="section-block-header" style={{ cursor: 'default' }}>
                  <span className="section-title-label">{course.label}</span>
                </div>
                <div className="section-body">
                  <ul style={{ listStyle: 'none', color: 'var(--muted)', fontSize: '13px', marginBottom: '10px' }}>
                    {course.dishes.map((d, i) => <li key={i} style={{ marginBottom: '4px' }}>{d.name}</li>)}
                  </ul>
                  {extras.map(({ item, idx }) => (
                    <DishEditor
                      key={idx}
                      dish={item}
                      namePlaceholder="Extra dish name"
                      onChange={(d) => updateExtraItem(idx, { ...d, courseIndex: ci })}
                      onRemove={() => removeExtraItem(idx)}
                    />
                  ))}
                  <button className="btn-add-dish" disabled={capReached} title={capReached ? `Cap of ${MAX_EXTRA_ITEMS} extra items reached for this alternate` : undefined} onClick={() => addExtraItem(ci)}>
                    + Add Item{capReached ? ' (cap reached)' : ''}
                  </button>
                </div>
              </div>
            );
          })}

          {mode === 'alternate' && (
            <button className="btn-discard-draft" style={{ marginTop: '16px' }} onClick={handleDeleteAlternate}>Delete This Alternate</button>
          )}
        </div>

        {mode === 'default' && (
          <div className="editor-footer editor-footer--publish">
            <button className="btn-discard-draft" onClick={handleDiscard} disabled={publishing}>Discard Draft</button>
            <span className="publish-hint">
              {anyOverflow ? '⚠ Too long to fit — fix before publishing.' : 'Current menu is unchanged until you publish.'}
            </span>
            <button className="btn-publish" onClick={handlePublish} disabled={publishing || anyOverflow}>
              {publishing ? 'Publishing…' : 'Make This the Current Menu'}
            </button>
          </div>
        )}

        <div className="editor-footer">
          <span className={`save-status ${saveStatus}`} style={{ flex: 1 }}>
            {saveStatus === 'error' ? `⚠ ${saveMsg}` : (saveMsg || 'Auto-saves as you type')}
          </span>
          <button className="btn-print" disabled={anyOverflow} title={anyOverflow ? 'Fix overflow first' : undefined} onClick={handlePrint}>Print</button>
        </div>
      </div>

      <div className="preview-pane">
        <div className="preview-toolbar">
          <span>Live preview</span>
        </div>
        <iframe
          ref={iframeRef}
          src={`/privatedining-preview?menu=${menuId}${mode === 'alternate' ? `&alt=${altId}` : '&src=draft'}`}
          className="preview-iframe"
          title="Private Dining preview"
        />
      </div>
    </div>
  );
}
