import type { Problem } from '@/components/ProblemPopup';

// ══════════════════════════════════════════════════════════════════════════
// Shared "Is this on purpose?" checks for lists of dishes (Oct 2026).
// ══════════════════════════════════════════════════════════════════════════
// Same ideas as the old grey print box (print-warnings.ts), reworded for the
// big pop-up. red (serious) = likely a mistake; the rest = maybe on purpose.
// Each menu's editor turns its data into CheckItems and adds its own checks.

// "$18", "18", "6.50", "$1,200", "MP" / "Market Price" are fine.
export const PRICE_OK = /^\$?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\$?\d+(\.\d{1,2})?$|^(mp|market price)$/i;

export interface CheckItem {
  id: string;                 // stable (dish id) — used in problem keys
  name: string;
  desc?: string;
  /** Prices this item must have (empty array = this list has no prices). */
  prices: string[];
  /** Also flag a missing description (normal). */
  wantDesc?: boolean;
  target?: string;            // data-problem of the row to jump to
}

const has = (v: unknown) => typeof v === 'string' && v.trim() !== '';
const q = (s: string) => `“${s.trim()}”`;

/** One list of dishes (a section, a card, a course). */
export function listChecks(items: CheckItem[], where: string, listKey: string): Problem[] {
  const out: Problem[] = [];
  const styles: { name: string; dollar: boolean }[] = [];
  for (const it of items) {
    const prices = it.prices.map((p) => (p ?? '').trim());
    if (!has(it.name)) {
      if (prices.some(Boolean) || has(it.desc)) out.push({
        key: `${it.id}-noname`, target: it.target, serious: true,
        title: `A dish in ${where} has ${has(it.desc) ? 'a description' : 'a price'} but no name.`,
        body: 'It will print with no name.',
      });
      continue;
    }
    const name = it.name.trim();
    if (prices.length && prices.some((p) => !p)) out.push({
      key: `${it.id}-noprice`, target: it.target,
      title: `${q(name)} (${where}) has no price.`, body: 'It will print without one.',
    });
    for (const p of prices) {
      if (!p) continue;
      if (!PRICE_OK.test(p)) out.push({
        key: `${it.id}-oddprice-${p}`, target: it.target,
        title: `${q(name)} has an odd-looking price: ${q(p)}.`, body: 'Check it’s typed right.',
      });
      else if (/\d/.test(p)) styles.push({ name, dollar: p.startsWith('$') });
    }
    if (it.wantDesc && !has(it.desc)) out.push({
      key: `${it.id}-nodesc`, target: it.target,
      title: `${q(name)} (${where}) has no description.`, body: 'Only the name will print.',
    });
  }
  const withD = styles.filter((s) => s.dollar), without = styles.filter((s) => !s.dollar);
  if (withD.length && without.length) {
    const odd = withD.length >= without.length ? without : withD;
    out.push({
      key: `${listKey}-mixed-dollar`, target: items[0]?.target,
      title: `Prices in ${where} mix “$18” and “18” styles.`,
      body: `Check ${odd.slice(0, 3).map((s) => q(s.name)).join(', ')}.`,
    });
  }
  return out;
}

/** The same dish name more than once on one menu (normal). */
export function duplicateChecks(names: { name: string; target?: string }[]): Problem[] {
  const seen = new Map<string, { n: number; name: string; target?: string }>();
  for (const x of names) {
    if (!has(x.name)) continue;
    const k = x.name.trim().toLowerCase();
    const e = seen.get(k);
    if (e) e.n++; else seen.set(k, { n: 1, name: x.name.trim(), target: x.target });
  }
  const out: Problem[] = [];
  for (const [k, e] of seen) if (e.n > 1) out.push({
    key: `dup-${k}`, target: e.target,
    title: `${q(e.name)} is listed ${e.n === 2 ? 'twice' : `${e.n} times`}.`, body: 'Check whether that’s on purpose.',
  });
  return out;
}

/** A section/card that has dishes showing but no title (red). */
export function untitledCheck(title: string, hasDishes: boolean, label: string, key: string, target?: string): Problem[] {
  return hasDishes && !has(title) ? [{
    key: `${key}-notitle`, target, serious: true,
    title: `The ${label} section has dishes but no title.`, body: 'Its heading will print blank.',
  }] : [];
}
