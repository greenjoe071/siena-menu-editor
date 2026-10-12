# Siena Tuesday/Wednesday Prix-Fixe — Developer Handoff

A weekly-rotating, **fixed 3-course $45 prix-fixe** offered Tuesday and Wednesday at Siena Ristorante Toscana. This package is the developer handoff for the editor and print system — one designer file, one renderer, one snapshot test.

> **Read [`BUILD-SPEC.md`](./BUILD-SPEC.md) for the full data model, character caps, optional-field rules, and editor UI sketch.** This README is the quickstart.

---

## Files

| File | Purpose |
|---|---|
| `template.html` | Frozen menu layout with `data-*` hooks. Open directly in a browser to see the page chrome. |
| `render.js` | UMD module — `SienaTuewedRender.render(document, data)`. Mutates the DOM in place. |
| `menu-data.json` | Realistic seed data — drop-in starting point. |
| `expected-render.html` | Snapshot baseline = `render(template, menu-data.json)`. |
| `snapshot-test.spec.js` | Vitest test that runs the renderer in JSDOM and diffs against the baseline. |
| `BUILD-SPEC.md` | Full developer spec. |
| `fonts/` | Self-hosted Playfair Display variable + italic variable. |

---

## 30-second integration

```html
<!-- Browser -->
<script src="render.js"></script>
<script>
  fetch('menu-data.json').then(r => r.json()).then(data => {
    fetch('template.html').then(r => r.text()).then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      SienaTuewedRender.render(doc, data);
      document.replaceChild(
        doc.documentElement,
        document.documentElement
      );
    });
  });
</script>
```

```js
// Node / server-side
const { JSDOM } = require('jsdom');
const { readFileSync } = require('node:fs');

const template = readFileSync('template.html', 'utf8');
const data = JSON.parse(readFileSync('menu-data.json', 'utf8'));

// Load the UMD module — works because render.js exports via module.exports
const SienaTuewedRender = require('./render.js');

const dom = new JSDOM(template);
SienaTuewedRender.render(dom.window.document, data);

const html = '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML;
```

The global export name is **`SienaTuewedRender`** — this exact name is required for the snapshot test to find it.

---

## Run the snapshot test

```bash
npm install --save-dev vitest jsdom
npx vitest run snapshot-test.spec.js
```

The test:
1. Loads `template.html`, `render.js`, `menu-data.json`, and `expected-render.html` from this folder.
2. Evaluates `render.js` via `new Function('module', 'self', src)(mod, fakeRoot)` and resolves the renderer from either `module.exports` or `fakeRoot.SienaTuewedRender` — both work.
3. Renders the template against the seed data inside JSDOM.
4. Asserts the rendered HTML byte-equals `expected-render.html`.

A failing test almost always means the renderer's output drifted from the baseline. To re-baseline:

1. Edit `template.html` / `menu-data.json` / `render.js` intentionally.
2. Re-render and overwrite `expected-render.html` with the new output.
3. Commit all four files together. The test passes again.

---

## Data shape at a glance

```jsonc
{
  "price": "45",                          // digits only — "$" is static
  "courses": [
    { "id": "course-1", "title": "…", "desc": "…" },
    { "id": "course-2", "title": "…", "desc": "…" },
    { "id": "course-3", "title": "…", "desc": "…" }
  ],
  "addon": {                              // optional add-on slot
    "title": "Wine Pairing",
    "desc":  "Three wines, one per course, chosen by the floor",
    "price": "25"                          // digits only — "Add $" is static
  },
  "policy_line": "<strong>…</strong>"     // optional, allows HTML
}
```

**Cardinality is fixed** — always 3 courses, ids `course-1`, `course-2`, `course-3`. The editor must not let the user add or remove courses. See [`BUILD-SPEC.md`](./BUILD-SPEC.md) §3 for character caps and the full editor UI sketch.

---

## Optional-field behaviour

| Empty / missing | What the renderer does |
|---|---|
| `addon.title` | Removes the entire add-on block (the "no add-on this week" toggle). |
| `addon.price` (title set) | Removes the `Add $XX` pill; title row stays. |
| `addon.desc` (title set) | Removes the small caps note line; title row stays. |
| `policy_line` | Removes the entire footnotes block. |

Everything else is required.

---

## What is **not** editable

Restaurant chrome, the `$` and `Add $` prefixes, Roman numerals `I` / `II` / `III`, the subtitle `Suggestioni del Capo Cuoco · Prix Fixe`, the "Throughout the Week at Siena" footer grid (four cells about *other nights'* specials), the typography, the colors, and the page padding — all baked into `template.html`. See [`BUILD-SPEC.md`](./BUILD-SPEC.md) §5.
