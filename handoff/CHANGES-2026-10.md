# Spring Menu — October 2026 update (CSS + 1 static div only)

**Scope:** Only the Non-Alcoholic Beverages box (`.drinks-panel`) on page 3 changed.
**No changes to:** `render.js`, `menu-data.json`, `snapshot-test.spec.mjs`, the data model, DOM hooks, fonts, or images.

## What to do
1. Replace `template.html` and `expected-render.html` with the versions in this zip.
2. Run the existing snapshot test — it should pass with no other changes.

## What changed (both files, identical edits)

**1. `.drinks-panel`** — border gold → red, a bit taller, positioned for the diamonds:
```css
border: 1.25pt solid #7a1712;   /* was #b8821e */
padding: 13pt 14pt 9pt;         /* was 10pt 14pt 6pt */
position: relative;             /* new */
```

**2. New:** red diamonds centered on the left and right borders:
```css
.drinks-panel::before, .drinks-panel::after {
  content: ""; position: absolute; top: 50%;
  width: 7pt; height: 7pt; background: #7a1712;
  box-shadow: 0 0 0 2.5pt #fff;
  transform: translate(-50%, -50%) rotate(45deg);
}
.drinks-panel::before { left: -0.625pt; }
.drinks-panel::after  { left: calc(100% + 0.625pt); }
```

**3. Title + rule colors → red `#7a1712`:**
- `.drinks-panel .section-head .section-title` color
- `.drinks-panel .section-head .section-rule` background
- `.subsection-head .subsection-rule` background

**4. "Mocktails" now matches "Non-Alcoholic Beverages"** — `.subsection-head .subsection-title`:
```css
font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 9pt;
letter-spacing: 0.18em; text-transform: uppercase; color: #7a1712;
white-space: nowrap;
/* removed: Playfair italic 600, 11.5pt, letter-spacing 0.02em */
```

**5. Markup — "Non-Alcoholic Beverages" is now centered.** One static rule div was added before the title:
```html
<div class="section-head" data-section-id="non-alcoholic">
  <div class="section-rule"></div>   <!-- NEW -->
  <span class="section-title" data-section-title-for="non-alcoholic">Non-Alcoholic Beverages</span>
  <div class="section-rule"></div>
</div>
```
`render.js` doesn't touch this element, so it needs no changes.
