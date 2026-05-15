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

interface WeekendDish {
  id: string;
  name: string;
  desc: string;
  price: string;
}

interface WeekendSection {
  title: string;
  subtitle: string;
  items: WeekendDish[];
}

interface WeeklyRow {
  id: string;
  day_label: string;
  headline: string;
  detail: string;
}

interface WeekendMenuData {
  sections: {
    starters: WeekendSection;
    entrees:  WeekendSection;
  };
  weekly: {
    title: string;
    rows: WeeklyRow[];
  };
  policy_line: string;
}

type SectionId = 'starters' | 'entrees';

// ── Char limits (must match BUILD-SPEC.md and weekend-schema.ts) ──────────

const L = {
  sectionTitle:    20,
  sectionSubtitle: 16,
  dishName:        30,
  dishDesc:       140,
  dishPrice:        8,
  weeklyTitle:     42,
  weeklyDayLabel:  14,
  weeklyHeadline:  26,
  weeklyDetail:   110,
  policyLine:     120,
} as const;

// ── ID generation ─────────────────────────────────────────────────────────

function newDishId(): string {
  return 'd-' + Math.random().toString(36).slice(2, 8);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function menuHasOverLimit(m: WeekendMenuData): boolean {
  if (m.weekly.title.length  > L.weeklyTitle)  return true;
  if (m.policy_line.length   > L.policyLine)   return true;
  for (const sid of ['starters', 'entrees'] as SectionId[]) {
    const s = m.sections[sid];
    if (s.title.length    > L.sectionTitle)    return true;
    if (s.subtitle.length > L.sectionSubtitle) return true;
    for (const d of s.items) {
      if (d.name.length  > L.dishName)  return true;
      if (d.desc.length  > L.dishDesc)  return true;
      if (d.price.length > L.dishPrice) return true;
    }
  }
  for (const r of m.weekly.rows) {
    if (r.day_label.length > L.weeklyDayLabel)  return true;
    if (r.headline.length  > L.weeklyHeadline)  return true;
    if (r.detail.length    > L.weeklyDetail)    return true;
  }
  return false;
}

function blankDish(): WeekendDish {
  return { id: newDishId(), name: '', desc: '', price: '' };
}

// ── CharCount ─────────────────────────────────────────────────────────────

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const cls = len > max ? 'char-count over' : len > max * 0.85 ? 'char-count warn' : 'char-count';
  return <span className={cls}>{len}/{max}</span>;
}

// ── Dish card ─────────────────────────────────────────────────────────────

