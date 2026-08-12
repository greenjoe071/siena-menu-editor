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

interface DolciItem {
  id: string;
  name: string;
  desc: string;
  price: string;   // stored WITHOUT the $ glyph, e.g. "11.00"
}

interface DopaCenaItem {
  id: string;
  name: string;
  price: string;
  sub?: string;     // optional one-line note (e.g. a grappa's producing region)
}

type DopaKey = 'digestivo' | 'grappa' | 'ports' | 'cognac' | 'traditionalItalian';

interface DessertMenuData {
  dolci: DolciItem[];
  dopaCena: Record<DopaKey, DopaCenaItem[]>;
}

// validate.js report shape — one entry per page ("dolci" / "dopacena")
interface PageReport { id: string; fits: boolean; shrunk: boolean; overflowPx: number; worstList: string | null; }
interface ValidateReport { fits: boolean; pages: PageReport[]; error?: string; }

// ── Static config ─────────────────────────────────────────────────────────

const DOPA_SUBS: { key: DopaKey; listId: string; title: string }[] = [
  { key: 'digestivo',          listId: 'dopacena-digestivo',          title: 'Digestivo' },
  { key: 'grappa',              listId: 'dopacena-grappa',             title: 'Grappa · 2.5 oz' },
  { key: 'ports',                listId: 'dopacena-ports',              title: 'Ports · 2.5 oz' },
  { key: 'cognac',                listId: 'dopacena-cognac',             title: 'Cognac & Calvados' },
  { key: 'traditionalItalian',    listId: 'dopacena-traditionalItalian', title: 'Traditional Italian · 2.5 oz' },
];

// data-list-id → human label (for the overflow message)
const LIST_LABELS: Record<string, string> = {
  'dolci': 'Dolci',
  'dopacena-digestivo': 'Digestivo',
  'dopacena-grappa': 'Grappa',
  'dopacena-ports': 'Ports',
  'dopacena-cognac': 'Cognac & Calvados',
  'dopacena-traditionalItalian': 'Traditional Italian',
};

const CARD_LABELS: Record<string, string> = {
  dolci: 'Dolci', dopacena: 'Siena Dopa Cena',
};

// ── Helpers ───────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return d;
}

function newId(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 7);
}

function filterPrice(v: string): string {
  const cleaned = v.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
}

// ── Price input ($ shown, not stored) ─────────────────────────────────────

function PriceInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="price-input-wrap" style={{ width: '96px' }}>
      <span className="price-dollar">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(filterPrice(e.target.value))}
        placeholder="0.00"
      />
    </div>
  );
}

// ── Dolci list — every field required, no optional note/desc ──────────────

