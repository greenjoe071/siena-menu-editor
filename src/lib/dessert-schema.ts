import { z } from 'zod';

// ── Soft sanity caps (loose paste guards only — validate.js is the real
//    fit authority; item count is open-ended) ─────────────────────────────
export const DESSERT_CHAR_LIMITS = {
  name:  60,
  desc: 200,
  price: 10,
} as const;

const L = DESSERT_CHAR_LIMITS;

// Prices are stored WITHOUT the $ glyph ("11.00", "8"). The renderer never
// prepends $ on this card — see handoff-dessert/BUILD-SPEC.md §4.
const price = z.string().min(1, 'Price is required').max(L.price);

// Every field is required on every item — no optional note/desc, unlike
// Cocktails/Dopa Cena on the Drinks Menu.
const DessertItemSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Name is required').max(L.name),
  desc:  z.string().min(1, 'Description is required').max(L.desc),
  price,
});

export const DessertMenuSchema = z.object({
  desserts: z.array(DessertItemSchema),
});

export type DessertMenuData = z.infer<typeof DessertMenuSchema>;
