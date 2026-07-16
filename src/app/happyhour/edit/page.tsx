'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

interface HhSpecial  { id: string; price: string; label: string; }
interface SmallPlate { id: string; name: string; price: string; desc: string; }
interface Cocktail   { id: string; name: string; hh_price: string; reg_price: string; desc: string; floater: string; }
interface Wine       { id: string; name: string; glass_price: string; bottle_price: string; }
interface Beer       { id: string; name: string; price: string; }
interface Promo      { eyebrow: string; headline: string; }

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

// Strip leading $ for display in price inputs; only digits pass through
function stripDollar(v: string) { return v.replace(/^\$/, ''); }
// Reconstruct "$N" from raw digit input
function dollarPrice(raw: string) {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits ? '$' + digits : '';
}
// Digits + one decimal point (for beer like "6.50", no $ prefix)
function digitsDecimal(v: string) {
  const cleaned = v.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
}
// Digits only (for wine prices, no $ prefix)
function digitsOnly(v: string) { return v.replace(/[^0-9]/g, ''); }

// Human-readable section names for the validation error banner
const SECTION_NAMES: Record<string, string> = {
  'hh-specials':   'The Specials',
  'small-plates':  'Small Plates',
  'cocktails':     'Signature Cocktails',
  'wines':         'Wine by the Glass',
  'beers':         'Bottled Beer',
};
function sectionLabel(id: string) { return SECTION_NAMES[id] ?? id; }

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
// Price stored as "$4", "$10". Label may contain \n for two-line cells
// (e.g. "Bud Light\nMiller Lite"). Textarea handles the newline naturally.

