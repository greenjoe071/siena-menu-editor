'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Char limits (mirrors happyhour-schema.ts) ────────────────────────────
const L = {
  hhSpecialPrice:    4,
  hhSpecialLabel:   22,
  smallPlateName:   28,
  smallPlatePrice:   4,
  smallPlateDesc:   48,
  cocktailName:     24,
  cocktailHhPrice:   3,
  cocktailRegPrice:  3,
  cocktailDesc:     48,
  floaterText:      40,
  floaterPrice:      3,
  wineName:         18,
  wineGlassPrice:    3,
  wineBottlePrice:   3,
  beerName:         18,
  beerPrice:         5,
  promoBody:        30,
  promoHeadline:    26,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────

interface HhSpecial  { id: string; price: string; label: string; }
interface SmallPlate { id: string; name: string; price: string; desc: string; }
interface Cocktail   { id: string; name: string; hh_price: string; reg_price: string; desc: string; floater_text: string; floater_price: string; }
interface Wine       { id: string; name: string; glass_price: string; bottle_price: string; }
interface Beer       { id: string; name: string; price: string; }
interface Promo      { body: string; headline: string; }

interface MenuData {
  hh_specials:  HhSpecial[];
  small_plates: SmallPlate[];
  cocktails:    Cocktail[];
  wines:        Wine[];
  beers:        Beer[];
  promo:        Promo;
}

interface BackupEntry { key: string; ts: number; label: string; }

// ── Helpers ───────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// Digits-only filter (for most price inputs)
function digitsOnly(v: string) { return v.replace(/[^0-9]/g, ''); }
// Digits + one decimal (for beer prices like "6.50")
function digitsDecimal(v: string) {
  const cleaned = v.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
}

// ── Small UI components ───────────────────────────────────────────────────

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const over = len >= max;
  return (
    <span className={`char-count ${over ? 'over' : ''}`}>
      {len}/{max}
    </span>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────

function SectionPanel({ title, note, defaultOpen, children }: {
  title: string; note?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="section-block">
      <div className="section-block-header" onClick={() => setOpen(o => !o)}>
        <span className={`section-toggle ${open ? 'open' : ''}`}>▶</span>
        <span className="section-title-label">{title}</span>
        {note && <span className="section-note">{note}</span>}
      </div>
      <div className={`collapsible-content ${open ? 'open' : ''}`}>
        <div className="section-body chef-items">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── HH Specials ───────────────────────────────────────────────────────────

function HhSpecialRow({ item, onChange }: {
  item: HhSpecial;
  onChange: (updated: HhSpecial) => void;
}) {
  return (
    <div className="dish-row">
      <div className="dish-fields">
        <div className="dish-field-row" style={{ gap: '12px' }}>
          <div className="field-group price-field" style={{ flex: '0 0 80px' }}>
            <div className="field-label-row">
              <label>$ Price</label>
              <CharCount value={item.price} max={L.hhSpecialPrice} />
            </div>
            <input
              value={item.price}
              maxLength={L.hhSpecialPrice}
              onChange={e => onChange({ ...item, price: digitsOnly(e.target.value) })}
              placeholder="10"
            />
          </div>
          <div className="field-group" style={{ flex: 1 }}>
            <div className="field-label-row">
              <label>Label</label>
              <CharCount value={item.label} max={L.hhSpecialLabel} />
            </div>
            <input
              value={item.label}
              maxLength={L.hhSpecialLabel}
              onChange={e => onChange({ ...item, label: e.target.value })}
              placeholder="e.g. Well Drinks"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small Plates ──────────────────────────────────────────────────────────

function SmallPlateRow({ item, onChange }: {
  item: SmallPlate;
  onChange: (updated: SmallPlate) => void;
}) {
  return (
    <div className="dish-row">
      <div className="dish-row-header">
        <span className="dish-name-preview">{item.name || '(unnamed)'}</span>
      </div>
      <div className="dish-fields">
        <div className="dish-field-row" style={{ gap: '12px' }}>
          <div className="field-group" style={{ flex: 1 }}>
            <div className="field-label-row">
              <label>Name</label>
              <CharCount value={item.name} max={L.smallPlateName} />
            </div>
            <input value={item.name} maxLength={L.smallPlateName} onChange={e => onChange({ ...item, name: e.target.value })} placeholder="Dish name" />
          </div>
          <div className="field-group price-field" style={{ flex: '0 0 72px' }}>
            <div className="field-label-row">
              <label>$ Price</label>
              <CharCount value={item.price} max={L.smallPlatePrice} />
            </div>
            <input value={item.price} maxLength={L.smallPlatePrice} onChange={e => onChange({ ...item, price: digitsOnly(e.target.value) })} placeholder="8" />
          </div>
        </div>
        <div className="field-group">
          <div className="field-label-row">
            <label>Description</label>
            <CharCount value={item.desc} max={L.smallPlateDesc} />
          </div>
          <input value={item.desc} maxLength={L.smallPlateDesc} onChange={e => onChange({ ...item, desc: e.target.value })} placeholder="Ingredients, one line" />
        </div>
      </div>
    </div>
  );
}

// ── Cocktails ─────────────────────────────────────────────────────────────

function CocktailRow({ item, onChange }: {
  item: Cocktail;
  onChange: (updated: Cocktail) => void;
}) {
  const hasFloater = item.floater_text.trim() !== '';
  return (
    <div className="dish-row">
      <div className="dish-row-header">
        <span className="dish-name-preview">{item.name || '(unnamed)'}</span>
      </div>
      <div className="dish-fields">
        <div className="field-group">
          <div className="field-label-row">
            <label>Name</label>
            <CharCount value={item.name} max={L.cocktailName} />
          </div>
          <input value={item.name} maxLength={L.cocktailName} onChange={e => onChange({ ...item, name: e.target.value })} placeholder="Cocktail name" />
        </div>
        <div className="dish-field-row" style={{ gap: '12px' }}>
          <div className="field-group price-field" style={{ flex: 1 }}>
            <div className="field-label-row">
              <label>HH Price $</label>
              <CharCount value={item.hh_price} max={L.cocktailHhPrice} />
            </div>
            <input value={item.hh_price} maxLength={L.cocktailHhPrice} onChange={e => onChange({ ...item, hh_price: digitsOnly(e.target.value) })} placeholder="10" />
          </div>
          <div className="field-group price-field" style={{ flex: 1 }}>
            <div className="field-label-row">
              <label>Reg Price $</label>
              <CharCount value={item.reg_price} max={L.cocktailRegPrice} />
            </div>
            <input value={item.reg_price} maxLength={L.cocktailRegPrice} onChange={e => onChange({ ...item, reg_price: digitsOnly(e.target.value) })} placeholder="13" />
          </div>
        </div>
        <div className="field-group">
          <div className="field-label-row">
            <label>Description</label>
            <CharCount value={item.desc} max={L.cocktailDesc} />
          </div>
          <input value={item.desc} maxLength={L.cocktailDesc} onChange={e => onChange({ ...item, desc: e.target.value })} placeholder="Ingredients, one line" />
        </div>
        {/* Floater */}
        <div className="floater-section">
          <label className="floater-toggle-label">
            <input
              type="checkbox"
              checked={hasFloater}
              onChange={e => onChange({ ...item, floater_text: e.target.checked ? ' ' : '', floater_price: '' })}
            />
            Floater (e.g. upgrade option)
          </label>
          {hasFloater && (
            <div className="dish-field-row" style={{ gap: '12px', marginTop: '8px' }}>
              <div className="field-group" style={{ flex: 1 }}>
                <div className="field-label-row">
                  <label>Floater text</label>
                  <CharCount value={item.floater_text} max={L.floaterText} />
                </div>
                <input
                  value={item.floater_text}
                  maxLength={L.floaterText}
                  onChange={e => onChange({ ...item, floater_text: e.target.value })}
                  placeholder="Grand Marnier or Herradura floater"
                />
              </div>
              <div className="field-group price-field" style={{ flex: '0 0 80px' }}>
                <div className="field-label-row">
                  <label>$ Price</label>
                  <CharCount value={item.floater_price} max={L.floaterPrice} />
                </div>
                <input
                  value={item.floater_price}
                  maxLength={L.floaterPrice}
                  onChange={e => onChange({ ...item, floater_price: digitsOnly(e.target.value) })}
                  placeholder="3"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Wine ──────────────────────────────────────────────────────────────────

function WineRow({ item, onChange }: {
  item: Wine;
  onChange: (updated: Wine) => void;
}) {
  return (
    <div className="dish-row">
      <div className="dish-fields">
        <div className="dish-field-row" style={{ gap: '12px' }}>
          <div className="field-group" style={{ flex: 1 }}>
            <div className="field-label-row">
              <label>Name</label>
              <CharCount value={item.name} max={L.wineName} />
            </div>
            <input value={item.name} maxLength={L.wineName} onChange={e => onChange({ ...item, name: e.target.value })} placeholder="Wine name" />
          </div>
          <div className="field-group price-field" style={{ flex: '0 0 72px' }}>
            <div className="field-label-row">
              <label>Glass</label>
              <CharCount value={item.glass_price} max={L.wineGlassPrice} />
            </div>
            <input value={item.glass_price} maxLength={L.wineGlassPrice} onChange={e => onChange({ ...item, glass_price: digitsOnly(e.target.value) })} placeholder="10" />
          </div>
          <div className="field-group price-field" style={{ flex: '0 0 72px' }}>
            <div className="field-label-row">
              <label>Bottle</label>
              <CharCount value={item.bottle_price} max={L.wineBottlePrice} />
            </div>
            <input value={item.bottle_price} maxLength={L.wineBottlePrice} onChange={e => onChange({ ...item, bottle_price: digitsOnly(e.target.value) })} placeholder="40" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Beer ──────────────────────────────────────────────────────────────────

function BeerRow({ item, onChange }: {
  item: Beer;
  onChange: (updated: Beer) => void;
}) {
  return (
    <div className="dish-row">
      <div className="dish-fields">
        <div className="dish-field-row" style={{ gap: '12px' }}>
          <div className="field-group" style={{ flex: 1 }}>
            <div className="field-label-row">
              <label>Name</label>
              <CharCount value={item.name} max={L.beerName} />
            </div>
            <input value={item.name} maxLength={L.beerName} onChange={e => onChange({ ...item, name: e.target.value })} placeholder="Beer name" />
          </div>
          <div className="field-group price-field" style={{ flex: '0 0 88px' }}>
            <div className="field-label-row">
              <label>Price</label>
              <CharCount value={item.price} max={L.beerPrice} />
            </div>
            <input value={item.price} maxLength={L.beerPrice} onChange={e => onChange({ ...item, price: digitsDecimal(e.target.value) })} placeholder="6.50" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────

function HistoryPanel({ onRestore }: { onRestore: (data: MenuData) => void }) {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/happyhour/backups');
    if (res.ok) setBackups(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function restore(entry: BackupEntry) {
    if (!confirm(`Restore Happy Hour menu to the version saved on ${entry.label}?\n\nThis will overwrite your current menu.`)) return;
    setRestoring(entry.key);
    try {
      const res = await fetch('/api/happyhour/backups', {
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

export default function HappyhourEditorPage() {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [historyKey, setHistoryKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('/happyhour-preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevJsonRef = useRef<string>('');

  useEffect(() => {
    fetch('/api/happyhour')
      .then(r => r.json())
      .then(data => { setMenu(data); prevJsonRef.current = JSON.stringify(data); })
      .catch(() => setSaveStatus('error'));
  }, []);

  const debouncedMenu = useDebounce(menu, 800);

  const saveAndRefresh = useCallback(async (data: MenuData) => {
    const json = JSON.stringify(data);
    if (json === prevJsonRef.current) return;
    prevJsonRef.current = json;
    setSaveStatus('saving'); setSaveMsg('Saving…');
    try {
      const res = await fetch('/api/happyhour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.issues ? body.issues.map((i: { message: string }) => i.message).join('; ') : (body.error || 'Save failed');
        setSaveStatus('error'); setSaveMsg(msg); return;
      }
      setSaveStatus('saved'); setSaveMsg('Saved');
      setHistoryKey(k => k + 1);
      iframeRef.current?.contentWindow?.postMessage({ type: 'SIENA_HAPPYHOUR_UPDATE', payload: data }, '*');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch { setSaveStatus('error'); setSaveMsg('Network error'); }
  }, []);

  useEffect(() => {
    if (debouncedMenu && prevJsonRef.current !== '') saveAndRefresh(debouncedMenu);
  }, [debouncedMenu, saveAndRefresh]);

  // ── Array item updaters ────────────────────────────────────────────────

  function updateArrayItem<T>(key: keyof MenuData, index: number, updated: T) {
    setMenu(m => {
      if (!m) return m;
      const arr = [...(m[key] as T[])];
      arr[index] = updated;
      return { ...m, [key]: arr };
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (!menu) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading…</div>;
  }

  const saveStatusClass =
    saveStatus === 'saved'  ? 'save-status saved'  :
    saveStatus === 'saving' ? 'save-status saving' :
    saveStatus === 'error'  ? 'save-status error'  : 'save-status';

  return (
    <div className="app">
      {/* ── Editor pane ───────────────────────────────────────────── */}
      <div className="editor-pane">
        <div className="editor-header">
          <Link href="/" className="btn-back">← All Menus</Link>
          <h1>Happy Hour Menu</h1>
        </div>

        <div className="editor-scroll chef-mode">

          {/* HH Specials */}
          <div className="page-group">
            <SectionPanel title="The Specials" note="Bar Area Only" defaultOpen>
              {menu.hh_specials.map((item, i) => (
                <HhSpecialRow key={item.id} item={item} onChange={u => updateArrayItem('hh_specials', i, u)} />
              ))}
            </SectionPanel>
          </div>

          {/* Small Plates */}
          <div className="page-group">
            <SectionPanel title="Small Plates">
              {menu.small_plates.map((item, i) => (
                <SmallPlateRow key={item.id} item={item} onChange={u => updateArrayItem('small_plates', i, u)} />
              ))}
            </SectionPanel>
          </div>

          {/* Cocktails */}
          <div className="page-group">
            <SectionPanel title="Signature Cocktails" note="HH · Regular prices">
              {menu.cocktails.map((item, i) => (
                <CocktailRow key={item.id} item={item} onChange={u => updateArrayItem('cocktails', i, u)} />
              ))}
            </SectionPanel>
          </div>

          {/* Wine */}
          <div className="page-group">
            <SectionPanel title="Wine by the Glass" note="Glass · Bottle">
              {menu.wines.map((item, i) => (
                <WineRow key={item.id} item={item} onChange={u => updateArrayItem('wines', i, u)} />
              ))}
            </SectionPanel>
          </div>

          {/* Beer */}
          <div className="page-group">
            <SectionPanel title="Bottled Beer">
              {menu.beers.map((item, i) => (
                <BeerRow key={item.id} item={item} onChange={u => updateArrayItem('beers', i, u)} />
              ))}
            </SectionPanel>
          </div>

          {/* Bar Promo */}
          <div className="page-group">
            <div className="page-group-label">Bar Promo</div>
            <div className="dish-row">
              <div className="dish-fields">
                <div className="field-group">
                  <div className="field-label-row">
                    <label>Eyebrow (small uppercase line)</label>
                    <CharCount value={menu.promo.body} max={L.promoBody} />
                  </div>
                  <input
                    value={menu.promo.body}
                    maxLength={L.promoBody}
                    onChange={e => setMenu(m => m && { ...m, promo: { ...m.promo, body: e.target.value } })}
                    placeholder="e.g. Tuesday Nights at the Bar"
                  />
                </div>
                <div className="field-group">
                  <div className="field-label-row">
                    <label>Headline</label>
                    <CharCount value={menu.promo.headline} max={L.promoHeadline} />
                  </div>
                  <input
                    value={menu.promo.headline}
                    maxLength={L.promoHeadline}
                    onChange={e => setMenu(m => m && { ...m, promo: { ...m.promo, headline: e.target.value } })}
                    placeholder="e.g. $10 Signature Cocktails"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        <HistoryPanel
          key={historyKey}
          onRestore={data => {
            setMenu(data);
            prevJsonRef.current = JSON.stringify(data);
            setSaveStatus('saved'); setSaveMsg('Restored');
            iframeRef.current?.contentWindow?.postMessage({ type: 'SIENA_HAPPYHOUR_UPDATE', payload: data }, '*');
            setTimeout(() => setSaveStatus('idle'), 3000);
          }}
        />

        <div className="editor-footer">
          <span className={saveStatusClass}>{saveMsg || 'Auto-saves as you type'}</span>
          <button
            className="btn-print"
            onClick={() => {
              if (menu) localStorage.setItem('siena-happyhour-print-data', JSON.stringify(menu));
              window.open('/happyhour-print', '_blank');
            }}
          >
            Print Menu
          </button>
        </div>
      </div>

      {/* ── Preview pane ──────────────────────────────────────────── */}
      <div className="preview-pane">
        <div className="preview-toolbar">
          <span>Live preview</span>
          <button
            className="btn-ghost"
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px 10px' }}
            onClick={() => setPreviewUrl('/happyhour-preview?' + Date.now())}
          >
            ↺ Reload from server
          </button>
        </div>
        <iframe ref={iframeRef} src={previewUrl} className="preview-iframe" title="Happy Hour preview" />
      </div>
    </div>
  );
}
