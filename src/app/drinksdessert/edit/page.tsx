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

interface Item {
  id: string;
  name: string;
  price: string;   // stored WITHOUT the $ glyph, e.g. "13.00"
  desc?: string;
  note?: string;
}

interface DrinksDessertMenuData {
  cocktails: Item[];
  spirits: { bourbon: Item[]; scotch: Item[]; beer: Item[] };
  dopaCena: {
    digestivo: Item[]; grappa: Item[]; ports: Item[]; cognac: Item[]; traditionalItalian: Item[];
  };
  dolci: Item[];
}

// validate.js report shape
interface PageReport { id: string; fits: boolean; shrunk: boolean; overflowPx: number; worstList: string | null; }
interface ValidateReport { fits: boolean; pages: PageReport[]; error?: string; }

// ── Static config ─────────────────────────────────────────────────────────

type SpiritKey = 'bourbon' | 'scotch' | 'beer';
type DopaKey = 'digestivo' | 'grappa' | 'ports' | 'cognac' | 'traditionalItalian';

const SPIRIT_SUBS: { key: SpiritKey; listId: string; title: string }[] = [
  { key: 'bourbon', listId: 'spirits-bourbon', title: 'Rye / Whiskey / Bourbon' },
  { key: 'scotch',  listId: 'spirits-scotch',  title: 'Single Malt Scotch Whisky' },
  { key: 'beer',    listId: 'spirits-beer',    title: 'Bottled Beer' },
];

const DOPA_SUBS: { key: DopaKey; listId: string; title: string }[] = [
  { key: 'digestivo',          listId: 'dopacena-digestivo',          title: 'Digestivo' },
  { key: 'grappa',             listId: 'dopacena-grappa',             title: 'Grappa · 2.5 oz' },
  { key: 'ports',              listId: 'dopacena-ports',              title: 'Ports · 2.5 oz' },
  { key: 'cognac',             listId: 'dopacena-cognac',             title: 'Cognac & Calvados' },
  { key: 'traditionalItalian', listId: 'dopacena-traditionalItalian', title: 'Traditional Italian · 2.5 oz' },
];

// data-list-id → human label (for the overflow message)
const LIST_LABELS: Record<string, string> = {
  'cocktails': 'Signature Cocktails',
  'spirits-bourbon': 'Rye / Whiskey / Bourbon',
  'spirits-scotch': 'Single Malt Scotch',
  'spirits-beer': 'Bottled Beer',
  'dopacena-digestivo': 'Digestivo',
  'dopacena-grappa': 'Grappa',
  'dopacena-ports': 'Ports',
  'dopacena-cognac': 'Cognac & Calvados',
  'dopacena-traditionalItalian': 'Traditional Italian',
  'dolci': 'Dolci',
};

