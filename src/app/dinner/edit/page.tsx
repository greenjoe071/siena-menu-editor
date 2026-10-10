'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmPrintWarnings } from '@/lib/print-warnings';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';

// ── Types (mirrors schema.ts without Zod runtime in client) ──────────────

interface Dish {
  id: string;
  enabled?: boolean;   // hide/show switch (absent = shown) — Oct 2026
  name: string;
  desc: string;
  raw?: boolean;
  price_format?: 'single' | 'dual';
  price?: string;
  price_a_label?: string;
  price_a?: string;
  price_b_label?: string;
  price_b?: string;
  // Legacy dual-price fields (backward compat with existing Blobs data)
  bowl_price?: string;
  cup_price?: string;
}

interface Section {
  title: string;
  items: Dish[];
}

interface AddonItem {
  id: string;
  name: string;
  price: string;
  enabled: boolean;
}

interface AddonBlock {
  enabled: boolean;
  label: string;
  items: AddonItem[];
  tail?: string;
}

interface MenuData {
  header: { restaurant_name: string; sub_page_1: string; sub_other_pages: string };
  about_blurb: string;
  bread_note: { title: string; body: string };
  raw_warning_main: string;
  raw_warning_qualifier: string;
  policy_line: string;
  column_order?: boolean;   // dishes read down the left column, then the right
  salad_addons: AddonBlock;
  pasta_addons: AddonBlock;
  steak_addons: AddonBlock;
  sections: {
    antipasti: Section;
    'zuppa-insalate': Section;
    pasta: Section;
    contorni: Section;
    secondi: Section;
    'non-alcoholic': Section;
  };
}

type SectionId = keyof MenuData['sections'];

// ── Page groupings (matches template layout) ─────────────────────────────

const PAGE_GROUPS: { label: string; sections: SectionId[]; addonKey?: keyof Pick<MenuData, 'salad_addons' | 'pasta_addons' | 'steak_addons'>; addonAfter?: SectionId }[] = [
  { label: 'Page 1', sections: ['antipasti', 'zuppa-insalate'], addonKey: 'salad_addons', addonAfter: 'zuppa-insalate' },
  { label: 'Page 2', sections: ['pasta', 'contorni'], addonKey: 'pasta_addons', addonAfter: 'pasta' },
  { label: 'Page 3', sections: ['secondi', 'non-alcoholic'], addonKey: 'steak_addons', addonAfter: 'secondi' },
];

const SECTION_LABELS: Record<SectionId, string> = {
  antipasti: 'Antipasti',
  'zuppa-insalate': 'Zuppa e Insalate',
  pasta: 'Pasta',
  contorni: 'Contorni',
  secondi: 'Secondi Piatti',
  'non-alcoholic': 'Non-Alcoholic Beverages',
};

const ADDON_LABELS: Record<string, string> = {
  salad_addons: 'Salad Add-ons',
  pasta_addons: 'Pasta Add-ons',
  steak_addons: 'Steak Add-ons',
};

// ── Small helpers ─────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// Fit report posted back by the preview iframe (handoff/validate.js).
interface FitReport {
  fits: boolean;
  problems: { type: string; message: string }[];
}

const PASTA_MAX_VISIBLE = 8;

const isShown = (d: Dish) => d.enabled !== false;

function hex4() {
  return Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
}

/** Fresh opaque id like "d-3f2a" that isn't already used. */
function freshId(prefix: string, taken: Set<string>) {
  let id = '';
  do { id = `${prefix}-${hex4()}`; } while (taken.has(id));
  return id;
}

const ADDON_ID_PREFIX: Record<string, string> = {
  salad_addons: 'sa',
  pasta_addons: 'a',
  steak_addons: 'ta',
};

// ── Add-on block editor ───────────────────────────────────────────────────

