// Pre-print sanity warnings (Oct 2026, Joe): before any menu prints, point
// out things that are almost certainly mistakes and let the person print
// anyway — never blocks printing. Data checks (here):
//   - a section with dishes but no title
//   - an item with no price / a prix-fixe menu with no price
//   - an item with a description or price but no name (prints as a gap)
//   - an odd-looking price ("1 8", "18.", "$$18"), or one list mixing "$18"
//     and "18"
//   - the same dish listed twice
// Plus a layout check done on the print page itself ("doesn't seem to fit").
//
// Used in two places with the same rules:
//   - editors: confirmPrintWarnings() before opening the print tab
//   - print/preview routes: withPrintGuard() wraps window.print() so prints
//     started from a menu's landing page (Most Recent / Past Menus) or a View
//     page's Print button ask too. Editor-opened prints pass &warned=1 so the
//     data warnings aren't asked twice; the fit check still runs there.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = any;

export type PrintMenuId =
  | 'dinner' | 'monday' | 'tueswed' | 'weekend' | 'happyhour'
  | 'drinksdessert' | 'dessert' | 'privatedining' | 'arw' | 'coursemenu';

const has = (v: unknown) => typeof v === 'string' && v.trim() !== '';
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const q = (s: string) => `“${s.trim()}”`;

// "$18", "18", "6.50", "$1,200", "MP" / "Market Price" are fine.
const PRICE_OK = /^\$?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\$?\d+(\.\d{1,2})?$|^(mp|market price)$/i;

class Checker {
  out: string[] = [];
  private seen = new Map<string, number>();

  /** Names count once each per menu for the duplicate check. */
  private noteName(name: string) {
    const k = name.trim().toLowerCase();
    this.seen.set(k, (this.seen.get(k) ?? 0) + 1);
  }

  /**
   * One list of items. `prices` returns the price strings an item needs
   * (empty array = this list has no prices). `where` names the list in
   * messages. `extraText` = other fields that make a nameless row visible.
   */
  list(items: Data[] | undefined, where: string, prices: (it: Data) => unknown[], extraText: (it: Data) => unknown[] = (it) => [it?.desc]) {
    const styles: { name: string; dollar: boolean }[] = [];
    for (const it of items ?? []) {
      const ps = prices(it).map(str);
      if (!has(it?.name)) {
        if (ps.some(Boolean) || extraText(it).some(has)) out(this, `An item in ${where} has a description or price but no name — it will print as a blank line`);
        continue;
      }
      const name = String(it.name);
      this.noteName(name);
      if (ps.length && ps.some((p) => !p)) this.out.push(`${q(name)} (${where}) has no price`);
      for (const p of ps) {
        if (!p) continue;
        if (!PRICE_OK.test(p)) this.out.push(`${q(name)} (${where}) has an odd-looking price: ${q(p)}`);
        else if (/\d/.test(p)) styles.push({ name, dollar: p.startsWith('$') });
      }
    }
    const withD = styles.filter((s) => s.dollar), without = styles.filter((s) => !s.dollar);
    if (withD.length && without.length) {
      const odd = withD.length >= without.length ? without : withD;
      this.out.push(`Prices in ${where} mix “$18” and “18” styles — check ${odd.slice(0, 3).map((s) => q(s.name)).join(', ')}`);
    }
  }

  untitled(title: unknown, items: Data[] | undefined, label: string) {
    if ((items ?? []).some((it) => has(it?.name)) && !has(title)) this.out.push(`The ${label} section has dishes but no title`);
  }

  prixFixe(price: unknown, label = 'prix fixe') {
    const p = str(price);
    if (!p) this.out.push(`The ${label} price is missing`);
    else if (!PRICE_OK.test(p)) this.out.push(`The ${label} price looks odd: ${q(p)}`);
  }

  finish(): string[] {
    for (const [k, n] of this.seen) if (n > 1) this.out.push(`${q(k.replace(/\b\w/g, (c) => c.toUpperCase()))} is listed ${n} times`);
    return this.out;
  }
}
function out(c: Checker, msg: string) { if (!c.out.includes(msg)) c.out.push(msg); }

