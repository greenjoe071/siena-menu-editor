'use client';

import { useRef } from 'react';
import type { PrintVariant } from './MenuLanding';

// A dropdown + "Print" button for menus with more than one print option
// (e.g. Drinks & Dessert's full-menu / by-sheet / single-page choices).
// Client component because the selected option only matters at click time.
export default function PrintPicker({
  printHref, src, variants, size,
}: {
  printHref: string;
  src: string;
  variants: PrintVariant[];
  size: 'solid' | 'small';
}) {
  const selectRef = useRef<HTMLSelectElement>(null);

  function go() {
    const q = selectRef.current?.value ?? '';
    window.open(`${printHref}?src=${src}${q}`, '_blank', 'noopener,noreferrer');
  }

  // Group variants by their optional `group` label, preserving first-seen order.
  const groups = new Map<string, PrintVariant[]>();
  for (const v of variants) {
    const g = v.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(v);
  }

  const selectCls = size === 'solid' ? 'dl-print-select' : 'dl-print-select dl-print-select--small';
  const btnCls = size === 'solid' ? 'dl-btn dl-btn--solid' : 'dl-btn dl-btn--small';

  return (
    <div className="dl-print-picker">
      <select ref={selectRef} className={selectCls} defaultValue={variants[0]?.query ?? ''}>
        {[...groups.entries()].map(([g, opts]) =>
          g ? (
            <optgroup key={g} label={g}>
              {opts.map((v) => <option key={v.label} value={v.query ?? ''}>{v.label}</option>)}
            </optgroup>
          ) : (
            opts.map((v) => <option key={v.label} value={v.query ?? ''}>{v.label}</option>)
          )
        )}
      </select>
      <button type="button" className={btnCls} onClick={go}>Print</button>
    </div>
  );
}
