'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';

// ── Types ─────────────────────────────────────────────────────────────────

interface MondayDish {
  id: string;
  name: string;
  desc: string;
  price?: string;
}

interface MondaySection {
  title: string;
  subtitle: string;
  items: MondayDish[];
}

interface WeeklyRow {
  id: string;
  day_label: string;
  headline: string;
  detail: string;
}

interface PastaAddonItem {
  id: string;
  name: string;
  price: string;
  enabled: boolean;
}

interface PastaAddons {
  enabled: boolean;
  label: string;
  items: PastaAddonItem[];
  tail: string;
}

interface MondayMenuData {
  hero: {
    eyebrow_left: string;
    eyebrow_right: string;
    price: string;
    tagline: string;
  };
  sections: {
    'course-1': MondaySection;
    'course-2': MondaySection;
  };
  pasta_addons: PastaAddons;
  weekly: {
    rows: WeeklyRow[];
  };
  policy_line: string;
}

type CourseId = 'course-1' | 'course-2';

// ── Character limits (must match BUILD-SPEC.md and monday-schema.ts) ──────

const L = {
  heroEyebrowLeft:  22,
  heroEyebrowRight: 22,
  heroPrice:         3,
  heroTagline:      38,
  sectionTitle:     24,
  sectionSubtitle:  16,
  dishName:         30,
  dishDesc:        140,
  dishPrice:         6,
  addonsLabel:      20,
  addonsItemName:   16,
  addonsItemPrice:   6,
  addonsTail:       48,
  weeklyDayLabel:   14,
  weeklyHeadline:   28,
  weeklyDetail:    130,
  policyLine:      120,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function menuHasOverLimit(m: MondayMenuData): boolean {
  if (m.hero.eyebrow_left.length  > L.heroEyebrowLeft)  return true;
  if (m.hero.eyebrow_right.length > L.heroEyebrowRight) return true;
  if (m.hero.price.length         > L.heroPrice)        return true;
  if (m.hero.tagline.length       > L.heroTagline)      return true;
  if (m.policy_line.length        > L.policyLine)       return true;
  for (const sid of ['course-1', 'course-2'] as const) {
    const s = m.sections[sid];
    if (s.title.length    > L.sectionTitle)    return true;
    if (s.subtitle.length > L.sectionSubtitle) return true;
    for (const d of s.items) {
      if (d.name.length          > L.dishName)  return true;
      if (d.desc.length          > L.dishDesc)  return true;
      if ((d.price ?? '').length > L.dishPrice) return true;
    }
  }
  if (m.pasta_addons.label.length > L.addonsLabel) return true;
  if (m.pasta_addons.tail.length  > L.addonsTail)  return true;
  for (const item of m.pasta_addons.items) {
    if (item.name.length  > L.addonsItemName)  return true;
    if (item.price.length > L.addonsItemPrice) return true;
  }
  for (const r of m.weekly.rows) {
    if (r.day_label.length > L.weeklyDayLabel)  return true;
    if (r.headline.length  > L.weeklyHeadline)  return true;
    if (r.detail.length    > L.weeklyDetail)    return true;
  }
  return false;
}

// ── CharCount component ───────────────────────────────────────────────────

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const cls = len > max
    ? 'char-count over'
    : len > max * 0.85
      ? 'char-count warn'
      : 'char-count';
  return <span className={cls}>{len}/{max}</span>;
}

// ── Dish row ──────────────────────────────────────────────────────────────

