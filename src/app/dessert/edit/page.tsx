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

interface DessertItem {
  id: string;
  name: string;
  desc: string;
  price: string;   // stored WITHOUT the $ glyph, e.g. "11.00"
}

interface DessertMenuData {
  desserts: DessertItem[];
}

// validate.js report shape — one entry, always id "dessert"
interface PageReport { id: string; fits: boolean; shrunk: boolean; overflowPx: number; worstList: string | null; }
interface ValidateReport { fits: boolean; pages: PageReport[]; error?: string; }

// ── Helpers ───────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return d;
}

function newId(): string {
  return 'ds-' + Math.random().toString(36).slice(2, 7);
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

// ── Editable dessert list — every field required, no optional note/desc ───

function DessertItemRow({
  item, index, onChange, onRemove,
}: {
  item: DessertItem;
  index: number;
  onChange: (updated: DessertItem) => void;
  onRemove: () => void;
}) {
  function set<K extends keyof DessertItem>(k: K, v: DessertItem[K]) { onChange({ ...item, [k]: v }); }

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

function DessertEditableList({
  items, onItemsChange,
}: {
  items: DessertItem[];
  onItemsChange: (items: DessertItem[]) => void;
}) {
  function updateAt(i: number, updated: DessertItem) {
    const next = [...items]; next[i] = updated; onItemsChange(next);
  }
  function removeAt(i: number) { onItemsChange(items.filter((_, idx) => idx !== i)); }
  function add() { onItemsChange([...items, { id: newId(), name: '', desc: '', price: '' }]); }

  return (
    <div>
      <Droppable droppableId="desserts" type="ds-item">
        {(prov) => (
          <div ref={prov.innerRef} {...prov.droppableProps} className="dish-list">
            {items.map((it, i) => (
              <DessertItemRow key={it.id} item={it} index={i} onChange={u => updateAt(i, u)} onRemove={() => removeAt(i)} />
            ))}
            {prov.placeholder}
          </div>
        )}
      </Droppable>
      <button className="btn-add-dish" onClick={add}>+ Add dessert</button>
    </div>
  );
}

// ── Collapsible card panel ────────────────────────────────────────────────

function CardPanel({
  title, report, children,
}: {
  title: string; report: ValidateReport | null; children: React.ReactNode;
}) {
  const pr = report?.pages.find(p => p.id === 'dessert');
  let status: React.ReactNode = null;
  if (pr) {
    if (!pr.fits) status = <span className="dd-chip dd-chip--bad">⚠ too long</span>;
    else if (pr.shrunk) status = <span className="dd-chip dd-chip--warn">✓ fits (reduced type)</span>;
    else status = <span className="dd-chip dd-chip--ok">✓ fits</span>;
  }
  return (
    <div className="section-block section-block--dessert">
      <div className="section-block-header section-block-header--dessert">
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
  // "Fix a Mistake" (/dessert/fix) reuses this exact editor — same fields,
  // same validation, same live preview — but reads/writes the LIVE menu
  // directly instead of a draft, and hides the publish/discard footer.
  const pathname = usePathname();
  const isFix = pathname?.endsWith('/fix') ?? false;
  const apiPath = isFix ? '/api/dessert/fix' : '/api/dessert/draft';
  const landingHref = '/dessert';

  const [menu, setMenu] = useState<DessertMenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [report, setReport] = useState<ValidateReport | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(`/dessert-preview?src=${isFix ? 'current' : 'draft'}`);
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
      setSaveStatus('saved'); setSaveMsg(isFix ? 'Saved' : 'Draft saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch { setSaveStatus('error'); setSaveMsg('Network error'); }
  }, [apiPath, isFix]);

  // Validation result → status chip + gate the pending save.
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
        setSaveStatus('error');
        setSaveMsg('Dolci is too long — remove an item or shorten a description.');
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

  // ── Publish / discard ────────────────────────────────────────────────────

  async function handlePublish() {
    if (!menu) return;
    if (report && !report.fits) { alert('Dolci is too long to fit. Fix that before publishing.'); return; }
    if (!confirm('Make this draft the current menu?\n\nThe menu people are printing now will be moved to "Past Menus," and this draft becomes the current menu dated today.')) return;
    setPublishing(true); setSaveMsg('Publishing…');
    try {
      await fetch('/api/dessert/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menu) });
      const res = await fetch('/api/dessert/publish', { method: 'POST' });
      if (!res.ok) { setPublishing(false); setSaveStatus('error'); setSaveMsg('Publish failed — try again'); return; }
      window.location.href = landingHref;
    } catch { setPublishing(false); setSaveStatus('error'); setSaveMsg('Network error while publishing'); }
  }

  async function handleDiscard() {
    if (!confirm('Discard this draft?\n\nAll changes since the current menu will be lost. The current menu is not affected.')) return;
    try { await fetch('/api/dessert/draft', { method: 'DELETE' }); }
    finally { window.location.href = landingHref; }
  }

  function handlePrint() {
    if (!menu) return;
    localStorage.setItem('siena-dessert-print-data', JSON.stringify(menu));
    window.open(`/dessert-print?src=${isFix ? 'current' : 'draft'}`, '_blank');
  }

  function setDesserts(items: DessertItem[]) { setMenu(m => m && { ...m, desserts: items }); }

  // Drag reorder within the single list.
  function handleDragEnd(result: DropResult) {
    if (!result.destination || !menu) return;
    const { source, destination } = result;
    const next = Array.from(menu.desserts);
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);
    setDesserts(next);
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
            <h1>{isFix ? 'Fixing the Live Menu' : 'Editing a Draft'}</h1>
            <Link href="/" className="btn-home">🏠 Home</Link>
          </div>

          {isFix ? (
            <div className="draft-banner fix-banner">
              ✏️ You&rsquo;re editing the <strong>live menu</strong>. Every change saves right away — there&rsquo;s no draft and no publish step. The card must still fit before you can print.
            </div>
          ) : (
            <div className="draft-banner">
              ✎ You&rsquo;re editing a <strong>draft</strong>. The current menu stays locked until you press <strong>Make This the Current Menu</strong>. The card must fit before you can publish or print.
            </div>
          )}

          <div className="editor-scroll chef-mode">
            <div className="weekend-instructions" style={{ margin: '12px 0 8px' }}>
              <p>One card, printed <strong>two-up on one sheet</strong> (two identical copies, cut down the middle). Add or remove items freely — the card will tell you if it runs out of room.</p>
            </div>

            <div className="page-group">
              <CardPanel title="Dolci" report={report}>
                <DessertEditableList items={menu.desserts} onItemsChange={setDesserts} />
              </CardPanel>
            </div>
          </div>{/* end editor-scroll */}

          {/* Publish bar */}
          {!isFix && (
            <div className="editor-footer editor-footer--publish">
              <button className="btn-discard-draft" onClick={handleDiscard} disabled={publishing}>Discard Draft</button>
              <span className="publish-hint">
                {anyOverflow ? '⚠ Dolci is too long — fix it before publishing.' : 'Current menu is unchanged until you publish.'}
              </span>
              <button className="btn-publish" onClick={handlePublish} disabled={publishing || anyOverflow}>
                {publishing ? 'Publishing…' : 'Make This the Current Menu'}
              </button>
            </div>
          )}

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
            <span>Live preview — 1 card, 2 identical copies</span>
            <button
              className="btn-ghost"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setPreviewUrl(`/dessert-preview?src=${isFix ? 'current' : 'draft'}&` + Date.now())}
            >
              ↺ Reload from server
            </button>
          </div>
          <iframe ref={iframeRef} src={previewUrl} className="preview-iframe" title="Desserts preview" />
        </div>
      </div>
    </DragDropContext>
  );
}
