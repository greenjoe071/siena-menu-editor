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

const DolciItemSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Name is required').max(L.name),
  price,
  desc:  z.string().min(1, 'Description is required').max(L.desc),
});

// ── Top-level: 4 cards. Spirits/DopaCena have FIXED subsections, each an
//    open-ended item array. Cocktails/Dolci are flat open-ended arrays. ──
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
  dolci: z.array(DolciItemSchema),
});

export type DrinksDessertMenuData = z.infer<typeof DrinksDessertMenuSchema>;
