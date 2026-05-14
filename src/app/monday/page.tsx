'use client';

import Link from 'next/link';
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

interface MondayMenuData {
  hero: {
    eyebrow: string;
    price: string;
    tagline: string;
    meta_left: string;
    meta_right: string;
  };
  sections: {
    'course-1': MondaySection;
    'course-2': MondaySection;
  };
  weekly: {
    title: string;
    rows: WeeklyRow[];
  };
  policy_line: string;
}

type CourseId = 'course-1' | 'course-2';

// ── Character limits (must match BUILD-SPEC.md and monday-schema.ts) ──────

const L = {
  heroEyebrow:     48,
  heroPrice:        3,
  heroTagline:     38,
  heroMetaLeft:    22,
  heroMetaRight:   22,
  sectionTitle:    24,
  sectionSubtitle: 16,
  dishName:        30,
  dishDesc:       140,
  dishPrice:        6,
  weeklyTitle:     42,
  weeklyDayLabel:  14,
  weeklyHeadline:  28,
  weeklyDetail:   130,
  policyLine:     120,
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
  if (m.hero.eyebrow.length    > L.heroEyebrow)    return true;
  if (m.hero.price.length      > L.heroPrice)      return true;
  if (m.hero.tagline.length    > L.heroTagline)    return true;
  if (m.hero.meta_left.length  > L.heroMetaLeft)   return true;
  if (m.hero.meta_right.length > L.heroMetaRight)  return true;
  if (m.weekly.title.length    > L.weeklyTitle)    return true;
  if (m.policy_line.length     > L.policyLine)     return true;
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
  weekly, onTitleChange, onRowChange,
}: {
  weekly: MondayMenuData['weekly'];
  onTitleChange: (title: string) => void;
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
          <div className="field-group section-title-field">
            <div className="field-label-row">
              <label>Card title</label>
              <CharCount value={weekly.title} max={L.weeklyTitle} />
            </div>
            <input value={weekly.title} onChange={e => onTitleChange(e.target.value)} />
          </div>

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

// ── History panel ─────────────────────────────────────────────────────────

interface BackupEntry { key: string; ts: number; label: string; }

function HistoryPanel({ onRestore }: { onRestore: (data: MondayMenuData) => void }) {
  const [backups, setBackups]   = useState<BackupEntry[]>([]);
  const [open, setOpen]         = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/monday/backups');
    if (res.ok) setBackups(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function restore(entry: BackupEntry) {
    if (!confirm(`Restore Monday menu to the version saved on ${entry.label}?\n\nThis will overwrite your current menu. Your current version will be saved as a backup first.`)) return;
    setRestoring(entry.key);
    try {
      const res = await fetch('/api/monday/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: entry.key }),
      });
      if (!res.ok) { alert('Restore failed — try again.'); return; }
      onRestore(await res.json());
      await load();
    } finally {
      setRestoring(null);
    }
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
              <button
                className="btn-restore"
                disabled={restoring === b.key}
                onClick={() => restore(b)}
              >
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

export default function MondayEditorPage() {
  const [menu, setMenu]           = useState<MondayMenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg]     = useState('');
  const [historyKey, setHistoryKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('/monday-preview');
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const prevJsonRef = useRef<string>('');

  // Load initial data
  useEffect(() => {
    fetch('/api/monday')
      .then(r => r.json())
      .then(data => {
        setMenu(data);
        prevJsonRef.current = JSON.stringify(data);
      })
      .catch(() => setSaveStatus('error'));
  }, []);

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
      const res = await fetch('/api/monday', {
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
        { type: 'SIENA_MONDAY_UPDATE', payload: data }, '*'
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

  function handleWeeklyTitleChange(title: string) {
    setMenu(m => m && { ...m, weekly: { ...m.weekly, title } });
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
            <Link href="/" className="btn-back">← All Menus</Link>
            <h1>Monday $26 Specials</h1>
          </div>

          <div className="editor-scroll">

            {/* Hero */}
            <div className="page-group">
              <div className="page-group-label">Hero — top of page</div>

              <div className="field-group">
                <div className="field-label-row">
                  <label>Eyebrow line</label>
                  <CharCount value={menu.hero.eyebrow} max={L.heroEyebrow} />
                </div>
                <input value={menu.hero.eyebrow} onChange={e => setHero('eyebrow', e.target.value)} placeholder="e.g. Monday Nights at Siena" />
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

              <div className="dish-field-row">
                <div className="field-group">
                  <div className="field-label-row">
                    <label>Left badge</label>
                    <CharCount value={menu.hero.meta_left} max={L.heroMetaLeft} />
                  </div>
                  <input value={menu.hero.meta_left} onChange={e => setHero('meta_left', e.target.value)} placeholder="Two Courses" />
                </div>
                <div className="field-group">
                  <div className="field-label-row">
                    <label>Right badge</label>
                    <CharCount value={menu.hero.meta_right} max={L.heroMetaRight} />
                  </div>
                  <input value={menu.hero.meta_right} onChange={e => setHero('meta_right', e.target.value)} placeholder="Mondays Only" />
                </div>
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

            {/* Weekly */}
            <div className="page-group">
              <div className="page-group-label">Throughout the week card</div>
              <WeeklyBlock
                weekly={menu.weekly}
                onTitleChange={handleWeeklyTitleChange}
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

          <HistoryPanel
            key={historyKey}
            onRestore={data => {
              setMenu(data);
              prevJsonRef.current = JSON.stringify(data);
              setSaveStatus('saved');
              setSaveMsg('Restored');
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'SIENA_MONDAY_UPDATE', payload: data }, '*'
              );
              setTimeout(() => setSaveStatus('idle'), 3000);
            }}
          />

          <div className="editor-footer">
            <span className={saveStatusClass}>{saveMsg || 'Auto-saves as you type'}</span>
            <button
              className="btn-print"
              onClick={() => {
                if (menu) localStorage.setItem('siena-monday-print-data', JSON.stringify(menu));
                window.open('/monday-print', '_blank');
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
              onClick={() => setPreviewUrl('/monday-preview?' + Date.now())}
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
