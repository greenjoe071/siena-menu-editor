// Pre-print sanity warnings (Oct 2026, Joe): before any menu prints, point
// out things that are almost certainly mistakes — a section with dishes but
// no title, a dish with no price, a prix-fixe menu with no price — and let
// the person print anyway. Never blocks printing.
//
// Used in two places with the same rules:
//   - editors: confirmPrintWarnings() before opening the print tab
//   - print/preview routes: withPrintGuard() wraps window.print() for prints
//     started from a menu's landing page (Most Recent / Past Menus) or the
//     green Print button on a View page. Editor-opened prints pass
//     &warned=1 so the person isn't asked twice.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = any;

export type PrintMenuId =
  | 'dinner' | 'monday' | 'tueswed' | 'weekend' | 'happyhour'
  | 'drinksdessert' | 'dessert' | 'privatedining' | 'arw' | 'coursemenu';

const has = (v: unknown) => typeof v === 'string' && v.trim() !== '';
const q = (s: string) => `“${s.trim()}”`;

// An item counts as "on the menu" once it has a name (blank rows are skipped).
function priceless(items: Data[] | undefined, priceOf: (it: Data) => boolean, where: string, out: string[]) {
  for (const it of items ?? []) {
    if (!has(it?.name)) continue;
    if (!priceOf(it)) out.push(`${q(it.name)}${where ? ` (${where})` : ''} has no price`);
  }
}
function untitled(title: unknown, itemCount: number, fallback: string, out: string[]) {
  if (itemCount > 0 && !has(title)) out.push(`The ${fallback} section has dishes but no title`);
}
const named = (items: Data[] | undefined) => (items ?? []).filter((it) => has(it?.name)).length;

const DINNER_SECTION_NAMES: Record<string, string> = {
  antipasti: 'Antipasti', 'zuppa-insalate': 'Zuppa & Insalate', pasta: 'Pasta',
  contorni: 'Contorni', secondi: 'Secondi', 'non-alcoholic': 'Non-Alcoholic',
};

