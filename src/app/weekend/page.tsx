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
  price_label?: string;
  price2?: string;
  price2_label?: string;
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

interface WeekendDessert {
  title: string;
  name:  string;
  desc:  string;
  price: string;
}

interface WeekendMenuData {
  sections: {
    starters: WeekendSection;
    entrees:  WeekendSection;
  };
  dessert?: WeekendDessert | null;
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
  dishPriceLabel:   8,
  weeklyTitle:     42,
  weeklyDayLabel:  14,
  weeklyHeadline:  26,
  weeklyDetail:   110,
  policyLine:     120,
} as const;

// ── Price helpers ─────────────────────────────────────────────────────────

function filterPrice(v: string): string {
  const digits = v.replace(/[^0-9.]/g, '');
  const parts  = digits.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : digits;
}

function stripDollar(v: string): string {
  return v.startsWith('$') ? v.slice(1) : v;
}

function combinedPrice(d: WeekendDish): string {
  if (d.price2) {
    const l1 = d.price_label  ? `${d.price_label} `  : '';
    const l2 = d.price2_label ? `${d.price2_label} ` : '';
    return `${l1}${d.price} / ${l2}${d.price2}`;
  }
  return d.price;
}

function toRendererData(data: WeekendMenuData) {
  const mapItems = (items: WeekendDish[]) => items.map(d => ({ ...d, price: combinedPrice(d) }));
  return {
    ...data,
    sections: {
      starters: { ...data.sections.starters, items: mapItems(data.sections.starters.items) },
      entrees:  { ...data.sections.entrees,  items: mapItems(data.sections.entrees.items) },
    },
  };
}

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
  if (m.dessert) {
    if (m.dessert.title.length > L.sectionTitle) return true;
    if (m.dessert.name.length  > L.dishName)     return true;
    if (m.dessert.desc.length  > L.dishDesc)     return true;
    if (m.dessert.price.length > L.dishPrice)    return true;
  }
  for (const sid of ['starters', 'entrees'] as SectionId[]) {
    const s = m.sections[sid];
    if (s.title.length    > L.sectionTitle)    return true;
    if (s.subtitle.length > L.sectionSubtitle) return true;
    for (const d of s.items) {
      if (d.name.length                    > L.dishName)       return true;
      if (d.desc.length                    > L.dishDesc)       return true;
      if (d.price.length                   > L.dishPrice)      return true;
      if ((d.price_label  ?? '').length    > L.dishPriceLabel) return true;
      if ((d.price2       ?? '').length    > L.dishPrice)      return true;
      if ((d.price2_label ?? '').length    > L.dishPriceLabel) return true;
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

// ── Price input (auto-$ prefix, numbers only) ─────────────────────────────

function PriceInput({ value, onChange, placeholder = '0.00' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="price-input-wrap">
      <span className="price-dollar">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={stripDollar(value)}
        onChange={e => onChange('$' + filterPrice(e.target.value))}
        placeholder={placeholder}
      />
    </div>
  );
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
  const [showDual, setShowDual] = useState(!!dish.price2);

  function set(field: keyof WeekendDish, value: string) {
    onChange(sectionId, index, { ...dish, [field]: value });
  }

  function enableDual() {
    setShowDual(true);
    onChange(sectionId, index, { ...dish, price_label: '', price2: '', price2_label: '' });
  }

  function disableDual() {
    setShowDual(false);
    const { price_label: _pl, price2: _p2, price2_label: _p2l, ...rest } = dish;
    onChange(sectionId, index, rest as WeekendDish);
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
            >×</button>
          </div>

          <div className="dish-fields">
            <div className="field-group">
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

            {!showDual ? (
              <div className="dish-field-row" style={{ alignItems: 'flex-end' }}>
                <div className="field-group" style={{ width: '120px', flexShrink: 0, marginBottom: 0 }}>
                  <div className="field-label-row">
                    <label>Price</label>
                    <CharCount value={stripDollar(dish.price)} max={L.dishPrice} />
                  </div>
                  <PriceInput value={dish.price} onChange={v => set('price', v)} />
                </div>
                <button className="btn-add-price" onClick={enableDual}>+ 2nd price</button>
              </div>
            ) : (
              <div className="dual-price-wrap">
                <div className="dual-price-label">Two prices (e.g. Bowl / Cup)</div>
                <div className="dual-price-row">
                  <div className="field-group" style={{ width: '80px', flexShrink: 0, marginBottom: 0 }}>
                    <label>Label 1</label>
                    <input value={dish.price_label ?? ''} onChange={e => set('price_label', e.target.value)} placeholder="Bowl" maxLength={L.dishPriceLabel} />
                  </div>
                  <div className="field-group" style={{ width: '110px', flexShrink: 0, marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Price 1</label>
                      <CharCount value={stripDollar(dish.price)} max={L.dishPrice} />
                    </div>
                    <PriceInput value={dish.price} onChange={v => set('price', v)} />
                  </div>
                </div>
                <div className="dual-price-row">
                  <div className="field-group" style={{ width: '80px', flexShrink: 0, marginBottom: 0 }}>
                    <label>Label 2</label>
                    <input value={dish.price2_label ?? ''} onChange={e => set('price2_label', e.target.value)} placeholder="Cup" maxLength={L.dishPriceLabel} />
                  </div>
                  <div className="field-group" style={{ width: '110px', flexShrink: 0, marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Price 2</label>
                      <CharCount value={stripDollar(dish.price2 ?? '')} max={L.dishPrice} />
                    </div>
                    <PriceInput value={dish.price2 ?? ''} onChange={v => set('price2', v)} />
                  </div>
                  <button className="btn-remove-price" onClick={disableDual}>× one price</button>
                </div>
              </div>
            )}

            <div className="field-group" style={{ marginBottom: 0 }}>
              <div className="field-label-row">
                <label>Description</label>
                <CharCount value={dish.desc} max={L.dishDesc} />
              </div>
              <textarea rows={2} value={dish.desc} onChange={e => set('desc', e.target.value)} placeholder="Ingredients and preparation" />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ── Section block ─────────────────────────────────────────────────────────

function SectionBlock({
  sectionId, section, label, defaultOpen, variant, onChange, onDishChange, onAddDish, onRemoveDish,
}: {
  sectionId: SectionId;
  section: WeekendSection;
  label: string;
  defaultOpen: boolean;
  variant: 'starters' | 'entrees';
  onChange: (id: SectionId, updated: WeekendSection) => void;
  onDishChange: (id: SectionId, index: number, updated: WeekendDish) => void;
  onAddDish: (id: SectionId) => void;
  onRemoveDish: (id: SectionId, index: number) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const canAdd    = section.items.length < 4;
  const canRemove = section.items.length > 1;

  return (
    <div className={`section-block section-block--${variant}`}>
      <div className={`section-block-header section-block-header--${variant}`} onClick={() => setOpen(o => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">{label} — {section.title}</span>
        <span className="section-count">{section.items.length} dish{section.items.length !== 1 ? 'es' : ''}</span>
      </div>

      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body">
          <div className="dish-field-row" style={{ marginBottom: '12px' }}>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <div className="field-label-row">
                <label>Section title</label>
                <CharCount value={section.title} max={L.sectionTitle} />
              </div>
              <input value={section.title} onChange={e => onChange(sectionId, { ...section, title: e.target.value })} />
            </div>
            <div className="field-group" style={{ width: '130px', flexShrink: 0, marginBottom: 0 }}>
              <div className="field-label-row">
                <label>Subtitle</label>
                <CharCount value={section.subtitle} max={L.sectionSubtitle} />
              </div>
              <input value={section.subtitle} onChange={e => onChange(sectionId, { ...section, subtitle: e.target.value })} />
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

          <button className="btn-add-dish" disabled={!canAdd} onClick={() => onAddDish(sectionId)}>
            {canAdd ? `+ Add ${label.toLowerCase()}` : 'Max 4 dishes reached'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Weekly row item ───────────────────────────────────────────────────────

function WeeklyRowItem({ row, index, onChange }: {
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
            <span className="dish-name-preview">{row.day_label || '(no day)'} — {row.headline || '(no headline)'}</span>
          </div>

          <div className="dish-fields">
            <div className="dish-field-row">
              <div className="field-group" style={{ width: '130px', flexShrink: 0 }}>
                <div className="field-label-row">
                  <label>Day</label>
                  <CharCount value={row.day_label} max={L.weeklyDayLabel} />
                </div>
                <input value={row.day_label} onChange={e => set('day_label', e.target.value)} placeholder="e.g. Mondays" />
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <div className="field-label-row">
                  <label>Headline</label>
                  <CharCount value={row.headline} max={L.weeklyHeadline} />
                </div>
                <input value={row.headline} onChange={e => set('headline', e.target.value)} placeholder="e.g. $26 for 26 Years" />
              </div>
            </div>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <div className="field-label-row">
                <label>Detail</label>
                <CharCount value={row.detail} max={L.weeklyDetail} />
              </div>
              <textarea rows={2} value={row.detail} onChange={e => set('detail', e.target.value)} placeholder="Description of the special" />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ── Weekly block ──────────────────────────────────────────────────────────

function WeeklyBlock({ weekly, onTitleChange, onRowChange }: {
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

// ── Dessert block ─────────────────────────────────────────────────────────

const DEFAULT_DESSERT: WeekendDessert = { title: 'Dolci', name: '', desc: '', price: '' };

function DessertBlock({ dessert, onChange }: {
  dessert: WeekendDessert | null | undefined;
  onChange: (d: WeekendDessert | null) => void;
}) {
  const [open, setOpen] = useState(!!dessert);
  const active = !!dessert;

  function toggle() {
    if (active) {
      onChange(null);
      setOpen(false);
    } else {
      onChange({ ...DEFAULT_DESSERT });
      setOpen(true);
    }
  }

  function set(field: keyof WeekendDessert, value: string) {
    if (!dessert) return;
    onChange({ ...dessert, [field]: value });
  }

  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => active && setOpen(o => !o)} style={{ cursor: active ? 'pointer' : 'default' }}>
        {active && <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>}
        {!active && <span className="section-toggle" style={{ opacity: 0.3 }}>▶</span>}
        <span className="section-title-label">Dessert — {active ? (dessert?.title || 'Dolci') : 'hidden'}</span>
        <label className="dessert-toggle-label" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={active} onChange={toggle} />
          {' '}Show on menu
        </label>
      </div>

      {active && (
        <div className={`collapsible-content ${open ? 'open' : ''}`}>
          <div className="section-body">
            <div className="dish-row">
              <div className="dish-fields">
                <div className="dish-field-row" style={{ marginBottom: '10px' }}>
                  <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Section title</label>
                      <CharCount value={dessert!.title} max={L.sectionTitle} />
                    </div>
                    <input value={dessert!.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Dolci" />
                  </div>
                </div>
                <div className="field-group">
                  <div className="field-label-row">
                    <label>Dish name</label>
                    <CharCount value={dessert!.name} max={L.dishName} />
                  </div>
                  <input value={dessert!.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Torta della Nonna" />
                </div>
                <div className="dish-field-row" style={{ alignItems: 'flex-end' }}>
                  <div className="field-group" style={{ width: '120px', flexShrink: 0, marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Price</label>
                      <CharCount value={stripDollar(dessert!.price)} max={L.dishPrice} />
                    </div>
                    <PriceInput value={dessert!.price} onChange={v => set('price', v)} />
                  </div>
                </div>
                <div className="field-group" style={{ marginBottom: 0, marginTop: '10px' }}>
                  <div className="field-label-row">
                    <label>Description</label>
                    <CharCount value={dessert!.desc} max={L.dishDesc} />
                  </div>
                  <textarea rows={2} value={dessert!.desc} onChange={e => set('desc', e.target.value)} placeholder="e.g. Custard cream and pine nut tart, lemon zest, powdered sugar." />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
    } finally { setRestoring(null); }
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
              <button className="btn-restore" disabled={restoring === b.key} onClick={() => restore(b)}>
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
  const [previewUrl, setPreviewUrl] = useState('/weekend-preview');
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const prevJsonRef  = useRef<string>('');

  useEffect(() => {
    fetch('/api/weekend')
      .then(r => r.json())
      .then(data => { setMenu(data); prevJsonRef.current = JSON.stringify(data); })
      .catch(() => setSaveStatus('error'));
  }, []);

  const debouncedMenu    = useDebounce(menu, 800);
  const previewDebounced = useDebounce(menu, 300);

  useEffect(() => {
    if (previewDebounced && prevJsonRef.current !== '') {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SIENA_WEEKEND_UPDATE', payload: toRendererData(previewDebounced) }, '*'
      );
    }
  }, [previewDebounced]);

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
        ...s, items: s.items.map(() => blankDish()),
      });
      return { ...m, sections: { starters: clearSection(m.sections.starters), entrees: clearSection(m.sections.entrees) } };
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
      return { ...m, sections: { ...m.sections, [id]: { ...s, items: s.items.filter((_, i) => i !== index) } } };
    });
  }

  function handleDessertChange(d: WeekendDessert | null) {
    setMenu(m => m && { ...m, dessert: d ?? undefined });
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
      <div className="app">

        {/* ── Editor pane ──────────────────────────────────────────── */}
        <div className="editor-pane">
          <div className="editor-header">
            <Link href="/" className="btn-back">← All Menus</Link>
            <h1>Weekend Specials</h1>
          </div>

          <div className="editor-scroll chef-mode">

            <div className="weekend-instructions" style={{ margin: '12px 0 8px' }}>
              <p>Up to <strong>4 starters</strong> and <strong>4 entrees</strong>. If you need more than that, <strong>call Joe right away.</strong></p>
            </div>

            <div className="page-group">
              <div className="page-group-label">This week's dishes</div>
              <SectionBlock
                sectionId="starters" section={menu.sections.starters}
                label="Starters" defaultOpen={true} variant="starters"
                onChange={handleSectionChange} onDishChange={handleDishChange}
                onAddDish={handleAddDish} onRemoveDish={handleRemoveDish}
              />
              <SectionBlock
                sectionId="entrees" section={menu.sections.entrees}
                label="Entrees" defaultOpen={true} variant="entrees"
                onChange={handleSectionChange} onDishChange={handleDishChange}
                onAddDish={handleAddDish} onRemoveDish={handleRemoveDish}
              />
            </div>

            <div className="page-group">
              <div className="page-group-label">Dessert (optional)</div>
              <DessertBlock dessert={menu.dessert} onChange={handleDessertChange} />
            </div>

            <div className="page-group">
              <div className="page-group-label">Throughout the week</div>
              <WeeklyBlock
                weekly={menu.weekly}
                onTitleChange={handleWeeklyTitleChange}
                onRowChange={handleWeeklyRowChange}
              />
            </div>

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
                { type: 'SIENA_WEEKEND_UPDATE', payload: toRendererData(data) }, '*'
              );
              setTimeout(() => setSaveStatus('idle'), 3000);
            }}
          />

          <div className="editor-footer">
            <button className="btn-new-week" onClick={handleNewWeek}>New Week</button>
            <span className={saveStatusClass} style={{ flex: 1, marginLeft: '8px' }}>
              {saveStatus === 'saved'  ? '✓ Saved' :
               saveStatus === 'saving' ? 'Saving…' :
               saveStatus === 'error'  ? `⚠ ${saveMsg}` :
               'Auto-saves as you type'}
            </span>
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
        </div>

        {/* ── Preview pane ─────────────────────────────────────────── */}
        <div className="preview-pane">
          <div className="preview-toolbar">
            <span>Live preview</span>
            <button
              className="btn-ghost"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setPreviewUrl('/weekend-preview?' + Date.now())}
            >
              ↺ Reload from server
            </button>
          </div>
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="preview-iframe"
            title="Weekend menu preview"
          />
        </div>

      </div>
    </DragDropContext>
  );
}
