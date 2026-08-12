import { z } from 'zod';

// ── Soft sanity caps (loose paste guards only — validate.js is the real
//    fit authority; item count is open-ended) ─────────────────────────────
export const DESSERT_CHAR_LIMITS = {
  name:  60,
  desc: 200,
  price: 10,
  sub:  100,
} as const;

const L = DESSERT_CHAR_LIMITS;

// Prices are stored WITHOUT the $ glyph ("11.00", "8"). The renderer never
// prepends $ on this menu — see handoff-dessert/BUILD-SPEC.md §4.
const price = z.string().min(1, 'Price is required').max(L.price);

// Dolci: every field is required on every item — no optional note/desc.
const DolciItemSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Name is required').max(L.name),
  desc:  z.string().min(1, 'Description is required').max(L.desc),
  price,
});

// Dopa Cena: name + price required, optional one-line `sub` note (e.g. a
// grappa's producing region) available on any item, any subsection.
const DopaCenaItemSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Name is required').max(L.name),
  price,
  sub:   z.string().max(L.sub).optional(),
});

// Two different physical cards sharing one 8.5×11 sheet (Dolci left, Dopa
// Cena right) — not two identical copies of one card anymore. Dopa Cena
// moved here from the Drinks Menu when Liquori replaced it there.
export const DessertMenuSchema = z.object({
  dolci: z.array(DolciItemSchema),
  dopaCena: z.object({
    digestivo:          z.array(DopaCenaItemSchema),
    grappa:              z.array(DopaCenaItemSchema),
    ports:               z.array(DopaCenaItemSchema),
    cognac:              z.array(DopaCenaItemSchema),
    traditionalItalian:  z.array(DopaCenaItemSchema),
  }),
});

export type DessertMenuData = z.infer<typeof DessertMenuSchema>;