function HhSpecialRow({ item, onChange }: {
  item: HhSpecial;
  onChange: (updated: HhSpecial) => void;
}) {
  return (
    <div className="dish-row">
      <div className="dish-fields">
        <div className="dish-field-row" style={{ gap: '12px' }}>
          <div className="field-group price-field" style={{ flex: '0 0 88px' }}>
            <label>$ Price</label>
            <input
              value={stripDollar(item.price)}
              maxLength={4}
              onChange={e => onChange({ ...item, price: dollarPrice(e.target.value) })}
              placeholder="10"
            />
          </div>
          <div className="field-group" style={{ flex: 1 }}>
            <label>Label</label>
            <textarea
              value={item.label}
              rows={2}
              maxLength={60}
              onChange={e => onChange({ ...item, label: e.target.value })}
              placeholder={'e.g. Well Drinks\nor two-line label'}
              style={{ resize: 'none', fontFamily: 'inherit', fontSize: 'inherit' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small Plates ──────────────────────────────────────────────────────────
// Price stored as "$6". Desc may wrap — no hard cap, page-fit is the limit.

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
            <label>Name</label>
            <input
              value={item.name}
              maxLength={60}
              onChange={e => onChange({ ...item, name: e.target.value })}
              placeholder="Dish name"
            />
          </div>
          <div className="field-group price-field" style={{ flex: '0 0 88px' }}>
            <label>$ Price</label>
            <input
              value={stripDollar(item.price)}
              maxLength={4}
              onChange={e => onChange({ ...item, price: dollarPrice(e.target.value) })}
              placeholder="8"
            />
          </div>
        </div>
        <div className="field-group">
          <label>Description</label>
          <textarea
            value={item.desc}
            rows={2}
            maxLength={240}
            onChange={e => onChange({ ...item, desc: e.target.value })}
            placeholder="Ingredients description"
            style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 'inherit' }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Cocktails ─────────────────────────────────────────────────────────────
// HH and Reg prices stored as "$10", "$13".
// Floater is a single plain-text string; empty = no floater.

function CocktailRow({ item, onChange }: {
  item: Cocktail;
  onChange: (updated: Cocktail) => void;
}) {
  const hasFloater = item.floater.trim() !== '';
  return (
    <div className="dish-row">
      <div className="dish-row-header">
        <span className="dish-name-preview">{item.name || '(unnamed)'}</span>
      </div>
      <div className="dish-fields">
        <div className="field-group">
          <label>Name</label>
          <input
            value={item.name}
            maxLength={60}
            onChange={e => onChange({ ...item, name: e.target.value })}
            placeholder="Cocktail name"
          />
        </div>
        <div className="dish-field-row" style={{ gap: '12px' }}>
          <div className="field-group price-field" style={{ flex: 1 }}>
            <label>HH Price $</label>
            <input
              value={stripDollar(item.hh_price)}
              maxLength={4}
              onChange={e => onChange({ ...item, hh_price: dollarPrice(e.target.value) })}
              placeholder="10"
            />
          </div>
          <div className="field-group price-field" style={{ flex: 1 }}>
            <label>Reg Price $</label>
            <input
              value={stripDollar(item.reg_price)}
              maxLength={4}
              onChange={e => onChange({ ...item, reg_price: dollarPrice(e.target.value) })}
              placeholder="13"
            />
          </div>
        </div>
        <div className="field-group">
          <label>Description</label>
          <textarea
            value={item.desc}
            rows={2}
            maxLength={240}
            onChange={e => onChange({ ...item, desc: e.target.value })}
            placeholder="Ingredients description"
            style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 'inherit' }}
          />
        </div>
        {/* Floater — single text string, template adds the leading "+" */}
        <div className="floater-section">
          <label className="floater-toggle-label">
            <input
              type="checkbox"
              checked={hasFloater}
              onChange={e => onChange({ ...item, floater: e.target.checked ? ' ' : '' })}
            />
            Floater / upgrade option
          </label>
          {hasFloater && (
            <div className="field-group" style={{ marginTop: '8px' }}>
              <label>Floater line (e.g. Grand Marnier or Herradura Reposado floater $3)</label>
              <input
                value={item.floater.trim()}
                maxLength={120}
                onChange={e => onChange({ ...item, floater: e.target.value })}
                placeholder="Grand Marnier or Herradura Reposado floater $3"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Wine ──────────────────────────────────────────────────────────────────
// Prices are digits only (design omits $).

function WineRow({ item, onChange }: {
  item: Wine;
  onChange: (updated: Wine) => void;
}) {
  return (
    <div className="dish-row">
      <div className="dish-fields">
        <div className="dish-field-row" style={{ gap: '12px' }}>
          <div className="field-group" style={{ flex: 1 }}>
            <label>Name</label>
            <input
              value={item.name}
              maxLength={60}
              onChange={e => onChange({ ...item, name: e.target.value })}
              placeholder="Wine name"
            />
          </div>
          <div className="field-group price-field" style={{ flex: '0 0 72px' }}>
            <label>Glass</label>
            <input
              value={item.glass_price}
              maxLength={4}
              onChange={e => onChange({ ...item, glass_price: digitsOnly(e.target.value) })}
              placeholder="10"
            />
          </div>
          <div className="field-group price-field" style={{ flex: '0 0 72px' }}>
            <label>Bottle</label>
            <input
              value={item.bottle_price}
              maxLength={4}
              onChange={e => onChange({ ...item, bottle_price: digitsOnly(e.target.value) })}
              placeholder="40"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Beer ──────────────────────────────────────────────────────────────────
// Price is digits+decimal (design omits $), e.g. "6.50".

function BeerRow({ item, onChange }: {
  item: Beer;
  onChange: (updated: Beer) => void;
}) {
  return (
    <div className="dish-row">
      <div className="dish-fields">
        <div className="dish-field-row" style={{ gap: '12px' }}>
          <div className="field-group" style={{ flex: 1 }}>
            <label>Name</label>
            <input
              value={item.name}
              maxLength={60}
              onChange={e => onChange({ ...item, name: e.target.value })}
              placeholder="Beer name"
            />
          </div>
          <div className="field-group price-field" style={{ flex: '0 0 88px' }}>
            <label>Price</label>
            <input
              value={item.price}
              maxLength={6}
              onChange={e => onChange({ ...item, price: digitsDecimal(e.target.value) })}
              placeholder="6.50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────

export default function HappyhourEditorPage() {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  // null = not yet validated; true = fits; false = overflow
  const [validationFits, setValidationFits] = useState<boolean | null>(null);
  const [worstSection, setWorstSection] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState('/happyhour-preview?src=draft');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevJsonRef = useRef<string>('');
  // Queue: when user edits, we stash the data here; save fires after validation confirms fit
  const pendingSaveRef = useRef<MenuData | null>(null);

  // Load initial data
  useEffect(() => {
    fetch('/api/happyhour/draft')
      .then(r => r.json())
      .then(data => { setMenu(data); prevJsonRef.current = JSON.stringify(data); })
      .catch(() => { setSaveStatus('error'); setSaveMsg('Failed to load menu data'); });
  }, []);

  // Server save — only called after validation confirms the page fits
  const saveToServer = useCallback(async (data: MenuData) => {
    const json = JSON.stringify(data);
    if (json === prevJsonRef.current) return;
    prevJsonRef.current = json;
    setSaveStatus('saving'); setSaveMsg('Saving…');
    try {
      const res = await fetch('/api/happyhour/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.issues
          ? body.issues.map((i: { message: string }) => i.message).join('; ')
          : (body.error || 'Save failed');
        setSaveStatus('error'); setSaveMsg(msg); return;
      }
      setSaveStatus('saved'); setSaveMsg('Saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch { setSaveStatus('error'); setSaveMsg('Network error'); }
  }, []);

  // Listen for validation results posted back from the preview iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || e.data.type !== 'SIENA_HAPPYHOUR_VALIDATE_RESULT') return;
      const result = e.data.result as { fits: boolean; worstSection?: string | null; overflowPx?: number };
      setValidationFits(result.fits);
      if (result.fits) {
        setWorstSection(null);
        // If there's a pending save, fire it now that we know the page fits
        if (pendingSaveRef.current) {
          saveToServer(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }
      } else {
        setWorstSection(result.worstSection ?? null);
        pendingSaveRef.current = null;
        setSaveStatus('error');
        const section = result.worstSection ? sectionLabel(result.worstSection) : 'the page';
        setSaveMsg(`Content overflows in "${section}" — try shortening a description`);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [saveToServer]);

  // Debounce menu edits → send to iframe for live preview + validation
  const debouncedMenu = useDebounce(menu, 600);
  useEffect(() => {
    if (!debouncedMenu || prevJsonRef.current === '') return;
    const json = JSON.stringify(debouncedMenu);
    // Queue the save; it will fire once validation result comes back as fits=true
    pendingSaveRef.current = debouncedMenu;
    // Trigger live preview + validation in the iframe
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SIENA_HAPPYHOUR_UPDATE', payload: debouncedMenu },
      '*'
    );
  }, [debouncedMenu]);

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

  // ── Publish / discard ──────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    if (!menu) return;
    if (!confirm('Make this draft the current menu?\n\nThe menu people are printing now will be moved to "Past Menus," and this draft becomes the current menu dated today.')) return;
    setPublishing(true);
    setSaveMsg('Publishing…');
    try {
      await fetch('/api/happyhour/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menu) });
      const res = await fetch('/api/happyhour/publish', { method: 'POST' });
      if (!res.ok) { setPublishing(false); setSaveStatus('error'); setSaveMsg('Publish failed — try again'); return; }
      window.location.href = '/happyhour';
    } catch { setPublishing(false); setSaveStatus('error'); setSaveMsg('Network error while publishing'); }
  }

  async function handleDiscard() {
    if (!confirm('Discard this draft?\n\nAll changes since the current menu will be lost. The current menu is not affected.')) return;
    try { await fetch('/api/happyhour/draft', { method: 'DELETE' }); }
    finally { window.location.href = '/happyhour'; }
  }

  if (!menu) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading…</div>;
  }

  const saveStatusClass =
    saveStatus === 'saved'  ? 'save-status saved'  :
    saveStatus === 'saving' ? 'save-status saving' :
    saveStatus === 'error'  ? 'save-status error'  : 'save-status';

  const overflowSection = validationFits === false && worstSection ? sectionLabel(worstSection) : null;

  return (
    <div className="app">
      {/* ── Editor pane ───────────────────────────────────────────── */}
      <div className="editor-pane">
        <div className="editor-header">
          <Link href="/happyhour" className="btn-back">← Back</Link>
          <h1>Happy Hour Menu</h1>
            <Link href="/" className="btn-home">🏠 Home</Link>
        </div>

        {/* Overflow warning banner */}
        {overflowSection && (
          <div style={{
            background: '#7f1d1d', color: '#fecaca', fontSize: '13px',
            padding: '8px 16px', borderBottom: '1px solid #991b1b',
          }}>
            ⚠ Content overflows in <strong>{overflowSection}</strong> — try shortening a description. Save is paused until it fits.
          </div>
        )}

          <div className="draft-banner">
            ✎ You&rsquo;re editing a <strong>draft</strong>. The current menu stays locked and unchanged until you press <strong>Make This the Current Menu</strong>.
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
                  <label>Eyebrow (small uppercase line)</label>
                  <input
                    value={menu.promo.eyebrow}
                    maxLength={80}
                    onChange={e => setMenu(m => m && { ...m, promo: { ...m.promo, eyebrow: e.target.value } })}
                    placeholder="e.g. Tuesday Nights at the Bar"
                  />
                </div>
                <div className="field-group">
                  <label>Headline (leading $XX gets gold accent automatically)</label>
                  <input
                    value={menu.promo.headline}
                    maxLength={80}
                    onChange={e => setMenu(m => m && { ...m, promo: { ...m.promo, headline: e.target.value } })}
                    placeholder="e.g. $10 Signature Cocktails"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>


          <div className="editor-footer editor-footer--publish">
            <button className="btn-discard-draft" onClick={handleDiscard} disabled={publishing}>Discard Draft</button>
            <span className="publish-hint">You&rsquo;re editing a draft — the current menu is unchanged until you publish.</span>
            <button className="btn-publish" onClick={handlePublish} disabled={publishing}>{publishing ? 'Publishing…' : 'Make This the Current Menu'}</button>
          </div>
        <div className="editor-footer">
          <span className={saveStatusClass}>{saveMsg || 'Auto-saves as you type'}</span>
          <button
            className="btn-print"
            disabled={validationFits === false}
            title={validationFits === false ? 'Fix overflow before printing' : undefined}
            onClick={() => {
              if (menu) localStorage.setItem('siena-happyhour-print-data', JSON.stringify(menu));
              window.open('/happyhour-print?src=draft', '_blank');
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
          {validationFits === false && (
            <span style={{ color: '#fca5a5', fontSize: '12px', marginLeft: '8px' }}>
              ⚠ Overflow
            </span>
          )}
          <button
            className="btn-ghost"
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '4px 10px', marginLeft: 'auto' }}
            onClick={() => setPreviewUrl('/happyhour-preview?src=draft&' + Date.now())}
          >
            ↺ Reload from server
          </button>
        </div>
        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="preview-iframe"
          title="Happy Hour preview"
        />
      </div>
    </div>
  );
}