// Oct 2026: salad, pasta and steak lines all work the same — editable names
// and prices, add / remove / reorder, per-item and whole-line show/hide.
// The one-line rule is checked by the preview's fit validator, not by
// counting characters.
function AddonBlockEditor({
  blockKey,
  block,
  wraps,
  onChange,
}: {
  blockKey: string;
  block: AddonBlock;
  wraps: boolean;
  onChange: (updated: AddonBlock) => void;
}) {
  const [open, setOpen] = useState(false);

  function setItem(index: number, updated: AddonItem) {
    const items = [...block.items];
    items[index] = updated;
    onChange({ ...block, items });
  }

  function addItem() {
    const taken = new Set(block.items.map((it) => it.id));
    const newItem: AddonItem = { id: freshId(ADDON_ID_PREFIX[blockKey] ?? 'a', taken), name: '', price: '', enabled: true };
    onChange({ ...block, items: [...block.items, newItem] });
  }

  function moveItem(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= block.items.length) return;
    const items = [...block.items];
    [items[index], items[j]] = [items[j], items[index]];
    onChange({ ...block, items });
  }

  function removeItem(index: number) {
    const items = block.items.filter((_, i) => i !== index);
    onChange({ ...block, items });
  }

  return (
    <div className="section-block addon-block">
      <div className="section-block-header" onClick={() => setOpen((o) => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">{ADDON_LABELS[blockKey]}</span>
        {wraps && <span className="dd-chip dd-chip--bad" style={{ marginLeft: '6px' }}>too long for one line</span>}
        <label className="addon-block-toggle" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={block.enabled}
            onChange={(e) => onChange({ ...block, enabled: e.target.checked })}
          />
          {block.enabled ? 'Showing' : 'Hidden'}
        </label>
      </div>

      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body addon-body">
          <div className="field-group">
            <label>Label (gold eyebrow text)</label>
            <input
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              placeholder="e.g. Add to any Salad"
            />
          </div>

          {wraps && (
            <div className="field-warn">
              This line no longer fits on one printed line. Shorten a name, or hide or remove an item.
            </div>
          )}

          <div className="addon-items-list">
            {block.items.map((item, i) => (
              <div key={item.id} className="addon-item-row">
                <span className="addon-move">
                  <button type="button" className="btn-move-addon" onClick={() => moveItem(i, -1)} disabled={i === 0} title="Move left on the printed line">▲</button>
                  <button type="button" className="btn-move-addon" onClick={() => moveItem(i, 1)} disabled={i === block.items.length - 1} title="Move right on the printed line">▼</button>
                </span>
                <input
                  className="addon-name-input"
                  value={item.name}
                  onChange={(e) => setItem(i, { ...item, name: e.target.value })}
                  placeholder="Item name"
                />
                <div className="addon-price-group">
                  <span className="addon-price-dollar">$</span>
                  <input
                    className="addon-price-input"
                    value={item.price}
                    onChange={(e) => setItem(i, { ...item, price: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <label className="addon-item-toggle" title="Show/hide this item on the printed menu">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => setItem(i, { ...item, enabled: e.target.checked })}
                  />
                  On
                </label>
                <button
                  className="btn-remove-addon"
                  onClick={() => removeItem(i)}
                  title="Remove this item"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button className="btn-add-addon" onClick={addItem}>+ Add item</button>

          {blockKey === 'pasta_addons' && (
            <div className="field-group" style={{ marginTop: '10px' }}>
              <label>Tail line (optional — leave blank to hide)</label>
              <input
                value={block.tail ?? ''}
                onChange={(e) => onChange({ ...block, tail: e.target.value })}
                placeholder="e.g. — or ask your server for other options."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dish field component ──────────────────────────────────────────────────

function DishRow({
  dish,
  index,
  sectionId,
  onChange,
}: {
  dish: Dish;
  index: number;
  sectionId: SectionId;
  onChange: (sectionId: SectionId, index: number, updated: Dish) => void;
}) {
  const isDual = dish.price_format === 'dual';
  const descLen = dish.desc.length;

  function set(field: keyof Dish, value: string | boolean) {
    onChange(sectionId, index, { ...dish, [field]: value });
  }

  if (!isShown(dish)) {
    // Hidden dish: a slim red strip (Joe, Oct 10 2026 — option B). Still
    // draggable so it keeps its place; "Show on menu" brings the row back.
    return (
      <Draggable draggableId={dish.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className="dish-hidden-strip"
            style={{
              ...provided.draggableProps.style,
              boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : undefined,
            }}
          >
            <span className="drag-handle" {...provided.dragHandleProps} title="Drag to reorder">⠿</span>
            <span className="dish-hidden-eye" aria-hidden="true">🚫</span>
            <span className="dish-hidden-text">
              <strong>{dish.name || '(unnamed dish)'}</strong> is hidden from the printed menu
            </span>
            <button
              type="button"
              className="btn-show-dish"
              onClick={() => onChange(sectionId, index, { ...dish, enabled: true })}
            >
              Show on menu
            </button>
          </div>
        )}
      </Draggable>
    );
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
            <span className="drag-handle" {...provided.dragHandleProps} title="Drag to reorder">
              ⠿
            </span>
            <span className="dish-name-preview">{dish.name || '(unnamed)'}</span>
            <button
              type="button"
              className="btn-hide-dish"
              title="Take this dish off the printed menu (it stays saved, and you can show it again any time)"
              onClick={() => onChange(sectionId, index, { ...dish, enabled: false })}
            >
              Hide
            </button>
            <label className="raw-toggle" title="Add raw-food warning asterisk">
              <input
                type="checkbox"
                checked={!!dish.raw}
                onChange={(e) => set('raw', e.target.checked)}
              />
              raw *
            </label>
          </div>

          <div className="dish-fields">
            <div className="field-group">
              <label>Name</label>
              <input
                value={dish.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Dish name"
              />
            </div>

            <div className="field-group">
              <label>Description</label>
              <textarea
                rows={2}
                value={dish.desc}
                onChange={(e) => set('desc', e.target.value)}
                placeholder="Description"
              />
              {descLen > 120 && (
                <div className="field-warn">
                  Long description ({descLen} chars) — may push column heights
                </div>
              )}
            </div>

            {isDual ? (
              <div className="dish-field-row">
                <div className="field-group price-field">
                  <label>{dish.price_a_label ?? (dish.bowl_price !== undefined ? 'Bowl' : 'A')} $</label>
                  <input
                    value={dish.price_a ?? dish.bowl_price ?? ''}
                    onChange={(e) => set('price_a', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="field-group price-field">
                  <label>{dish.price_b_label ?? (dish.cup_price !== undefined ? 'Cup' : 'B')} $</label>
                  <input
                    value={dish.price_b ?? dish.cup_price ?? ''}
                    onChange={(e) => set('price_b', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            ) : (
              <div className="field-group price-field">
                <label>Price $</label>
                <input
                  value={dish.price ?? ''}
                  onChange={(e) => set('price', e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ── Section block component ───────────────────────────────────────────────

function SectionBlock({
  sectionId,
  section,
  defaultOpen,
  onChange,
  onDishChange,
  onAddDish,
}: {
  sectionId: SectionId;
  section: Section;
  defaultOpen: boolean;
  onChange: (sectionId: SectionId, updated: Section) => void;
  onDishChange: (sectionId: SectionId, index: number, updated: Dish) => void;
  onAddDish?: () => void;   // Pasta only (Oct 2026)
}) {
  const [open, setOpen] = useState(defaultOpen);
  const titleLen = section.title.length;
  const shown = section.items.filter(isShown).length;
  const hidden = section.items.length - shown;

  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => setOpen((o) => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">{section.title}</span>
        <span className="section-count">{shown} dishes{hidden ? ` · ${hidden} hidden` : ''}</span>
      </div>

      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body">
          <div className="section-title-field field-group">
            <label>Section title</label>
            <input
              value={section.title}
              onChange={(e) => onChange(sectionId, { ...section, title: e.target.value })}
              maxLength={40}
            />
            {titleLen > 22 && (
              <div className="field-warn">
                Long title ({titleLen} chars) — may crowd the gold rule
              </div>
            )}
          </div>

          <div className="field-hint" style={{ fontSize: '12px', opacity: 0.7, margin: '2px 0 8px' }}>
            Order on the menu: down the left column, then down the right column.
          </div>

          <Droppable droppableId={sectionId} type="dish">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="dish-list"
              >
                {section.items.map((dish, i) => (
                  <DishRow
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

          {onAddDish && (
            <div style={{ marginTop: '10px' }}>
              <button className="btn-add-dish" onClick={onAddDish} disabled={shown >= PASTA_MAX_VISIBLE}>+ Add a pasta dish</button>
              <div className="field-hint" style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                {shown >= PASTA_MAX_VISIBLE
                  ? `Pasta is full (${PASTA_MAX_VISIBLE} dishes showing). Hide one to add another.`
                  : `Pasta can show up to ${PASTA_MAX_VISIBLE} dishes. Other sections can hide dishes but not add them.`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main editor (works on the DRAFT — the current menu stays protected) ────

export default function DinnerDraftEditorPage() {
  // "Fix a Mistake" (/dinner/fix) reuses this exact editor — same fields,
  // same validation, same live preview — but reads/writes the LIVE menu
  // directly instead of a draft, and hides the publish/discard footer.
  const pathname = usePathname();
  const isFix = pathname?.endsWith('/fix') ?? false;
  const apiPath = isFix ? '/api/dinner/fix' : '/api/dinner/draft';

  const [menu, setMenu] = useState<MenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(`/preview?src=${isFix ? 'current' : 'draft'}`);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevJsonRef = useRef<string>('');
  // Fit check from the preview (validate.js). Joe, Oct 2026: typing ALWAYS
  // saves; a menu that doesn't fit only blocks "Make This the Active Menu".
  const [fit, setFit] = useState<FitReport | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'SIENA_MENU_VALIDATE_RESULT') setFit(e.data.report as FitReport);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    fetch(apiPath)
      .then((r) => r.json())
      .then((data) => {
        setMenu(data);
        prevJsonRef.current = JSON.stringify(data);
      })
      .catch(() => setSaveStatus('error'));
  }, [apiPath]);

  const debouncedMenu = useDebounce(menu, 800);

  const saveAndRefresh = useCallback(async (data: MenuData) => {
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
      setSaveMsg(isFix ? 'Saved' : 'Draft saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setSaveMsg('Network error');
    }
  }, [apiPath, isFix]);

  useEffect(() => {
    if (debouncedMenu && prevJsonRef.current !== '') {
      if (JSON.stringify(debouncedMenu) !== prevJsonRef.current) {
        setFit(null);
        iframeRef.current?.contentWindow?.postMessage({ type: 'SIENA_MENU_UPDATE', payload: debouncedMenu }, '*');
      }
      saveAndRefresh(debouncedMenu);
    }
  }, [debouncedMenu, saveAndRefresh]);

  // ── Publish / discard ──────────────────────────────────────────────────

  function publishBlockers(m: MenuData): string[] {
    const out: string[] = [];
    for (const sid of Object.keys(m.sections) as SectionId[]) {
      m.sections[sid].items.forEach((d, n) => {
        if (!isShown(d)) return;
        const where = `${SECTION_LABELS[sid]} dish ${n + 1}${d.name.trim() ? ` (${d.name.trim()})` : ''}`;
        const prices = d.price_format === 'dual'
          ? [d.price_a ?? d.bowl_price, d.price_b ?? d.cup_price]
          : [d.price];
        const blanks = [!d.name.trim() && 'name', !d.desc.trim() && 'description',
          prices.some((p) => !p || !p.trim()) && 'price'].filter(Boolean);
        if (blanks.length) out.push(`${where}: ${blanks.join(', ')}`);
      });
    }
    const pastaShown = m.sections.pasta.items.filter(isShown).length;
    if (pastaShown > PASTA_MAX_VISIBLE) out.push(`Pasta has ${pastaShown} dishes showing — hide ${pastaShown - PASTA_MAX_VISIBLE}`);
    for (const key of ['salad_addons', 'pasta_addons', 'steak_addons'] as const) {
      const b = m[key];
      if (!b.enabled) continue;
      b.items.forEach((it, n) => {
        if (it.enabled && (!it.name.trim() || !it.price.trim())) out.push(`${ADDON_LABELS[key]} item ${n + 1}: name or price`);
      });
    }
    return out;
  }

  async function handlePublish() {
    if (!menu) return;
    const blanks = publishBlockers(menu);
    if (blanks.length) {
      setSaveStatus('error');
      setSaveMsg('Before making this the active menu, fill in: ' + blanks.join('; ') + ' — or hide what you are not using.');
      return;
    }
    if (!fit || !fit.fits) {
      setSaveStatus('error');
      setSaveMsg(fit ? 'This menu doesn\u2019t fit the page yet — see the red note at the top. Your draft is saved.' : 'Still checking the page fit — try again in a second.');
      return;
    }

    setPublishing(true);
    setSaveMsg('Publishing…');
    try {
      // Flush the latest edits to the draft first, then publish.
      await fetch('/api/dinner/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menu),
      });
      const res = await fetch('/api/dinner/publish', { method: 'POST' });
      if (!res.ok) {
        setPublishing(false);
        setSaveStatus('error');
        setSaveMsg('Publish failed — try again');
        return;
      }
      window.location.href = '/dinner';
    } catch {
      setPublishing(false);
      setSaveStatus('error');
      setSaveMsg('Network error while publishing');
    }
  }

  // ── Mutation helpers ───────────────────────────────────────────────────

  function setHeader(field: keyof MenuData['header'], value: string) {
    setMenu((m) => m && { ...m, header: { ...m.header, [field]: value } });
  }

  function setTopLevel(field: 'about_blurb' | 'raw_warning_main' | 'raw_warning_qualifier' | 'policy_line', value: string) {
    setMenu((m) => m && { ...m, [field]: value });
  }

  function setBreadNote(field: keyof MenuData['bread_note'], value: string) {
    setMenu((m) => m && { ...m, bread_note: { ...m.bread_note, [field]: value } });
  }

  function setAddonBlock(key: 'salad_addons' | 'pasta_addons' | 'steak_addons', updated: AddonBlock) {
    setMenu((m) => m && { ...m, [key]: updated });
  }

  function handleSectionChange(sectionId: SectionId, updated: Section) {
    setMenu((m) => m && { ...m, sections: { ...m.sections, [sectionId]: updated } });
  }

  function handleDishChange(sectionId: SectionId, index: number, updated: Dish) {
    setMenu((m) => {
      if (!m) return m;
      const items = [...m.sections[sectionId].items];
      items[index] = updated;
      return { ...m, sections: { ...m.sections, [sectionId]: { ...m.sections[sectionId], items } } };
    });
  }

  function handleAddPastaDish() {
    setMenu((m) => {
      if (!m) return m;
      const taken = new Set(Object.values(m.sections).flatMap((s) => s.items.map((d) => d.id)));
      const dish: Dish = { id: freshId('d', taken), enabled: true, name: '', desc: '', price_format: 'single', price: '' };
      const pasta = m.sections.pasta;
      return { ...m, sections: { ...m.sections, pasta: { ...pasta, items: [...pasta.items, dish] } } };
    });
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.source.droppableId !== result.destination.droppableId) return;
    const sectionId = result.source.droppableId as SectionId;
    setMenu((m) => {
      if (!m) return m;
      const items = Array.from(m.sections[sectionId].items);
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination!.index, 0, moved);
      return { ...m, sections: { ...m.sections, [sectionId]: { ...m.sections[sectionId], items } } };
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (!menu) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading draft…
      </div>
    );
  }

  const saveStatusClass =
    saveStatus === 'saved' ? 'save-status saved'
    : saveStatus === 'saving' ? 'save-status saving'
    : saveStatus === 'error' ? 'save-status error'
    : 'save-status';

  const addonWraps = (key: string) =>
    !!fit?.problems.some((p) => p.type === 'addon-wrap' && `${(p as { block?: string }).block}_addons` === key);

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="app">
        {/* ── Editor pane ─────────────────────────────────────────── */}
        <div className="editor-pane">
          <div className="editor-header">
            <Link href="/dinner" className="btn-back">← Dinner Menu</Link>
            <h1>{isFix ? 'Fixing the Live Menu' : 'Editing a Draft'}</h1>
            <Link href="/" className="btn-home">🏠 Home</Link>
          </div>

          {isFix && (
            <div className="draft-banner fix-banner">
              ✏️ You&rsquo;re editing the <strong>active menu</strong>. Every change saves right away — there&rsquo;s no draft and no publish step.
            </div>
          )}

          {fit && !fit.fits && (
            <div className="overflow-banner">
              ⚠ {isFix
                ? 'This menu no longer fits the printed page — your changes ARE saved, but shorten or hide something before printing.'
                : 'This menu doesn\u2019t fit the printed page yet — your draft IS saved, but it can\u2019t become the active menu until it fits.'}
              <ul style={{ margin: '6px 0 0 18px' }}>
                {fit.problems.map((p, i) => <li key={i}>{p.message}</li>)}
              </ul>
            </div>
          )}

          <div className="editor-scroll">
            {/* Restaurant header */}
            <div className="page-group">
              <div className="page-group-label">Restaurant header</div>
              <div className="field-group">
                <label>Restaurant name</label>
                <input value={menu.header.restaurant_name} onChange={(e) => setHeader('restaurant_name', e.target.value)} />
              </div>
              <div className="field-group">
                <label>Page 1 sub-header</label>
                <input value={menu.header.sub_page_1} onChange={(e) => setHeader('sub_page_1', e.target.value)} />
              </div>
              <div className="field-group">
                <label>Season line (all other pages)</label>
                <input value={menu.header.sub_other_pages} onChange={(e) => setHeader('sub_other_pages', e.target.value)} />
              </div>
            </div>

            {/* About */}
            <div className="page-group">
              <div className="page-group-label">Page 1 — About blurb</div>
              <div className="field-group">
                <label>About blurb</label>
                <textarea rows={4} value={menu.about_blurb} onChange={(e) => setTopLevel('about_blurb', e.target.value)} />
              </div>
            </div>

            {/* Sections by page, with add-on blocks inserted after their section */}
            {PAGE_GROUPS.map((group) => {
              return (
                <div key={group.label} className="page-group">
                  <div className="page-group-label">
                    {group.label} — {group.sections.map((s) => SECTION_LABELS[s]).join(' · ')}
                  </div>
                  {group.sections.map((sid, i) => (
                    <div key={sid}>
                      <SectionBlock
                        sectionId={sid}
                        section={menu.sections[sid]}
                        defaultOpen={false}
                        onChange={handleSectionChange}
                        onDishChange={handleDishChange}
                        onAddDish={sid === 'pasta' ? handleAddPastaDish : undefined}
                      />
                      {group.addonKey && group.addonAfter === sid && (
                        <AddonBlockEditor
                          blockKey={group.addonKey}
                          block={menu[group.addonKey]}
                          wraps={addonWraps(group.addonKey)}
                          onChange={(updated) => setAddonBlock(group.addonKey!, updated)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Bread note */}
            <div className="page-group">
              <div className="page-group-label">Bread note (page 1 footer)</div>
              <div className="field-group">
                <label>Title</label>
                <input value={menu.bread_note.title} onChange={(e) => setBreadNote('title', e.target.value)} />
              </div>
              <div className="field-group">
                <label>Body</label>
                <textarea rows={4} value={menu.bread_note.body} onChange={(e) => setBreadNote('body', e.target.value)} />
              </div>
            </div>

            {/* Footer text */}
            <div className="page-group">
              <div className="page-group-label">Footer text</div>
              <div className="field-group">
                <label>Raw-food warning (main line)</label>
                <textarea rows={2} value={menu.raw_warning_main} onChange={(e) => setTopLevel('raw_warning_main', e.target.value)} />
              </div>
              <div className="field-group">
                <label>Raw-food warning (qualifier line)</label>
                <textarea rows={2} value={menu.raw_warning_qualifier} onChange={(e) => setTopLevel('raw_warning_qualifier', e.target.value)} />
              </div>
              <div className="field-group">
                <label>Policy line (HTML: &lt;strong&gt; allowed)</label>
                <textarea rows={2} value={menu.policy_line} onChange={(e) => setTopLevel('policy_line', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="editor-footer editor-footer--draft">
            <span className={saveStatusClass} style={{ flex: 1, marginLeft: '8px' }}>{saveMsg || 'Auto-saves as you type'}</span>
            <button
              className="btn-print"
              onClick={() => {
                if (menu && !confirmPrintWarnings('dinner', menu, saveStatus === 'error')) return;
                if (menu) localStorage.setItem('siena-print-data', JSON.stringify(menu));
                window.open(`/print?src=${isFix ? 'current' : 'draft'}&warned=1`, '_blank');
              }}
            >
              {isFix ? 'Print Menu' : 'Print Draft'}
            </button>
            {!isFix && (
              <button
                className="btn-publish"
                onClick={handlePublish}
                disabled={publishing || (!!fit && !fit.fits)}
                title={fit && !fit.fits ? 'The menu doesn\u2019t fit the page yet — see the red note at the top' : undefined}
              >
                {publishing ? 'Publishing…' : 'Make This the Active Menu'}
              </button>
            )}
          </div>
        </div>

        {/* ── Preview pane ────────────────────────────────────────── */}
        <div className="preview-pane">
          <div className="preview-toolbar">
            <span>{isFix ? 'Live preview' : 'Draft preview — all 3 pages'}</span>
            <button
              className="btn-ghost"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setPreviewUrl(`/preview?src=${isFix ? 'current' : 'draft'}&` + Date.now())}
            >
              ↺ Reload from server
            </button>
          </div>
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="preview-iframe"
            title="Draft menu preview"
          />
        </div>
      </div>
    </DragDropContext>
  );
}