const DINNER_SECTION_NAMES: Record<string, string> = {
  antipasti: 'Antipasti', 'zuppa-insalate': 'Zuppa & Insalate', pasta: 'Pasta',
  contorni: 'Contorni', secondi: 'Secondi', 'non-alcoholic': 'Non-Alcoholic',
};

const CHECKS: Record<PrintMenuId, (d: Data, c: Checker) => void> = {
  dinner(d, c) {
    for (const [id, s] of Object.entries<Data>(d?.sections ?? {})) {
      const label = DINNER_SECTION_NAMES[id] ?? id;
      const shown = (s?.items ?? []).filter((it: Data) => it?.enabled !== false); // hidden dishes don't print
      c.untitled(s?.title, shown, label);
      c.list(shown, s?.title || label, (it) => it?.price_format === 'dual'
        ? [it.price_a || it.bowl_price, it.price_b || it.cup_price] : [it?.price]);
    }
    for (const key of ['salad_addons', 'pasta_addons', 'steak_addons']) {
      const b = d?.[key];
      if (b?.enabled) c.list((b.items ?? []).filter((i: Data) => i.enabled), b.label || 'add-ons', (i) => [i.price], () => []);
    }
  },
  monday(d, c) {
    c.prixFixe(d?.hero?.price);
    for (const [id, s] of Object.entries<Data>(d?.sections ?? {})) {
      const label = id.replace('course-', 'Course ');
      c.untitled(s?.title, s?.items, label);
      // Course dish prices are optional by design (prix fixe) — check format only.
      c.list(s?.items, s?.title || label, (it) => (has(it?.price) ? [it.price] : []));
    }
    if (d?.pasta_addons?.enabled) c.list((d.pasta_addons.items ?? []).filter((i: Data) => i.enabled), 'pasta add-ons', (i) => [i.price], () => []);
  },
  tueswed(d, c) {
    c.prixFixe(d?.price);
    c.list(d?.courses?.map((x: Data) => ({ name: x.title, desc: x.desc })), 'the courses', () => []);
    if (has(d?.addon?.title) && !has(d?.addon?.price)) c.out.push(`The add-on ${q(d.addon.title)} has no price`);
  },
  weekend(d, c) {
    for (const [id, s] of Object.entries<Data>(d?.sections ?? {})) {
      const label = id === 'starters' ? 'starters' : 'entrées';
      c.untitled(s?.title, s?.items, label);
      c.list(s?.items, s?.title || label, (it) => [it?.price]);
    }
    const ds = d?.dessert;
    if (ds) {
      if (has(ds.name) && !has(ds.title)) c.out.push('The dessert section has a dish but no title');
      c.list([ds], ds.title || 'dessert', (it) => [it.price]);
    }
  },
  happyhour(d, c) {
    c.list((d?.hh_specials ?? []).map((s: Data) => ({ name: String(s.label ?? '').replace(/\n/g, ' '), price: s.price })), 'happy hour specials', (i) => [i.price], () => []);
    c.list(d?.small_plates, 'small plates', (i) => [i.price]);
    c.list(d?.cocktails, 'cocktails', (i) => [i.hh_price, i.reg_price]);
    c.list(d?.wines, 'wine', (i) => [i.glass_price, i.bottle_price]);
    c.list(d?.beers, 'beer', (i) => [i.price]);
  },
  drinksdessert(d, c) {
    c.list(d?.cocktails, 'Signature Cocktails', (i) => [i.price]);
    for (const [k, l] of Object.entries<Data[]>(d?.spirits ?? {})) c.list(l, k, (i) => [i.price]);
    for (const [k, l] of Object.entries<Data[]>(d?.liquori ?? {})) c.list(l, k, (i) => [i.price]);
    if ((d?.spritz?.items ?? []).some((i: Data) => has(i?.name))) c.prixFixe(d?.spritz?.price, 'Spritz Menu');
    c.list(d?.spritz?.items, 'Spritz Menu', () => []);
  },
  dessert(d, c) {
    c.list(d?.dolci, 'Dolci', (i) => [i.price]);
    for (const [k, l] of Object.entries<Data[]>(d?.dopaCena ?? {})) c.list(l, k, (i) => [i.price]);
  },
  privatedining(d, c) {
    (d?.courses ?? []).forEach((co: Data, i: number) => {
      c.untitled(co?.label, co?.dishes, `course ${i + 1}`);
      c.list(co?.dishes, co?.label || `course ${i + 1}`, () => []); // no prices (quoted per event)
    });
  },
  arw(d, c) {
    for (const [k, co] of Object.entries<Data>(d?.courses ?? {})) {
      // Upcharges are optional by design — check their format only.
      c.list(co?.items, k, (it) => (has(it?.upcharge) ? [it.upcharge] : []));
    }
    if (has(d?.cocktail?.name)) c.list([d.cocktail], 'featured cocktail', (i) => [i.price]);
  },
  coursemenu(d, c) {
    if (!has(d?.header)) c.out.push('The menu has no header (title)');
    c.prixFixe(d?.price);
    (d?.courses ?? []).forEach((co: Data, i: number) => { if (!has(co?.title)) c.out.push(`Course ${i + 1} has no dish name`); });
    c.list(d?.courses?.map((x: Data) => ({ name: x.title, desc: x.desc })), 'the courses', () => []);
    if (has(d?.addon?.title) && !has(d?.addon?.price)) c.out.push(`The add-on ${q(d.addon.title)} has no price`);
  },
};

