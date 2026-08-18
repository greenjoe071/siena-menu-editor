# Siena — Austin Restaurant Weeks $50 Dinner Menu (developer handoff)

## Quickstart

```html
<script src="render.js"></script>
<script src="validate.js"></script>
<script>
  fetch('menu-data.json').then(r => r.json()).then(data => {
    SienaARWRender.render(document, data);
  });
</script>
```

Or server-side:

```js
const { render } = require('./render.js');
render(someJsdomOrLinkedomDocument, data);
```

## What this is

A single 8.5&times;11in printed page: three fixed-choice courses (Antipasti / Entr&eacute;e / Dolci), a $50 price, and Central Texas Food Bank branding, for Siena's Austin Restaurant Weeks participation (Aug 28&ndash;Sep 13, 2026).

Read **BUILD-SPEC.md** before wiring this into the editor — it has the full data shape, the editable-field list, the course-removal reflow rules, and the validator contract. In short:

- Only the course subtitle and the 16 dish slots' `name` / `desc` / `upcharge` are editable. Everything else is frozen.
- No new dishes can be added — 5 Antipasti + 8 Entr&eacute;e + 3 Dolci slots are fixed. A slot can be cleared (removed) or edited; `render.js` reflows the grid automatically when a slot is cleared.
- `subtitle` and every dish `name` must render on exactly 1 line; every `desc` on at most 2. `validate.js` is the authoritative check — call it after every edit and block Save on `!report.fits`.

## Files

See §8 of BUILD-SPEC.md for the full file index.
