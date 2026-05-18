import { z } from 'zod';

// ── Char limits — every cap is a HARD LIMIT (BUILD-SPEC §3) ──────────────
export const HH_CHAR_LIMITS = {
  hhSpecialPrice:    4,
  hhSpecialLabel:   22,
  smallPlateName:   28,
  smallPlatePrice:   4,
  smallPlateDesc:   48,
  cocktailName:     24,
  cocktailHhPrice:   3,
  cocktailRegPrice:  3,
  cocktailDesc:     48,
  floaterText:      40,
  floaterPrice:      3,
  wineName:         18,
  wineGlassPrice:    3,
  wineBottlePrice:   3,
  beerName:         18,
  beerPrice:         5,
  promoBody:        30,
  promoHeadline:    26,
} as const;

const L = HH_CHAR_LIMITS;

// ── Item schemas ──────────────────────────────────────────────────────────

const HhSpecialSchema = z.object({
  id:    z.string(),
  price: z.string().min(1).max(L.hhSpecialPrice),
  label: z.string().min(1).max(L.hhSpecialLabel),
});

const SmallPlateSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1).max(L.smallPlateName),
  price: z.string().min(1).max(L.smallPlatePrice),
  desc:  z.string().min(1).max(L.smallPlateDesc),
});

const CocktailSchema = z.object({
  id:           z.string(),
  name:         z.string().min(1).max(L.cocktailName),
  hh_price:     z.string().min(1).max(L.cocktailHhPrice),
  reg_price:    z.string().min(1).max(L.cocktailRegPrice),
  desc:         z.string().min(1).max(L.cocktailDesc),
  floater_text:  z.string().max(L.floaterText).optional().default(''),
  floater_price: z.string().max(L.floaterPrice).optional().default(''),
});

const WineSchema = z.object({
  id:           z.string(),
  name:         z.string().min(1).max(L.wineName),
  glass_price:  z.string().min(1).max(L.wineGlassPrice),
  bottle_price: z.string().min(1).max(L.wineBottlePrice),
});

const BeerSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1).max(L.beerName),
  price: z.string().min(1).max(L.beerPrice),
});

const PromoSchema = z.object({
  body:     z.string().min(1).max(L.promoBody),
  headline: z.string().min(1).max(L.promoHeadline),
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