const CHECKS: Record<PrintMenuId, (d: Data) => string[]> = {
  dinner(d) {
    const out: string[] = [];
    for (const [id, s] of Object.entries<Data>(d?.sections ?? {})) {
      const label = DINNER_SECTION_NAMES[id] ?? id;
      untitled(s?.title, named(s?.items), label, out);
      priceless(s?.items, (it) => it.price_format === 'dual'
        ? (has(it.price_a) || has(it.bowl_price)) && (has(it.price_b) || has(it.cup_price))
        : has(it.price), s?.title || label, out);
    }
    for (const key of ['salad_addons', 'pasta_addons', 'steak_addons']) {
      const b = d?.[key];
      if (b?.enabled) priceless((b.items ?? []).filter((i: Data) => i.enabled), (i) => has(i.price), `${b.label || 'add-ons'}`, out);
    }
    return out;
  },
  monday(d) {
    const out: string[] = [];
    if (!has(d?.hero?.price)) out.push('The prix fixe price is missing');
    for (const [id, s] of Object.entries<Data>(d?.sections ?? {})) untitled(s?.title, named(s?.items), id.replace('course-', 'Course '), out);
    // Course dish prices are optional by design (prix fixe) — not checked.
    if (d?.pasta_addons?.enabled) priceless((d.pasta_addons.items ?? []).filter((i: Data) => i.enabled), (i) => has(i.price), 'pasta add-ons', out);
    return out;
  },
  tueswed(d) {
    const out: string[] = [];
    if (!has(d?.price)) out.push('The prix fixe price is missing');
    if (has(d?.addon?.title) && !has(d?.addon?.price)) out.push(`The add-on ${q(d.addon.title)} has no price`);
    return out;
  },
  weekend(d) {
    const out: string[] = [];
    for (const [id, s] of Object.entries<Data>(d?.sections ?? {})) {
      const label = id === 'starters' ? 'starters' : 'entrées';
      untitled(s?.title, named(s?.items), label, out);
      priceless(s?.items, (it) => has(it.price), '', out);
    }
    const ds = d?.dessert;
    if (ds && has(ds.name)) {
      if (!has(ds.title)) out.push('The dessert section has a dish but no title');
      if (!has(ds.price)) out.push(`${q(ds.name)} (dessert) has no price`);
    }
    return out;
  },
  happyhour(d) {
    const out: string[] = [];
    for (const s of d?.hh_specials ?? []) if (has(s.label) && !has(s.price)) out.push(`Happy hour special ${q(String(s.label).replace(/\n/g, ' '))} has no price`);
    priceless(d?.small_plates, (i) => has(i.price), 'small plates', out);
    priceless(d?.cocktails, (i) => has(i.hh_price) && has(i.reg_price), 'cocktails — needs both prices', out);
    priceless(d?.wines, (i) => has(i.glass_price) && has(i.bottle_price), 'wine — needs glass and bottle', out);
    priceless(d?.beers, (i) => has(i.price), 'beer', out);
    return out;
  },
  drinksdessert(d) {
    const out: string[] = [];
    priceless(d?.cocktails, (i) => has(i.price), 'Signature Cocktails', out);
    for (const [k, list] of Object.entries<Data[]>(d?.spirits ?? {})) priceless(list, (i) => has(i.price), k, out);
    for (const [k, list] of Object.entries<Data[]>(d?.liquori ?? {})) priceless(list, (i) => has(i.price), k, out);
    if (named(d?.spritz?.items) > 0 && !has(d?.spritz?.price)) out.push('The Spritz Menu price is missing');
    return out;
  },
  dessert(d) {
    const out: string[] = [];
    priceless(d?.dolci, (i) => has(i.price), 'Dolci', out);
    for (const [k, list] of Object.entries<Data[]>(d?.dopaCena ?? {})) priceless(list, (i) => has(i.price), k, out);
    return out;
  },
  privatedining(d) {
    const out: string[] = [];
    (d?.courses ?? []).forEach((c: Data, i: number) => untitled(c?.label, named(c?.dishes), `course ${i + 1}`, out));
    return out; // no prices on these menus (quoted per event)
  },
  arw(d) {
    const out: string[] = [];
    if (has(d?.cocktail?.name) && !has(d?.cocktail?.price)) out.push(`The featured cocktail ${q(d.cocktail.name)} has no price`);
    return out; // $50 prix fixe is fixed in the design; dish upcharges are optional by design
  },
  coursemenu(d) {
    const out: string[] = [];
    if (!has(d?.header)) out.push('The menu has no header (title)');
    if (!has(d?.price)) out.push('The prix fixe price is missing');
    (d?.courses ?? []).forEach((c: Data, i: number) => { if (!has(c?.title)) out.push(`Course ${i + 1} has no dish name`); });
    if (has(d?.addon?.title) && !has(d?.addon?.price)) out.push(`The add-on ${q(d.addon.title)} has no price`);
    return out;
  },
};

export function printWarnings(menu: PrintMenuId, data: Data): string[] {
  try { return CHECKS[menu](data); } catch { return []; }
}

export function printWarningMessage(warnings: string[]): string {
  return 'Heads up before printing:\n\n• ' + warnings.join('\n• ') + '\n\nPrint anyway?';
}

/** Editor side: true = go ahead and print. */
export function confirmPrintWarnings(menu: PrintMenuId, data: Data): boolean {
  const w = printWarnings(menu, data);
  return w.length === 0 || window.confirm(printWarningMessage(w));
}

/**
 * Route side: inject a guard right after <body> that wraps window.print() so
 * the first print attempt asks first. Skipped when the editor already asked
 * (&warned=1) and inside the editor's preview iframe (stale data there).
 */
export function withPrintGuard(html: string, requestUrl: string, warnings: string[]): string {
  if (!warnings.length || new URL(requestUrl).searchParams.get('warned') === '1') return html;
  const msg = JSON.stringify(printWarningMessage(warnings)).replace(/<\/script/gi, '<\\/script');
  const guard = `<script>(function(){if(window.top!==window)return;var p=window.print.bind(window),ok=null;` +
    `window.print=function(){if(ok===null)ok=window.confirm(${msg});if(ok)p();};})();</script>`;
  return html.replace(/<body[^>]*>/i, (m) => m + guard);
}
