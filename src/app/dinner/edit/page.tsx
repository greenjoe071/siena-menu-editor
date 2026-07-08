'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';

// ── Types (mirrors schema.ts without Zod runtime in client) ──────────────

interface Dish {
  id: string;
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

// ── Add-on block editor ───────────────────────────────────────────────────

function AddonBlockEditor({
  blockKey,
  block,
  nameEditable,
  variableCardinality,
  onChange,
}: {
  blockKey: string;
  block: AddonBlock;
  nameEditable: boolean;
  variableCardinality: boolean;
  onChange: (updated: AddonBlock) => void;
}) {
  const [open, setOpen] = useState(false);

  function setItem(index: number, updated: AddonItem) {
    const items = [...block.items];
    items[index] = updated;
    onChange({ ...block, items });
  }

  function addItem() {
    const newItem: AddonItem = { id: `a-${Math.random().toString(36).slice(2, 6)}`, name: '', price: '', enabled: true };
    onChange({ ...block, items: [...block.items, newItem] });
  }

  function removeItem(index: number) {
    const items = block.items.filter((_, i) => i !== index);
    onChange({ ...block, items });
  }

  // Pasta single-line character count warning
  const pastaCharCount = blockKey === 'pasta_addons'
    ? block.items.filter(i => i.enabled).reduce((sum, i) => sum + i.name.length + i.price.length + 2, 0)
    : 0;

  return (
    <div className="section-block addon-block">
      <div className="section-block-header" onClick={() => setOpen((o) => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">{ADDON_LABELS[blockKey]}</span>
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

          {pastaCharCount > 70 && (
            <div className="field-warn">
              Total characters across enabled items ({pastaCharCount}) exceeds 70 — items may wrap to a second line on the printed menu.
            </div>
          )}

          <div className="addon-items-list">
            {block.items.map((item, i) => (
              <div key={item.id} className="addon-item-row">
                {nameEditable ? (
                  <input
                    className="addon-name-input"
                    value={item.name}
                    onChange={(e) => setItem(i, { ...item, name: e.target.value })}
                    placeholder="Item name"
                  />
                ) : (
                  <span className="addon-name-label">{item.name}</span>
                )}
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
                {variableCardinality && (
                  <button
                    className="btn-remove-addon"
                    onClick={() => removeItem(i)}
                    title="Remove this item"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {variableCardinality && (
            <button className="btn-add-addon" onClick={addItem}>+ Add item</button>
          )}

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
}: {
  sectionId: SectionId;
  section: Section;
  defaultOpen: boolean;
  onChange: (sectionId: SectionId, updated: Section) => void;
  onDishChange: (sectionId: SectionId, index: number, updated: Dish) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const titleLen = section.title.length;

  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => setOpen((o) => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">{section.title}</span>
        <span className="section-count">{section.items.length} dishes</span>
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
        </div>
      </div>
    </div>
  );
}

// ── Main editor (works on the DRAFT — the current menu stays protected) ────

export default function DinnerDraftEditorPage() {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('/preview?src=draft');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevJsonRef = useRef<string>('');

  useEffect(() => {
    fetch('/api/dinner/draft')
      .then((r) => r.json())
      .then((data) => {
        setMenu(data);
        prevJsonRef.current = JSON.stringify(data);
      })
      .catch(() => setSaveStatus('error'));
  }, []);

  const debouncedMenu = useDebounce(menu, 800);

  const saveAndRefresh = useCallback(async (data: MenuData) => {
    const json = JSON.stringify(data);
    if (json === prevJsonRef.current) return;
    prevJsonRef.current = json;

    setSaveStatus('saving');
    setSaveMsg('Saving…');
    try {
      const res = await fetch('/api/dinner/draft', {
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
      setSaveMsg('Draft saved');
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SIENA_MENU_UPDATE', payload: data }, '*'
      );
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setSaveMsg('Network error');
    }
  }, []);

  useEffect(() => {
    if (debouncedMenu && prevJsonRef.current !== '') {
      saveAndRefresh(debouncedMenu);
    }
  }, [debouncedMenu, saveAndRefresh]);

  // ── Publish / discard ──────────────────────────────────────────────────

  async function handlePublish() {
    if (!menu) return;
    if (!confirm(
      'Make this draft the current menu?\n\n' +
      'The menu people are printing now will be moved to "Past Menus," and this draft becomes the current menu dated today.'
    )) return;

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

  async function handleDiscard() {
    if (!confirm('Discard this draft?\n\nAll changes since the current menu will be lost. The current menu is not affected.')) return;
    try {
      await fetch('/api/dinner/draft', { method: 'DELETE' });
    } finally {
      window.location.href = '/dinner';
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

  const ADDON_CONFIG: { key: 'salad_addons' | 'pasta_addons' | 'steak_addons'; nameEditable: boolean; variableCardinality: boolean }[] = [
    { key: 'salad_addons', nameEditable: false, variableCardinality: false },
    { key: 'pasta_addons', nameEditable: true, variableCardinality: true },
    { key: 'steak_addons', nameEditable: false, variableCardinality: false },
  ];

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="app">
        {/* ── Editor pane ─────────────────────────────────────────── */}
        <div className="editor-pane">
          <div className="editor-header">
            <Link href="/dinner" className="btn-back">← Dinner Menu</Link>
            <h1>Editing a Draft</h1>
          </div>

          <div className="draft-banner">
            ✎ You&rsquo;re editing a <strong>draft</strong>. The current menu stays locked and unchanged until you press <strong>Make This the Current Menu</strong>.
          </div>

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
              const addonCfg = group.addonKey ? ADDON_CONFIG.find(c => c.key === group.addonKey) : undefined;
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
                        defaultOpen={i === 0 && group.label === 'Page 1'}
                        onChange={handleSectionChange}
                        onDishChange={handleDishChange}
                      />
                      {group.addonKey && group.addonAfter === sid && addonCfg && (
                        <AddonBlockEditor
                          blockKey={group.addonKey}
                          block={menu[group.addonKey]}
                          nameEditable={addonCfg.nameEditable}
                          variableCardinality={addonCfg.variableCardinality}
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
            <button className="btn-discard-draft" onClick={handleDiscard} disabled={publishing}>Discard Draft</button>
            <span className={saveStatusClass} style={{ flex: 1, marginLeft: '8px' }}>{saveMsg || 'Auto-saves as you type'}</span>
            <button
              className="btn-print"
              onClick={() => {
                if (menu) localStorage.setItem('siena-print-data', JSON.stringify(menu));
                window.open('/print?src=draft', '_blank');
              }}
            >
              Print Draft
            </button>
            <button className="btn-publish" onClick={handlePublish} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Make This the Current Menu'}
            </button>
          </div>
        </div>

        {/* ── Preview pane ────────────────────────────────────────── */}
        <div className="preview-pane">
          <div className="preview-toolbar">
            <span>Draft preview — all 3 pages</span>
            <button
              className="btn-ghost"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setPreviewUrl('/preview?src=draft&' + Date.now())}
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