function DishCard({
  dish, index, sectionId, canRemove, onChange, onRemove,
}: {
  dish: WeekendDish;
  index: number;
  sectionId: SectionId;
  canRemove: boolean;
  onChange: (sectionId: SectionId, index: number, updated: WeekendDish) => void;
  onRemove: (sectionId: SectionId, index: number) => void;
}) {
  function set(field: keyof WeekendDish, value: string) {
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
            <span className="dish-name-preview">{dish.name || '(new dish)'}</span>
            <button
              className="btn-remove-dish"
              disabled={!canRemove}
              title={canRemove ? 'Remove dish' : 'Need at least 1 dish'}
              onClick={() => onRemove(sectionId, index)}
            >
              ×
            </button>
          </div>

          <div className="dish-fields">
            <div className="dish-field-row">
              <div className="field-group" style={{ flex: 1 }}>
                <div className="field-label-row">
                  <label>Dish name</label>
                  <CharCount value={dish.name} max={L.dishName} />
                </div>
                <input
                  value={dish.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Burrata e Pèsca"
                />
              </div>
              <div className="field-group" style={{ width: '100px', flexShrink: 0 }}>
                <div className="field-label-row">
                  <label>Price</label>
                  <CharCount value={dish.price} max={L.dishPrice} />
                </div>
                <input
                  value={dish.price}
                  onChange={e => set('price', e.target.value)}
                  placeholder="$17"
                />
              </div>
            </div>

            <div className="field-group" style={{ marginBottom: 0 }}>
              <div className="field-label-row">
                <label>Description</label>
                <CharCount value={dish.desc} max={L.dishDesc} />
              </div>
              <textarea
                rows={2}
                value={dish.desc}
                onChange={e => set('desc', e.target.value)}
                placeholder="Ingredients and preparation"
              />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ── Section block ─────────────────────────────────────────────────────────

function SectionBlock({
  sectionId, section, label, defaultOpen, onChange, onDishChange, onAddDish, onRemoveDish,
}: {
  sectionId: SectionId;
  section: WeekendSection;
  label: string;
  defaultOpen: boolean;
  onChange: (id: SectionId, updated: WeekendSection) => void;
  onDishChange: (id: SectionId, index: number, updated: WeekendDish) => void;
  onAddDish: (id: SectionId) => void;
  onRemoveDish: (id: SectionId, index: number) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const canAdd    = section.items.length < 4;
  const canRemove = section.items.length > 1;

  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => setOpen(o => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">{label} — {section.title}</span>
        <span className="section-count">{section.items.length} dish{section.items.length !== 1 ? 'es' : ''}</span>
      </div>

      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body">
          <div className="dish-field-row" style={{ marginBottom: '16px' }}>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <div className="field-label-row">
                <label>Section title</label>
                <CharCount value={section.title} max={L.sectionTitle} />
              </div>
              <input
                value={section.title}
                onChange={e => onChange(sectionId, { ...section, title: e.target.value })}
              />
            </div>
            <div className="field-group" style={{ width: '140px', flexShrink: 0, marginBottom: 0 }}>
              <div className="field-label-row">
                <label>Subtitle</label>
                <CharCount value={section.subtitle} max={L.sectionSubtitle} />
              </div>
              <input
                value={section.subtitle}
                onChange={e => onChange(sectionId, { ...section, subtitle: e.target.value })}
              />
            </div>
          </div>

          <Droppable droppableId={sectionId} type="dish">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="dish-list">
                {section.items.map((dish, i) => (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    index={i}
                    sectionId={sectionId}
                    canRemove={canRemove}
                    onChange={onDishChange}
                    onRemove={onRemoveDish}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          <button
            className="btn-add-dish"
            disabled={!canAdd}
            onClick={() => onAddDish(sectionId)}
          >
            {canAdd ? `+ Add ${label.toLowerCase()}` : `Max 4 dishes reached`}
          </button>
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
              <div className="field-group" style={{ width: '140px', flexShrink: 0 }}>
                <div className="field-label-row">
                  <label>Day label</label>
                  <CharCount value={row.day_label} max={L.weeklyDayLabel} />
                </div>
                <input
                  value={row.day_label}
                  onChange={e => set('day_label', e.target.value)}
                  placeholder="e.g. Mondays"
                />
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <div className="field-label-row">
                  <label>Headline</label>
                  <CharCount value={row.headline} max={L.weeklyHeadline} />
                </div>
                <input
                  value={row.headline}
                  onChange={e => set('headline', e.target.value)}
                  placeholder="e.g. $26 for 26 Years"
                />
              </div>
            </div>

            <div className="field-group" style={{ marginBottom: 0 }}>
              <div className="field-label-row">
                <label>Detail</label>
                <CharCount value={row.detail} max={L.weeklyDetail} />
              </div>
              <textarea
                rows={2}
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
  weekly: WeekendMenuData['weekly'];
  onTitleChange: (title: string) => void;
  onRowChange: (index: number, updated: WeeklyRow) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => setOpen(o => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">Throughout the Week</span>
        <span className="section-count">4 promos — rarely changes</span>
      </div>

      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body">
          <div className="field-group section-title-field">
            <div className="field-label-row">
              <label>Section title</label>
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

function HistoryPanel({ onRestore }: { onRestore: (data: WeekendMenuData) => void }) {
  const [backups, setBackups]     = useState<BackupEntry[]>([]);
  const [open, setOpen]           = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/weekend/backups');
    if (res.ok) setBackups(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function restore(entry: BackupEntry) {
    if (!confirm(`Restore Weekend menu to the version saved on ${entry.label}?\n\nThis will overwrite your current menu.`)) return;
    setRestoring(entry.key);
    try {
      const res = await fetch('/api/weekend/backups', {
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

export default function WeekendEditorPage() {
  const [menu, setMenu]             = useState<WeekendMenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg]       = useState('');
  const [historyKey, setHistoryKey] = useState(0);
  const prevJsonRef = useRef<string>('');

  useEffect(() => {
    fetch('/api/weekend')
      .then(r => r.json())
      .then(data => {
        setMenu(data);
        prevJsonRef.current = JSON.stringify(data);
      })
      .catch(() => setSaveStatus('error'));
  }, []);

  const debouncedMenu = useDebounce(menu, 800);

  const saveAndRefresh = useCallback(async (data: WeekendMenuData) => {
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
      const res = await fetch('/api/weekend', {
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
    if (!confirm('Start a new week?\n\nThis will clear all dish names, descriptions, and prices in both sections. The weekly promotions at the bottom will stay as-is.\n\nYour current menu will be saved as a backup.')) return;
    setMenu(m => {
      if (!m) return m;
      const clearSection = (s: WeekendSection): WeekendSection => ({
        ...s,
        items: s.items.map(() => blankDish()),
      });
      return {
        ...m,
        sections: {
          starters: clearSection(m.sections.starters),
          entrees:  clearSection(m.sections.entrees),
        },
      };
    });
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  function handleSectionChange(id: SectionId, updated: WeekendSection) {
    setMenu(m => m && { ...m, sections: { ...m.sections, [id]: updated } });
  }

  function handleDishChange(id: SectionId, index: number, updated: WeekendDish) {
    setMenu(m => {
      if (!m) return m;
      const items = [...m.sections[id].items];
      items[index] = updated;
      return { ...m, sections: { ...m.sections, [id]: { ...m.sections[id], items } } };
    });
  }

  function handleAddDish(id: SectionId) {
    setMenu(m => {
      if (!m) return m;
      const s = m.sections[id];
      if (s.items.length >= 4) return m;
      return { ...m, sections: { ...m.sections, [id]: { ...s, items: [...s.items, blankDish()] } } };
    });
  }

  function handleRemoveDish(id: SectionId, index: number) {
    setMenu(m => {
      if (!m) return m;
      const s = m.sections[id];
      if (s.items.length <= 1) return m;
      const items = s.items.filter((_, i) => i !== index);
      return { ...m, sections: { ...m.sections, [id]: { ...s, items } } };
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
    if (source.droppableId !== destination.droppableId) return;

    if (type === 'dish') {
      const sectionId = source.droppableId as SectionId;
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
      <div className="app-wide">

        {/* ── Sticky header ──────────────────────────────────── */}
        <div className="editor-wide-header">
          <Link href="/" className="btn-back">← All Menus</Link>
          <h1>Weekend Specials</h1>
          <span className={saveStatusClass} style={{ color: undefined }}>
            {saveStatus === 'saved'  ? '✓ Saved' :
             saveStatus === 'saving' ? 'Saving…' :
             saveStatus === 'error'  ? `⚠ ${saveMsg}` : ''}
          </span>
          <button className="btn-new-week" onClick={handleNewWeek}>
            New Week
          </button>
          <button
            className="btn-ghost"
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '5px 12px' }}
            onClick={() => window.open('/weekend-preview', '_blank')}
          >
            Preview
          </button>
          <button
            className="btn-print"
            onClick={() => {
              if (menu) localStorage.setItem('siena-weekend-print-data', JSON.stringify(menu));
              window.open('/weekend-print', '_blank');
            }}
          >
            Print Menu
          </button>
        </div>

        {/* ── Form content ───────────────────────────────────── */}
        <div className="editor-full">

          <div style={{ paddingTop: '24px' }}>

            {/* Dish sections */}
            <div className="page-group">
              <div className="page-group-label">This week's dishes</div>
              <SectionBlock
                sectionId="starters"
                section={menu.sections.starters}
                label="Starters"
                defaultOpen={true}
                onChange={handleSectionChange}
                onDishChange={handleDishChange}
                onAddDish={handleAddDish}
                onRemoveDish={handleRemoveDish}
              />
              <SectionBlock
                sectionId="entrees"
                section={menu.sections.entrees}
                label="Entrees"
                defaultOpen={true}
                onChange={handleSectionChange}
                onDishChange={handleDishChange}
                onAddDish={handleAddDish}
                onRemoveDish={handleRemoveDish}
              />
            </div>

            {/* Weekly footer */}
            <div className="page-group">
              <div className="page-group-label">Throughout the week</div>
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

          </div>

          <HistoryPanel
            key={historyKey}
            onRestore={data => {
              setMenu(data);
              prevJsonRef.current = JSON.stringify(data);
              setSaveStatus('saved');
              setSaveMsg('Restored');
              setTimeout(() => setSaveStatus('idle'), 3000);
            }}
          />

        </div>
      </div>
    </DragDropContext>
  );
}
