import { z } from 'zod';

// ── Loose sanity caps — not the primary validation ────────────────────────
// The authoritative check is the page-fit validator (validate.js) running in
// a real browser. These caps only stop someone from pasting a paragraph.
// See BUILD-SPEC §0 and CHANGES-v2.md for the full explanation.

const HhSpecialSchema = z.object({
  id:    z.string(),
  price: z.string().min(1).max(8),   // stored as "$4", "$10"
  label: z.string().min(1).max(60),  // may contain \n for two-line labels
});

const SmallPlateSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1).max(60),
  price: z.string().min(1).max(8),   // stored as "$6", "$10"
  desc:  z.string().min(1).max(240),
});

const CocktailSchema = z.object({
  id:        z.string(),
  name:      z.string().min(1).max(60),
  hh_price:  z.string().min(1).max(8),   // stored as "$10"
  reg_price: z.string().min(1).max(8),   // stored as "$13"
  desc:      z.string().min(1).max(240),
  floater:   z.string().max(120).default(''), // single string; empty = no floater
});

const WineSchema = z.object({
  id:           z.string(),
  name:         z.string().min(1).max(60),
  glass_price:  z.string().min(1).max(6),  // digits only, design omits $
  bottle_price: z.string().min(1).max(6),  // digits only, design omits $
});

const BeerSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1).max(60),
  price: z.string().min(1).max(8),  // digits+decimal, e.g. "6.50"
});

const PromoSchema = z.object({
  eyebrow:  z.string().min(1).max(80), // was "body" in v1
  headline: z.string().min(1).max(80),
});

// ── Top-level schema ──────────────────────────────────────────────────────

export const HappyhourMenuSchema = z.object({
  hh_specials:  z.array(HhSpecialSchema).length(5),
  small_plates: z.array(SmallPlateSchema).length(10),
  cocktails:    z.array(CocktailSchema).length(8),
  wines:        z.array(WineSchema).length(8),
  beers:        z.array(BeerSchema).length(10),
  promo:        PromoSchema,
});

export type HappyhourMenuData = z.infer<typeof HappyhourMenuSchema>;