function MondayDishRow({
  dish, index, sectionId, onChange,
}: {
  dish: MondayDish;
  index: number;
  sectionId: CourseId;
  onChange: (sectionId: CourseId, index: number, updated: MondayDish) => void;
}) {
  function set(field: keyof MondayDish, value: string) {
    onChange(sectionId, index, { ...dish, [field]: value });
  }

  return (
    <Draggable draggableId={dish.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="dish-row"
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.85 : 1,
            boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : undefined,
          }}
        >
          <div className="dish-row-header">
            <span className="drag-handle" {...provided.dragHandleProps} title="Drag to reorder">⠿</span>
            <span className="dish-name-preview">{dish.name || '(unnamed)'}</span>
          </div>

          <div className="dish-fields">
            <div className="field-group">
              <div className="field-label-row">
                <label>Name</label>
                <CharCount value={dish.name} max={L.dishName} />
              </div>
              <input value={dish.name} onChange={e => set('name', e.target.value)} placeholder="Dish name" />
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label>Description</label>
                <CharCount value={dish.desc} max={L.dishDesc} />
              </div>
              <textarea rows={2} value={dish.desc} onChange={e => set('desc', e.target.value)} placeholder="Description" />
            </div>

            <div className="field-group price-field">
              <div className="field-label-row">
                <label>Price (optional — leave blank for prix-fixe)</label>
                <CharCount value={dish.price ?? ''} max={L.dishPrice} />
              </div>
              <input
                value={dish.price ?? ''}
                onChange={e => set('price', e.target.value)}
                placeholder="e.g. +8 (blank = no price shown)"
              />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ── Course section block ──────────────────────────────────────────────────

function CourseSectionBlock({
  sectionId, section, defaultOpen, onChange, onDishChange,
}: {
  sectionId: CourseId;
  section: MondaySection;
  defaultOpen: boolean;
  onChange: (id: CourseId, updated: MondaySection) => void;
  onDishChange: (id: CourseId, index: number, updated: MondayDish) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const label = sectionId === 'course-1' ? 'Course 1' : 'Course 2';

  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => setOpen(o => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">{label} — {section.title}</span>
        <span className="section-count">{section.items.length} dishes</span>
      </div>

      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body">
          <div className="field-group section-title-field">
            <div className="field-label-row">
              <label>Section title</label>
              <CharCount value={section.title} max={L.sectionTitle} />
            </div>
            <input
              value={section.title}
              onChange={e => onChange(sectionId, { ...section, title: e.target.value })}
            />
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label>Subtitle (e.g. "Choose One")</label>
              <CharCount value={section.subtitle} max={L.sectionSubtitle} />
            </div>
            <input
              value={section.subtitle}
              onChange={e => onChange(sectionId, { ...section, subtitle: e.target.value })}
            />
          </div>

          <Droppable droppableId={sectionId} type="dish">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="dish-list">
                {section.items.map((dish, i) => (
                  <MondayDishRow
                    key={dish.id}
                    dish={dish}
                    index={i}
                    sectionId={sectionId}
                    onChange={onDishChange}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>
    </div>
  );
}

// ── Pasta add-on item row ────────────────────────────────────────────────

function PastaAddonItemRow({
  item, onChange,
}: {
  item: PastaAddonItem;
  onChange: (updated: PastaAddonItem) => void;
}) {
  function set(field: keyof PastaAddonItem, value: string | boolean) {
    onChange({ ...item, [field]: value });
  }

  return (
    <div className="dish-row">
      <div className="dish-fields">
        <div className="dish-field-row">
          <div className="field-group">
            <div className="field-label-row">
              <label>Name</label>
              <CharCount value={item.name} max={L.addonsItemName} />
            </div>
            <input value={item.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Chicken" />
          </div>
          <div className="field-group" style={{ flex: '0 0 90px' }}>
            <div className="field-label-row">
              <label>Price (no $)</label>
              <CharCount value={item.price} max={L.addonsItemPrice} />
            </div>
            <input value={item.price} onChange={e => set('price', e.target.value)} placeholder="6.25" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={item.enabled} onChange={e => set('enabled', e.target.checked)} />
            On
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Pasta add-ons block ──────────────────────────────────────────────────

function PastaAddonsBlock({
  addons, onChange,
}: {
  addons: PastaAddons;
  onChange: (updated: PastaAddons) => void;
}) {
  const [open, setOpen] = useState(true);

  function setItem(index: number, updated: PastaAddonItem) {
    const items = [...addons.items];
    items[index] = updated;
    onChange({ ...addons, items });
  }

  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => setOpen(o => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">Pasta Add-Ons</span>
        <span className="section-count">{addons.enabled ? 'On' : 'Off'}</span>
      </div>

      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <input
              type="checkbox"
              checked={addons.enabled}
              onChange={e => onChange({ ...addons, enabled: e.target.checked })}
            />
            Show this line on the menu
          </label>

          <div className="field-group">
            <div className="field-label-row">
              <label>Label</label>
              <CharCount value={addons.label} max={L.addonsLabel} />
            </div>
            <input value={addons.label} onChange={e => onChange({ ...addons, label: e.target.value })} placeholder="Add to any pasta" />
          </div>

          <div className="dish-list">
            {addons.items.map((item, i) => (
              <PastaAddonItemRow key={item.id} item={item} onChange={updated => setItem(i, updated)} />
            ))}
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label>Tail (optional closing note)</label>
              <CharCount value={addons.tail} max={L.addonsTail} />
            </div>
            <input
              value={addons.tail}
              onChange={e => onChange({ ...addons, tail: e.target.value })}
              placeholder="— or ask your server for other options."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Weekly row item ───────────────────────────────────────────────────────

function WeeklyRowItem({
  row, index, onChange,
}: {
  row: WeeklyRow;
  index: number;
  onChange: (index: number, updated: WeeklyRow) => void;
}) {
  function set(field: keyof WeeklyRow, value: string) {
    onChange(index, { ...row, [field]: value });
  }

  return (
    <Draggable draggableId={row.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="dish-row"
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.85 : 1,
            boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : undefined,
          }}
        >
          <div className="dish-row-header">
            <span className="drag-handle" {...provided.dragHandleProps} title="Drag to reorder">⠿</span>
            <span className="dish-name-preview">
              {row.day_label || '(no day)'} — {row.headline || '(no headline)'}
            </span>
          </div>

          <div className="dish-fields">
            <div className="dish-field-row">
              <div className="field-group" style={{ flex: '0 0 140px' }}>
                <div className="field-label-row">
                  <label>Day label</label>
                  <CharCount value={row.day_label} max={L.weeklyDayLabel} />
                </div>
                <input
                  value={row.day_label}
                  onChange={e => set('day_label', e.target.value)}
                  placeholder="e.g. Tuesdays"
                />
              </div>
              <div className="field-group">
                <div className="field-label-row">
                  <label>Headline</label>
                  <CharCount value={row.headline} max={L.weeklyHeadline} />
                </div>
                <input
                  value={row.headline}
                  onChange={e => set('headline', e.target.value)}
                  placeholder="e.g. Wine Lovers Wednesday"
                />
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label>Detail</label>
                <CharCount value={row.detail} max={L.weeklyDetail} />
              </div>
              <textarea
                rows={3}
                value={row.detail}
                onChange={e => set('detail', e.target.value)}
                placeholder="Description of the special"
              />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ── Weekly block ──────────────────────────────────────────────────────────

function WeeklyBlock({
  weekly, onRowChange,
}: {
  weekly: MondayMenuData['weekly'];
  onRowChange: (index: number, updated: WeeklyRow) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => setOpen(o => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">Throughout the Week</span>
        <span className="section-count">4 rows</span>
      </div>

      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body">
          <Droppable droppableId="weekly-rows" type="weekly-row">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="dish-list">
                {weekly.rows.map((row, i) => (
                  <WeeklyRowItem key={row.id} row={row} index={i} onChange={onRowChange} />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────

export default function MondayEditorPage() {
  // "Fix a Mistake" (/monday/fix) reuses this exact editor — same fields,
  // same validation, same live preview — but reads/writes the LIVE menu
  // directly instead of a draft, and hides the publish/discard footer.
  const pathname = usePathname();
  const isFix = pathname?.endsWith('/fix') ?? false;
  const apiPath = isFix ? '/api/monday/fix' : '/api/monday/draft';

  const [menu, setMenu]           = useState<MondayMenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg]     = useState('');
  const [previewUrl, setPreviewUrl] = useState(`/monday-preview?src=${isFix ? 'current' : 'draft'}`);
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const prevJsonRef = useRef<string>('');

  // Load initial data
  useEffect(() => {
    fetch(apiPath)
      .then(r => r.json())
      .then(data => {
        setMenu(data);
        prevJsonRef.current = JSON.stringify(data);
      })
      .catch(() => setSaveStatus('error'));
  }, [apiPath]);

  // Debounced save + live preview update
  const debouncedMenu = useDebounce(menu, 800);

  const saveAndRefresh = useCallback(async (data: MondayMenuData) => {
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
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SIENA_MONDAY_UPDATE', payload: data }, '*'
      );
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setSaveMsg('Network error');
    }
  }, [apiPath]);

  useEffect(() => {
    if (debouncedMenu && prevJsonRef.current !== '') saveAndRefresh(debouncedMenu);
  }, [debouncedMenu, saveAndRefresh]);

  // ── Mutation helpers ────────────────────────────────────────────────────

  function setHero(field: keyof MondayMenuData['hero'], value: string) {
    setMenu(m => m && { ...m, hero: { ...m.hero, [field]: value } });
  }

  function handleSectionChange(id: CourseId, updated: MondaySection) {
    setMenu(m => m && { ...m, sections: { ...m.sections, [id]: updated } });
  }

  function handleDishChange(id: CourseId, index: number, updated: MondayDish) {
    setMenu(m => {
      if (!m) return m;
      const items = [...m.sections[id].items];
      items[index] = updated;
      return { ...m, sections: { ...m.sections, [id]: { ...m.sections[id], items } } };
    });
  }

  function handlePastaAddonsChange(updated: PastaAddons) {
    setMenu(m => m && { ...m, pasta_addons: updated });
  }

  function handleWeeklyRowChange(index: number, updated: WeeklyRow) {
    setMenu(m => {
      if (!m) return m;
      const rows = [...m.weekly.rows];
      rows[index] = updated;
      return { ...m, weekly: { ...m.weekly, rows } };
    });
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { source, destination, type } = result;
    if (source.droppableId !== destination.droppableId) return; // no cross-section moves

    if (type === 'dish') {
      const sectionId = source.droppableId as CourseId;
      setMenu(m => {
        if (!m) return m;
        const items = Array.from(m.sections[sectionId].items);
        const [moved] = items.splice(source.index, 1);
        items.splice(destination.index, 0, moved);
        return { ...m, sections: { ...m.sections, [sectionId]: { ...m.sections[sectionId], items } } };
      });
    } else if (type === 'weekly-row') {
      setMenu(m => {
        if (!m) return m;
        const rows = Array.from(m.weekly.rows);
        const [moved] = rows.splice(source.index, 1);
        rows.splice(destination.index, 0, moved);
        return { ...m, weekly: { ...m.weekly, rows } };
      });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  // ── Publish / discard ──────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    if (!menu) return;
    if (!confirm('Make this draft the current menu?\n\nThe menu people are printing now will be moved to "Past Menus," and this draft becomes the current menu dated today.')) return;
    setPublishing(true);
    setSaveMsg('Publishing…');
    try {
      await fetch('/api/monday/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menu) });
      const res = await fetch('/api/monday/publish', { method: 'POST' });
      if (!res.ok) { setPublishing(false); setSaveStatus('error'); setSaveMsg('Publish failed — try again'); return; }
      window.location.href = '/monday';
    } catch { setPublishing(false); setSaveStatus('error'); setSaveMsg('Network error while publishing'); }
  }

  async function handleDiscard() {
    if (!confirm('Discard this draft?\n\nAll changes since the current menu will be lost. The current menu is not affected.')) return;
    try { await fetch('/api/monday/draft', { method: 'DELETE' }); }
    finally { window.location.href = '/monday'; }
  }

  if (!menu) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading menu…
      </div>
    );
  }

  const saveStatusClass =
    saveStatus === 'saved'  ? 'save-status saved'  :
    saveStatus === 'saving' ? 'save-status saving' :
    saveStatus === 'error'  ? 'save-status error'  : 'save-status';

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="app">

        {/* ── Editor pane ──────────────────────────────────────────── */}
        <div className="editor-pane">
          <div className="editor-header">
            <Link href="/monday" className="btn-back">← Back</Link>
            <h1>Monday $26 Specials</h1>
            <Link href="/" className="btn-home">🏠 Home</Link>
          </div>

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

            {/* Hero */}
            <div className="page-group">
              <div className="page-group-label">Hero — top of page</div>

              <div className="dish-field-row">
                <div className="field-group">
                  <div className="field-label-row">
                    <label>Left eyebrow</label>
                    <CharCount value={menu.hero.eyebrow_left} max={L.heroEyebrowLeft} />
                  </div>
                  <input value={menu.hero.eyebrow_left} onChange={e => setHero('eyebrow_left', e.target.value)} placeholder="Two Courses" />
                </div>
                <div className="field-group">
                  <div className="field-label-row">
                    <label>Right eyebrow</label>
                    <CharCount value={menu.hero.eyebrow_right} max={L.heroEyebrowRight} />
                  </div>
                  <input value={menu.hero.eyebrow_right} onChange={e => setHero('eyebrow_right', e.target.value)} placeholder="Mondays Only" />
                </div>
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <label>Price (digits only — the $ is part of the design)</label>
                  <CharCount value={menu.hero.price} max={L.heroPrice} />
                </div>
                <input
                  value={menu.hero.price}
                  onChange={e => setHero('price', e.target.value.replace(/\D/g, ''))}
                  placeholder="26"
                  style={{ width: '80px' }}
                />
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <label>Tagline</label>
                  <CharCount value={menu.hero.tagline} max={L.heroTagline} />
                </div>
                <input value={menu.hero.tagline} onChange={e => setHero('tagline', e.target.value)} placeholder="e.g. for 26 Years in Austin" />
              </div>
            </div>

            {/* Courses */}
            <div className="page-group">
              <div className="page-group-label">Menu courses</div>
              {(['course-1', 'course-2'] as CourseId[]).map((sid, i) => (
                <CourseSectionBlock
                  key={sid}
                  sectionId={sid}
                  section={menu.sections[sid]}
                  defaultOpen={i === 0}
                  onChange={handleSectionChange}
                  onDishChange={handleDishChange}
                />
              ))}
            </div>

            {/* Pasta add-ons */}
            <div className="page-group">
              <div className="page-group-label">Pasta add-ons</div>
              <PastaAddonsBlock
                addons={menu.pasta_addons}
                onChange={handlePastaAddonsChange}
              />
            </div>

            {/* Weekly */}
            <div className="page-group">
              <div className="page-group-label">Throughout the week card</div>
              <WeeklyBlock
                weekly={menu.weekly}
                onRowChange={handleWeeklyRowChange}
              />
            </div>

            {/* Policy line */}
            <div className="page-group">
              <div className="page-group-label">Footer</div>
              <div className="field-group">
                <div className="field-label-row">
                  <label>Policy line (HTML: &lt;strong&gt; allowed)</label>
                  <CharCount value={menu.policy_line} max={L.policyLine} />
                </div>
                <textarea
                  rows={2}
                  value={menu.policy_line}
                  onChange={e => setMenu(m => m && { ...m, policy_line: e.target.value })}
                />
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
            <span className={saveStatusClass}>{saveMsg || 'Auto-saves as you type'}</span>
            <button
              className="btn-print"
              onClick={() => {
                if (menu) localStorage.setItem('siena-monday-print-data', JSON.stringify(menu));
                window.open(`/monday-print?src=${isFix ? 'current' : 'draft'}`, '_blank');
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
              onClick={() => setPreviewUrl(`/monday-preview?src=${isFix ? 'current' : 'draft'}&` + Date.now())}
            >
              ↺ Reload from server
            </button>
          </div>
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="preview-iframe"
            title="Monday menu preview"
          />
        </div>

      </div>
    </DragDropContext>
  );
}
