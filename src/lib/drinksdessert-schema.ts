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

// Dopa Cena: name + price, optional desc (available on any item).
const DopaCenaItemSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Name is required').max(L.name),
  price,
  desc:  z.string().max(L.desc).optional(),
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

// ── Top-level: 4 cards. Spirits/DopaCena have FIXED subsections, each an
//    open-ended item array. Cocktails/Spritz items are flat open-ended
//    arrays. Dolci is no longer part of this menu — it's its own standalone
//    insert now; see drinksdessert-dolci-archive.json for the archived data. ──
export const DrinksDessertMenuSchema = z.object({
  cocktails: z.array(CocktailSchema),
  spirits: z.object({
    bourbon: z.array(SpiritItemSchema),
    scotch:  z.array(SpiritItemSchema),
    beer:    z.array(SpiritItemSchema),
  }),
  dopaCena: z.object({
    digestivo:          z.array(DopaCenaItemSchema),
    grappa:             z.array(DopaCenaItemSchema),
    ports:              z.array(DopaCenaItemSchema),
    cognac:             z.array(DopaCenaItemSchema),
    traditionalItalian: z.array(DopaCenaItemSchema),
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