function DolciItemRow({
  item, index, onChange, onRemove,
}: {
  item: DolciItem;
  index: number;
  onChange: (updated: DolciItem) => void;
  onRemove: () => void;
}) {
  function set<K extends keyof DolciItem>(k: K, v: DolciItem[K]) { onChange({ ...item, [k]: v }); }

  return (
    <Draggable draggableId={item.id} index={index}>
      {(prov, snap) => (
        <div
          ref={prov.innerRef}
          {...prov.draggableProps}
          className="dish-row"
          style={{
            ...prov.draggableProps.style,
            opacity: snap.isDragging ? 0.85 : 1,
            boxShadow: snap.isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : undefined,
          }}
        >
          <div className="dish-row-header">
            <span className="drag-handle" {...prov.dragHandleProps} title="Drag to reorder">⠿</span>
            <span className="dish-name-preview">{item.name || '(new item)'}</span>
            <button className="btn-remove-dish" title="Remove item" onClick={onRemove}>×</button>
          </div>

          <div className="dish-fields">
            <div className="dish-field-row" style={{ alignItems: 'flex-end', gap: '10px' }}>
              <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Name</label>
                <input value={item.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Tiramisu" />
              </div>
              <div className="field-group" style={{ flexShrink: 0, marginBottom: 0 }}>
                <label>Price</label>
                <PriceInput value={item.price} onChange={v => set('price', v)} />
              </div>
            </div>

            <div className="field-group" style={{ marginBottom: 0, marginTop: '8px' }}>
              <label>Description</label>
              <textarea rows={2} value={item.desc} onChange={e => set('desc', e.target.value)} placeholder="Description" />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

function DolciEditableList({
  items, onItemsChange,
}: {
  items: DolciItem[];
  onItemsChange: (items: DolciItem[]) => void;
}) {
  function updateAt(i: number, updated: DolciItem) {
    const next = [...items]; next[i] = updated; onItemsChange(next);
  }
  function removeAt(i: number) { onItemsChange(items.filter((_, idx) => idx !== i)); }
  function add() { onItemsChange([...items, { id: newId('ds'), name: '', desc: '', price: '' }]); }

  return (
    <div>
      <Droppable droppableId="dolci" type="ds-item">
        {(prov) => (
          <div ref={prov.innerRef} {...prov.droppableProps} className="dish-list">
            {items.map((it, i) => (
              <DolciItemRow key={it.id} item={it} index={i} onChange={u => updateAt(i, u)} onRemove={() => removeAt(i)} />
            ))}
            {prov.placeholder}
          </div>
        )}
      </Droppable>
      <button className="btn-add-dish" onClick={add}>+ Add dessert</button>
    </div>
  );
}

// ── Dopa Cena list — name + price required, optional one-line sub-note ────

function DopaCenaItemRow({
  item, index, onChange, onRemove,
}: {
  item: DopaCenaItem;
  index: number;
  onChange: (updated: DopaCenaItem) => void;
  onRemove: () => void;
}) {
  const [showSub, setShowSub] = useState(!!(item.sub && item.sub.length));

  function set<K extends keyof DopaCenaItem>(k: K, v: DopaCenaItem[K]) { onChange({ ...item, [k]: v }); }

  return (
    <Draggable draggableId={item.id} index={index}>
      {(prov, snap) => (
        <div
          ref={prov.innerRef}
          {...prov.draggableProps}
          className="dish-row"
          style={{
            ...prov.draggableProps.style,
            opacity: snap.isDragging ? 0.85 : 1,
            boxShadow: snap.isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : undefined,
          }}
        >
          <div className="dish-row-header">
            <span className="drag-handle" {...prov.dragHandleProps} title="Drag to reorder">⠿</span>
            <span className="dish-name-preview">{item.name || '(new item)'}</span>
            <button className="btn-remove-dish" title="Remove item" onClick={onRemove}>×</button>
          </div>

          <div className="dish-fields">
            <div className="dish-field-row" style={{ alignItems: 'flex-end', gap: '10px' }}>
              <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Name</label>
                <input value={item.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Amaro Nonino" />
              </div>
              <div className="field-group" style={{ flexShrink: 0, marginBottom: 0 }}>
                <label>Price</label>
                <PriceInput value={item.price} onChange={v => set('price', v)} />
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              {showSub ? (
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <div className="field-label-row">
                    <label>Note (optional — e.g. producing region)</label>
                    <button className="btn-link-remove" onClick={() => { setShowSub(false); set('sub', ''); }}>remove</button>
                  </div>
                  <input value={item.sub ?? ''} onChange={e => set('sub', e.target.value)} placeholder="e.g. Brunello Riserva di Montalcino" />
                </div>
              ) : (
                <button className="btn-add-inline" onClick={() => setShowSub(true)}>+ note</button>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

function DopaCenaEditableList({
  listId, items, onItemsChange,
}: {
  listId: string;
  items: DopaCenaItem[];
  onItemsChange: (items: DopaCenaItem[]) => void;
}) {
  function updateAt(i: number, updated: DopaCenaItem) {
    const next = [...items]; next[i] = updated; onItemsChange(next);
  }
  function removeAt(i: number) { onItemsChange(items.filter((_, idx) => idx !== i)); }
  function add() { onItemsChange([...items, { id: newId('dc'), name: '', price: '' }]); }

  return (
    <div>
      <Droppable droppableId={listId} type="dc-item">
        {(prov) => (
          <div ref={prov.innerRef} {...prov.droppableProps} className="dish-list">
            {items.map((it, i) => (
              <DopaCenaItemRow key={it.id} item={it} index={i} onChange={u => updateAt(i, u)} onRemove={() => removeAt(i)} />
            ))}
            {prov.placeholder}
          </div>
        )}
      </Droppable>
      <button className="btn-add-dish" onClick={add}>+ Add</button>
    </div>
  );
}

// ── Collapsible card panel ────────────────────────────────────────────────

function CardPanel({
  title, pageId, report, variant, children,
}: {
  title: string; pageId: string; report: ValidateReport | null; variant: string; children: React.ReactNode;
}) {
  const pr = report?.pages.find(p => p.id === pageId);
  let status: React.ReactNode = null;
  if (pr) {
    if (!pr.fits) status = <span className="dd-chip dd-chip--bad">⚠ too long</span>;
    else if (pr.shrunk) status = <span className="dd-chip dd-chip--warn">✓ fits (reduced type)</span>;
    else status = <span className="dd-chip dd-chip--ok">✓ fits</span>;
  }
  return (
    <div className={`section-block section-block--${variant}`}>
      <div className={`section-block-header section-block-header--${variant}`}>
        <span className="section-title-label">{title}</span>
        {status}
      </div>
      <div className="collapsible-content open">
        <div className="section-body">{children}</div>
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────

export default function DessertEditorPage() {
  // No draft/publish flow on this menu (Aug 2026) — /edit and /fix are the
  // same route in practice, both editing the LIVE menu directly via
  // /api/dessert/fix. Every change saves immediately.
  const apiPath = '/api/dessert/fix';
  const landingHref = '/dessert';

  const [menu, setMenu] = useState<DessertMenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [report, setReport] = useState<ValidateReport | null>(null);
  const [previewUrl, setPreviewUrl] = useState('/dessert-preview?src=current');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevJsonRef = useRef<string>('');
  const pendingSaveRef = useRef<DessertMenuData | null>(null);

  useEffect(() => {
    fetch(apiPath)
      .then(r => r.json())
      .then(data => { setMenu(data); prevJsonRef.current = JSON.stringify(data); })
      .catch(() => setSaveStatus('error'));
  }, [apiPath]);

  const debouncedMenu = useDebounce(menu, 500);

  const saveToServer = useCallback(async (data: DessertMenuData) => {
    const json = JSON.stringify(data);
    if (json === prevJsonRef.current) return;
    prevJsonRef.current = json;
    setSaveStatus('saving'); setSaveMsg('Saving…');
    try {
      const res = await fetch(apiPath, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.issues ? body.issues.map((i: { message: string }) => i.message).join('; ') : (body.error || 'Save failed');
        setSaveStatus('error'); setSaveMsg(msg); return;
      }
      setSaveStatus('saved'); setSaveMsg('Saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch { setSaveStatus('error'); setSaveMsg('Network error'); }
  }, [apiPath]);

  // Validation result → status chips + gate the pending save.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || e.data.type !== 'SIENA_DESSERT_VALIDATE_RESULT') return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const rep = e.data.report as ValidateReport;
      setReport(rep);
      if (rep.fits) {
        if (pendingSaveRef.current) { saveToServer(pendingSaveRef.current); pendingSaveRef.current = null; }
      } else {
        pendingSaveRef.current = null;
        const bad = rep.pages.find(p => !p.fits);
        const card = bad ? (CARD_LABELS[bad.id] ?? bad.id) : 'A card';
        const worst = bad?.worstList ? LIST_LABELS[bad.worstList] ?? bad.worstList : null;
        setSaveStatus('error');
        setSaveMsg(worst
          ? `${card} is too long — ${worst} is the largest section. Remove an item there, or shorten/remove a description.`
          : `${card} is too long — remove an item or shorten a description.`);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [saveToServer]);

  // Debounced edits → push to preview iframe for render + validate.
  useEffect(() => {
    if (!debouncedMenu || prevJsonRef.current === '') return;
    pendingSaveRef.current = debouncedMenu;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SIENA_DESSERT_UPDATE', payload: debouncedMenu }, '*'
    );
  }, [debouncedMenu]);

  function handlePrint() {
    if (!menu) return;
    localStorage.setItem('siena-dessert-print-data', JSON.stringify(menu));
    window.open('/dessert-print?src=current', '_blank');
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  function setDolci(items: DolciItem[]) { setMenu(m => m && { ...m, dolci: items }); }
  function setDopaCena(key: DopaKey, items: DopaCenaItem[]) {
    setMenu(m => m && { ...m, dopaCena: { ...m.dopaCena, [key]: items } });
  }

  // Drag reorder within a single list (blocked across lists).
  function handleDragEnd(result: DropResult) {
    if (!result.destination || !menu) return;
    const { source, destination } = result;
    if (source.droppableId !== destination.droppableId) return;
    const listId = source.droppableId;

    function reorder<T>(items: T[]): T[] {
      const next = Array.from(items);
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      return next;
    }

    if (listId === 'dolci') {
      setDolci(reorder(menu.dolci));
    } else {
      const sub = DOPA_SUBS.find(s => s.listId === listId);
      if (sub) setDopaCena(sub.key, reorder(menu.dopaCena[sub.key]));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!menu) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading…</div>;
  }

  const saveStatusClass =
    saveStatus === 'saved' ? 'save-status saved' :
    saveStatus === 'saving' ? 'save-status saving' :
    saveStatus === 'error' ? 'save-status error' : 'save-status';

  const anyOverflow = report ? !report.fits : false;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="app">
        {/* ── Editor pane ─────────────────────────────────────────── */}
        <div className="editor-pane">
          <div className="editor-header">
            <Link href={landingHref} className="btn-back">← Back</Link>
            <h1>Making a Change</h1>
            <Link href="/" className="btn-home">🏠 Home</Link>
          </div>

          <div className="draft-banner fix-banner">
            ✏️ Every change you make here saves right away — every card must still fit before you can print.
          </div>

          <div className="editor-scroll chef-mode">
            <div className="weekend-instructions" style={{ margin: '12px 0 8px' }}>
              <p>One sheet, cut into two different cards — <strong>Dolci</strong> (left) and <strong>Siena Dopa Cena</strong> (right). Add or remove items freely — a card will tell you if it runs out of room.</p>
            </div>

            <div className="page-group">
              <div className="page-group-label">Left card</div>
              <CardPanel title="Dolci" pageId="dolci" report={report} variant="dessert">
                <DolciEditableList items={menu.dolci} onItemsChange={setDolci} />
              </CardPanel>
            </div>

            <div className="page-group">
              <div className="page-group-label">Right card</div>
              <CardPanel title="Siena Dopa Cena" pageId="dopacena" report={report} variant="dopacena">
                {DOPA_SUBS.map(sub => (
                  <div key={sub.key} className="dd-subsection">
                    <div className="dd-subsection-title">{sub.title}</div>
                    <DopaCenaEditableList
                      listId={sub.listId} items={menu.dopaCena[sub.key]}
                      onItemsChange={items => setDopaCena(sub.key, items)}
                    />
                  </div>
                ))}
              </CardPanel>
            </div>
          </div>{/* end editor-scroll */}

          {/* Save status + print control */}
          <div className="editor-footer">
            <span className={saveStatusClass} style={{ flex: 1 }}>
              {saveStatus === 'error' ? `⚠ ${saveMsg}` : (saveMsg || 'Auto-saves as you type')}
            </span>
            <button className="btn-print" disabled={anyOverflow} title={anyOverflow ? 'Fix overflow first' : undefined} onClick={handlePrint}>Print</button>
          </div>
        </div>

        {/* ── Preview pane ────────────────────────────────────────── */}
        <div className="preview-pane">
          <div className="preview-toolbar">
            <span>Live preview — Dolci &amp; Dopa Cena, one sheet</span>
            <button
              className="btn-ghost"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setPreviewUrl('/dessert-preview?src=current&' + Date.now())}
            >
              ↺ Reload from server
            </button>
          </div>
          <iframe ref={iframeRef} src={previewUrl} className="preview-iframe" title="Dessert preview" />
        </div>
      </div>
    </DragDropContext>
  );
}
