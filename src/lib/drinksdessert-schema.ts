import { z } from 'zod';

// ── Soft sanity caps (loose paste guards only — validate.js is the real
//    fit authority; item counts are open-ended) ──────────────────────────
export const DRINKSDESSERT_CHAR_LIMITS = {
  name:  60,
  desc: 200,
  note: 200,
  price: 10,
} as const;

const L = DRINKSDESSERT_CHAR_LIMITS;

// Prices are stored WITHOUT the $ glyph ("13.00", "11"). The renderer
// prepends $. Allow digits and one optional decimal point.
const price = z.string().min(1, 'Price is required').max(L.price);

// ── Items ────────────────────────────────────────────────────────────────
const CocktailSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Name is required').max(L.name),
  desc:  z.string().min(1, 'Description is required').max(L.desc),
  price,
  note:  z.string().max(L.note).optional(),   // optional italic upsell line
});

// Spirits: name + price only (no desc, by design).
const SpiritItemSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Name is required').max(L.name),
  price,
});

// Liquori: name + price only (no description, same as Spirits & Beer).
// Curated by hand, not open-ended editor input — see BUILD-SPEC.md §1c.
const LiquoriItemSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Name is required').max(L.name),
  price,
});

// Spritz: shared by both designs — see BUILD-SPEC.md §1a. Design A ignores
// `category`; Design B groups by it. Every item still requires a category
// so switching to Design B never surprises the manager with an unsorted item.
const SpritzCategorySchema = z.enum(['bright', 'herbal', 'earthy']);
const SpritzItemSchema = z.object({
  id:       z.string(),
  name:     z.string().min(1, 'Name is required').max(L.name),
  desc:     z.string().min(1, 'Description is required').max(L.desc),
  category: SpritzCategorySchema,
});

// ── Top-level: 4 cards. Spirits/Liquori have FIXED subsections/categories,
//    each an item array (Spirits open-ended; Liquori curated by hand, see
//    BUILD-SPEC.md §1c). Cocktails/Spritz items are flat open-ended arrays.
//    Dolci is no longer part of this menu — it's its own standalone insert
//    now; see drinksdessert-dolci-archive.json for the archived data. Dopa
//    Cena was replaced by Liquori (Aug 2026); see
//    drinksdessert-dopacena-archive.json for the archived data. ──
export const DrinksDessertMenuSchema = z.object({
  cocktails: z.array(CocktailSchema),
  spirits: z.object({
    bourbon: z.array(SpiritItemSchema),
    scotch:  z.array(SpiritItemSchema),
    beer:    z.array(SpiritItemSchema),
  }),
  liquori: z.object({
    tequila: z.array(LiquoriItemSchema),
    gin:     z.array(LiquoriItemSchema),
    vodka:   z.array(LiquoriItemSchema),
    rum:     z.array(LiquoriItemSchema),
  }),
  spritz: z.object({
    price:   price,
    design:  z.enum(['a', 'b']),
    // Controls the small "new" kicker above the Spritz Menu title — not in
    // the original handoff, added per owner request so it can be retired
    // once the page stops being new. Defaults true (matches current seed).
    showNew: z.boolean().default(true),
    // Owner-editable tagline under the price ("every spritz is topped
    // with..."). This cap is a loose paste-guard only — the real "must
    // stay on one line" enforcement is validate.js's isTaglineWrapped(),
    // which measures the actual rendered line count in a real browser.
    tagline: z.string().min(1, 'Tagline is required').max(90),
    items:   z.array(SpritzItemSchema),
  }),
});

export type DrinksDessertMenuData = z.infer<typeof DrinksDessertMenuSchema>;