const CARD_LABELS: Record<string, string> = {
  cocktails: 'Cocktails', spirits: 'Spirits & Beer', dopacena: 'Dopa Cena', dolci: 'Dolci',
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

// ── Editable list (reused by every card / subsection) ─────────────────────

type DescMode = 'none' | 'optional' | 'required';

function ItemRow({
  item, index, descMode, note, onChange, onRemove, namePlaceholder,
}: {
  item: Item;
  index: number;
  descMode: DescMode;
  note: boolean;
  onChange: (updated: Item) => void;
  onRemove: () => void;
  namePlaceholder: string;
}) {
  const [showDesc, setShowDesc] = useState(descMode === 'required' || !!(item.desc && item.desc.length));
  const [showNote, setShowNote] = useState(!!(item.note && item.note.length));

  function set<K extends keyof Item>(k: K, v: Item[K]) { onChange({ ...item, [k]: v }); }

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
                <input value={item.name} onChange={e => set('name', e.target.value)} placeholder={namePlaceholder} />
              </div>
              <div className="field-group" style={{ flexShrink: 0, marginBottom: 0 }}>
                <label>Price</label>
                <PriceInput value={item.price} onChange={v => set('price', v)} />
              </div>
            </div>

            {descMode === 'required' && (
              <div className="field-group" style={{ marginBottom: 0, marginTop: '8px' }}>
                <label>Description</label>
                <textarea rows={2} value={item.desc ?? ''} onChange={e => set('desc', e.target.value)} placeholder="Description" />
              </div>
            )}

            {descMode === 'optional' && (
              <div style={{ marginTop: '8px' }}>
                {showDesc ? (
                  <div className="field-group" style={{ marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Description (optional)</label>
                      <button className="btn-link-remove" onClick={() => { setShowDesc(false); set('desc', ''); }}>remove</button>
                    </div>
                    <textarea rows={2} value={item.desc ?? ''} onChange={e => set('desc', e.target.value)} placeholder="e.g. Brunello Riserva di Montalcino" />
                  </div>
                ) : (
                  <button className="btn-add-inline" onClick={() => setShowDesc(true)}>+ description</button>
                )}
              </div>
            )}

            {note && (
              <div style={{ marginTop: '8px' }}>
                {showNote ? (
                  <div className="field-group" style={{ marginBottom: 0 }}>
                    <div className="field-label-row">
                      <label>Note (optional — small italic line)</label>
                      <button className="btn-link-remove" onClick={() => { setShowNote(false); set('note', ''); }}>remove</button>
                    </div>
                    <input value={item.note ?? ''} onChange={e => set('note', e.target.value)} placeholder="e.g. Add a floater of Grand Marnier — $3.00" />
                  </div>
                ) : (
                  <button className="btn-add-inline" onClick={() => setShowNote(true)}>+ note</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

function EditableList({
  listId, items, descMode, note, addLabel, namePlaceholder, onItemsChange,
}: {
  listId: string;
  items: Item[];
  descMode: DescMode;
  note: boolean;
  addLabel: string;
  namePlaceholder: string;
  onItemsChange: (items: Item[]) => void;
}) {
  function updateAt(i: number, updated: Item) {
    const next = [...items]; next[i] = updated; onItemsChange(next);
  }
  function removeAt(i: number) { onItemsChange(items.filter((_, idx) => idx !== i)); }
  function add() { onItemsChange([...items, { id: newId(listId), name: '', price: '', ...(descMode === 'required' ? { desc: '' } : {}) }]); }

  return (
    <div>
      <Droppable droppableId={listId} type="dd-item">
        {(prov) => (
          <div ref={prov.innerRef} {...prov.droppableProps} className="dish-list">
            {items.map((it, i) => (
              <ItemRow
                key={it.id}
                item={it}
                index={i}
                descMode={descMode}
                note={note}
                namePlaceholder={namePlaceholder}
                onChange={u => updateAt(i, u)}
                onRemove={() => removeAt(i)}
              />
            ))}
            {prov.placeholder}
          </div>
        )}
      </Droppable>
      <button className="btn-add-dish" onClick={add}>{addLabel}</button>
    </div>
  );
}

// ── Collapsible card panel ────────────────────────────────────────────────

function CardPanel({
  title, pageId, report, defaultOpen, children,
}: {
  title: string; pageId: string; report: ValidateReport | null; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const pr = report?.pages.find(p => p.id === pageId);
  let status: React.ReactNode = null;
  if (pr) {
    if (!pr.fits) status = <span className="dd-chip dd-chip--bad">⚠ too long</span>;
    else if (pr.shrunk) status = <span className="dd-chip dd-chip--warn">✓ fits (reduced type)</span>;
    else status = <span className="dd-chip dd-chip--ok">✓ fits</span>;
  }
  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => setOpen(o => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">{title}</span>
        {status}
      </div>
      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body">{children}</div>
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────

export default function DrinksDessertEditorPage() {
  const [menu, setMenu] = useState<DrinksDessertMenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [report, setReport] = useState<ValidateReport | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('/drinksdessert-preview?src=draft');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevJsonRef = useRef<string>('');
  const pendingSaveRef = useRef<DrinksDessertMenuData | null>(null);
  const dopaCenaRef = useRef<HTMLDivElement>(null);

  // Dopa Cena editing-mode hook: tells the preview to tighten subsection-title
  // spacing while a field in that panel has focus (template.html's `is-editing`
  // class). validate.js always ignores this and measures the print spacing.
  function handleDopaFocus() {
    iframeRef.current?.contentWindow?.postMessage({ type: 'SIENA_DRINKSDESSERT_EDITING', editing: true }, '*');
  }
  function handleDopaBlur() {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (dopaCenaRef.current && active && dopaCenaRef.current.contains(active)) return; // focus moved within the panel
      iframeRef.current?.contentWindow?.postMessage({ type: 'SIENA_DRINKSDESSERT_EDITING', editing: false }, '*');
    });
  }

  useEffect(() => {
    fetch('/api/drinksdessert/draft')
      .then(r => r.json())
      .then(data => { setMenu(data); prevJsonRef.current = JSON.stringify(data); })
      .catch(() => setSaveStatus('error'));
  }, []);

  const debouncedMenu = useDebounce(menu, 500);

  const saveToServer = useCallback(async (data: DrinksDessertMenuData) => {
    const json = JSON.stringify(data);
    if (json === prevJsonRef.current) return;
    prevJsonRef.current = json;
    setSaveStatus('saving'); setSaveMsg('Saving…');
    try {
      const res = await fetch('/api/drinksdessert/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.issues ? body.issues.map((i: { message: string }) => i.message).join('; ') : (body.error || 'Save failed');
        setSaveStatus('error'); setSaveMsg(msg); return;
      }
      setSaveStatus('saved'); setSaveMsg('Draft saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch { setSaveStatus('error'); setSaveMsg('Network error'); }
  }, []);

  // Validation result → per-card status + gate the pending save.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || e.data.type !== 'SIENA_DRINKSDESSERT_VALIDATE_RESULT') return;
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
      { type: 'SIENA_DRINKSDESSERT_UPDATE', payload: debouncedMenu }, '*'
    );
  }, [debouncedMenu]);

  // ── Publish / discard ────────────────────────────────────────────────────

  async function handlePublish() {
    if (!menu) return;
    if (report && !report.fits) { alert('Some cards are too long to fit. Fix those before publishing.'); return; }
    if (!confirm('Make this draft the current menu?\n\nThe menu people are printing now will be moved to "Past Menus," and this draft becomes the current menu dated today.')) return;
    setPublishing(true); setSaveMsg('Publishing…');
    try {
      await fetch('/api/drinksdessert/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menu) });
      const res = await fetch('/api/drinksdessert/publish', { method: 'POST' });
      if (!res.ok) { setPublishing(false); setSaveStatus('error'); setSaveMsg('Publish failed — try again'); return; }
      window.location.href = '/drinksdessert';
    } catch { setPublishing(false); setSaveStatus('error'); setSaveMsg('Network error while publishing'); }
  }

  async function handleDiscard() {
    if (!confirm('Discard this draft?\n\nAll changes since the current menu will be lost. The current menu is not affected.')) return;
    try { await fetch('/api/drinksdessert/draft', { method: 'DELETE' }); }
    finally { window.location.href = '/drinksdessert'; }
  }

  function printSheets(scope: 'both' | 'a' | 'b') {
    if (!menu) return;
    localStorage.setItem('siena-drinksdessert-print-data', JSON.stringify(menu));
    localStorage.setItem('siena-drinksdessert-print-scope', scope);
    window.open('/drinksdessert-print?src=draft', '_blank');
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  function setCocktails(items: Item[]) { setMenu(m => m && { ...m, cocktails: items }); }
  function setDolci(items: Item[]) { setMenu(m => m && { ...m, dolci: items }); }
  function setSpirits(key: SpiritKey, items: Item[]) { setMenu(m => m && { ...m, spirits: { ...m.spirits, [key]: items } }); }
  function setDopa(key: DopaKey, items: Item[]) { setMenu(m => m && { ...m, dopaCena: { ...m.dopaCena, [key]: items } }); }

  // Drag reorder within a single list (blocked across lists).
  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.droppableId !== destination.droppableId) return;
    const listId = source.droppableId;

    function reorder(items: Item[]): Item[] {
      const next = Array.from(items);
      const [moved] = next.splice(source.index, 1);
      next.splice(destination!.index, 0, moved);
      return next;
    }

    if (listId === 'cocktails') setCocktails(reorder(menu!.cocktails));
    else if (listId === 'dolci') setDolci(reorder(menu!.dolci));
    else {
      const sp = SPIRIT_SUBS.find(s => s.listId === listId);
      if (sp) { setSpirits(sp.key, reorder(menu!.spirits[sp.key])); return; }
      const dc = DOPA_SUBS.find(s => s.listId === listId);
      if (dc) setDopa(dc.key, reorder(menu!.dopaCena[dc.key]));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!menu) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading draft…</div>;
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
            <Link href="/drinksdessert" className="btn-back">← Back</Link>
            <h1>Editing a Draft</h1>
            <Link href="/" className="btn-home">🏠 Home</Link>
          </div>

          <div className="draft-banner">
            ✎ You&rsquo;re editing a <strong>draft</strong>. The current menu stays locked until you press <strong>Make This the Current Menu</strong>. Every card must fit before you can publish or print.
          </div>

          <div className="editor-scroll chef-mode">
            <div className="weekend-instructions" style={{ margin: '12px 0 8px' }}>
              <p>Four cards, printed on <strong>two sheets</strong> (A: Cocktails + Spirits & Beer · B: Dopa Cena + Dolci). Add or remove items freely — a card will tell you if it runs out of room.</p>
            </div>

            {/* Cocktails */}
            <div className="page-group">
              <div className="page-group-label">Sheet A · Left card</div>
              <CardPanel title="Signature Cocktails" pageId="cocktails" report={report} defaultOpen>
                <EditableList
                  listId="cocktails" items={menu.cocktails} descMode="required" note
                  addLabel="+ Add cocktail" namePlaceholder="e.g. Negroni Sbagliato"
                  onItemsChange={setCocktails}
                />
              </CardPanel>
            </div>

            {/* Spirits */}
            <div className="page-group">
              <div className="page-group-label">Sheet A · Right card</div>
              <CardPanel title="Spirits & Beer" pageId="spirits" report={report}>
                {SPIRIT_SUBS.map(sub => (
                  <div key={sub.key} className="dd-subsection">
                    <div className="dd-subsection-title">{sub.title}</div>
                    <EditableList
                      listId={sub.listId} items={menu.spirits[sub.key]} descMode="none" note={false}
                      addLabel="+ Add" namePlaceholder="e.g. Maker's Mark"
                      onItemsChange={items => setSpirits(sub.key, items)}
                    />
                  </div>
                ))}
              </CardPanel>
            </div>

            {/* Dopa Cena */}
            <div className="page-group">
              <div className="page-group-label">Sheet B · Left card</div>
              <CardPanel title="Siena Dopa Cena" pageId="dopacena" report={report}>
                {/* While a field in this panel has focus, the preview switches to a
                    tighter "is-editing" spacing on the subsection titles so the card
                    doesn't jump around while typing. The printed/validated layout
                    always uses the spread-out spacing — see template.html. */}
                <div ref={dopaCenaRef} onFocus={handleDopaFocus} onBlur={handleDopaBlur}>
                  {DOPA_SUBS.map(sub => (
                    <div key={sub.key} className="dd-subsection">
                      <div className="dd-subsection-title">{sub.title}</div>
                      <EditableList
                        listId={sub.listId} items={menu.dopaCena[sub.key]} descMode="optional" note={false}
                        addLabel="+ Add" namePlaceholder="e.g. Amaro Nonino"
                        onItemsChange={items => setDopa(sub.key, items)}
                      />
                    </div>
                  ))}
                </div>
              </CardPanel>
            </div>

            {/* Dolci */}
            <div className="page-group">
              <div className="page-group-label">Sheet B · Right card</div>
              <CardPanel title="Dolci" pageId="dolci" report={report}>
                <EditableList
                  listId="dolci" items={menu.dolci} descMode="required" note={false}
                  addLabel="+ Add dessert" namePlaceholder="e.g. Tiramisu"
                  onItemsChange={setDolci}
                />
              </CardPanel>
            </div>
          </div>{/* end editor-scroll */}

          {/* Publish bar */}
          <div className="editor-footer editor-footer--publish">
            <button className="btn-discard-draft" onClick={handleDiscard} disabled={publishing}>Discard Draft</button>
            <span className="publish-hint">
              {anyOverflow ? '⚠ A card is too long — fix it before publishing.' : 'Current menu is unchanged until you publish.'}
            </span>
            <button className="btn-publish" onClick={handlePublish} disabled={publishing || anyOverflow}>
              {publishing ? 'Publishing…' : 'Make This the Current Menu'}
            </button>
          </div>

          {/* Save status + print control */}
          <div className="editor-footer">
            <span className={saveStatusClass} style={{ flex: 1 }}>
              {saveStatus === 'error' ? `⚠ ${saveMsg}` : (saveMsg || 'Auto-saves as you type')}
            </span>
            <span className="dd-print-label">Print:</span>
            <button className="btn-print" disabled={anyOverflow} title={anyOverflow ? 'Fix overflow first' : 'Print both sheets'} onClick={() => printSheets('both')}>Both</button>
            <button className="btn-print btn-print--ghost" disabled={anyOverflow} title="Cocktails + Spirits & Beer" onClick={() => printSheets('a')}>Sheet A</button>
            <button className="btn-print btn-print--ghost" disabled={anyOverflow} title="Dopa Cena + Dolci" onClick={() => printSheets('b')}>Sheet B</button>
          </div>
        </div>

        {/* ── Preview pane ────────────────────────────────────────── */}
        <div className="preview-pane">
          <div className="preview-toolbar">
            <span>Live preview — 4 cards / 2 sheets</span>
            <button
              className="btn-ghost"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setPreviewUrl('/drinksdessert-preview?src=draft&' + Date.now())}
            >
              ↺ Reload from server
            </button>
          </div>
          <iframe ref={iframeRef} src={previewUrl} className="preview-iframe" title="Drinks & Dessert preview" />
        </div>
      </div>
    </DragDropContext>
  );
}
