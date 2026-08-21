# Siena — Austin Restaurant Weeks $50 Dinner Menu (developer handoff)

## Quickstart

Two interchangeable templates, one shared dataset and renderer:

```html
<!-- either template.html (Two-Column Classic) or template-left-aligned.html (Left-Aligned) -->
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

The editor must let the manager pick a style **before** showing any edit UI — there's no default. Whichever template file is mounted, the same `menu-data.json` shape renders correctly into it via the same `render()`/`validate()` calls.

## What this is

A single 8.5&times;11in printed page, in either of two styles: three fixed-choice courses (Antipasti / Entr&eacute;e / Dolci), a $50 price, one featured cocktail, and Central Texas Food Bank branding, for Siena's Austin Restaurant Weeks participation (Aug 28&ndash;Sep 13, 2026).

Read **BUILD-SPEC.md** before wiring this into the editor — it has the full data shape, the editable-field list, the two-template contract, the course-removal reflow rules, the orphan-line-fix behavior, and the validator contract. In short:

- Only the subtitle, the featured cocktail (`name`/`desc`/`price`), and the 16 dish slots' `name`/`desc`/`upcharge` are editable. Everything else is frozen, in both styles.
- No new dishes can be added — 5 Antipasti + 8 Entr&eacute;e + 3 Dolci slots are fixed. A slot can be cleared (removed) or edited; `render.js` reflows automatically when a slot is cleared, on either template.
- Clearing the cocktail's `name` hides the entire featured-cocktail block; clearing just its `price` hides only the price.
- `subtitle`, `cocktail.name`, and every dish `name` must render on exactly 1 line; `cocktail.desc` and every dish `desc` on at most 2. `validate.js` is the authoritative check — call it after every edit, against whichever template is open, and block Save on `!report.fits`.

## Files

See §8 of BUILD-SPEC.md for the full file index.