export function printWarnings(menu: PrintMenuId, data: Data): string[] {
  try { const c = new Checker(); CHECKS[menu](data, c); return c.finish(); } catch { return []; }
}

export function printWarningMessage(warnings: string[]): string {
  return 'Heads up before printing:\n\n• ' + warnings.join('\n• ') + '\n\nPrint anyway?';
}

export const UNSAVED_WARNING = 'Your latest changes are NOT saved yet — the printout will include them, but they will be gone if you leave this page';

/**
 * Editor side: true = go ahead and print. `saveFailed` adds the unsaved-
 * changes warning (the editor's last autosave was rejected or errored).
 */
export function confirmPrintWarnings(menu: PrintMenuId, data: Data, saveFailed = false): boolean {
  const w = printWarnings(menu, data);
  if (saveFailed) w.unshift(UNSAVED_WARNING);
  return w.length === 0 || window.confirm(printWarningMessage(w));
}

export const FIT_WARNING = 'This menu doesn’t seem to fit the page, double check before committing to this';

/**
 * Route side: inject a guard right after <body> that wraps window.print().
 * At print time it (a) checks whether any visible content on a .page /
 * .menu-page ends below that page's bottom edge (real layout, so after any
 * shrink/settle step has run; page padding doesn't count) — and (b) adds the data warnings
 * unless the editor already asked (&warned=1). Asks once; skipped inside
 * the editor's preview iframe.
 */
export function withPrintGuard(html: string, requestUrl: string, warnings: string[]): string {
  const warned = new URL(requestUrl).searchParams.get('warned') === '1';
  const data = JSON.stringify(warned ? [] : warnings).replace(/<\/script/gi, '<\\/script');
  const fit = JSON.stringify(FIT_WARNING);
  const guard = `<script>(function(){if(window.top!==window)return;var p=window.print.bind(window),ok=null,W=${data};` +
    `function overflows(){var ps=document.querySelectorAll('.page,.menu-page');for(var i=0;i<ps.length;i++){var pg=ps[i];` +
    `if(!pg.getClientRects().length)continue;var pr=pg.getBoundingClientRect(),els=pg.querySelectorAll('*');` +
    `for(var j=0;j<els.length;j++){var r=els[j].getBoundingClientRect();if(r.height&&r.width&&r.bottom>pr.bottom+1)return true;}}return false;}` +
    `window.print=function(){if(ok===null){var w=W.slice();try{if(overflows())w.unshift(${fit});}catch(_){}` +
    `ok=!w.length||window.confirm('Heads up before printing:\\n\\n\\u2022 '+w.join('\\n\\u2022 ')+'\\n\\nPrint anyway?');}if(ok)p();};})();</script>`;
  return html.replace(/<body[^>]*>/i, (m) => m + guard);
}
