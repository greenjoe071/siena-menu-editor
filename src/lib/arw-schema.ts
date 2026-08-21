import { z } from 'zod';

// ── Paste-safety caps (loose guards only — validate.js's line-count +
//    page-fit check is the authoritative constraint) ───────────────────────
export const ARW_CHAR_LIMITS = {
  subtitle:      45,
  name:          40,
  desc:          140,
  upcharge:      3,
  cocktailName:  40,
  cocktailDesc:  140,
  cocktailPrice: 3,
} as const;

const L = ARW_CHAR_LIMITS;

// Standing owner direction on all Siena menu copy — see BUILD-SPEC §7/§9.
const BANNED_WORD = /extravaganza/i;

function noBannedWord(v: string, ctx: z.RefinementCtx, path: (string | number)[]) {
  if (BANNED_WORD.test(v)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${v}" contains a banned word ("extravaganza")`, path });
  }
}

// ── Item slot ─────────────────────────────────────────────────────────────
// Cardinality is fixed and slot-matched by `id`, never by array position —
// the editor must not let ids be added, removed, or reordered. Clearing
// `name` to empty is the only supported "remove"; render.js reflows the
// grid automatically (see BUILD-SPEC §3).
const ArwItemSchema = z.object({
  id:       z.string(),
  name:     z.string().max(L.name),
  desc:     z.string().max(L.desc),
  upcharge: z.string().max(L.upcharge),
});

export type ArwItem = z.infer<typeof ArwItemSchema>;

// Featured cocktail — all three fields optional; clearing `name` hides the
// whole block, clearing just `price` hides only the price (see BUILD-SPEC §5).
const ArwCocktailSchema = z.object({
  name:  z.string().max(L.cocktailName),
  desc:  z.string().max(L.cocktailDesc),
  price: z.string().max(L.cocktailPrice), // digits only, enforced in the UI (like an upcharge)
});

export type ArwCocktail = z.infer<typeof ArwCocktailSchema>;

const ANTIPASTI_IDS = ['antipasti-1', 'antipasti-2', 'antipasti-3', 'antipasti-4', 'antipasti-5'] as const;
const ENTREE_IDS    = ['entree-1', 'entree-2', 'entree-3', 'entree-4', 'entree-5', 'entree-6', 'entree-7', 'entree-8'] as const;
const DOLCI_IDS      = ['dolci-1', 'dolci-2', 'dolci-3'] as const;

function courseSchema(count: number) {
  return z.object({ items: z.array(ArwItemSchema).length(count) });
}

// ── Top-level schema ──────────────────────────────────────────────────────
export const ArwMenuSchema = z.object({
  subtitle: z.string().max(L.subtitle),
  cocktail: ArwCocktailSchema,
  courses: z.object({
    antipasti: courseSchema(5),
    entree:    courseSchema(8),
    dolci:     courseSchema(3),
  }),
}).superRefine((data, ctx) => {
  noBannedWord(data.subtitle, ctx, ['subtitle']);
  noBannedWord(data.cocktail.name, ctx, ['cocktail', 'name']);
  noBannedWord(data.cocktail.desc, ctx, ['cocktail', 'desc']);
  (['antipasti', 'entree', 'dolci'] as const).forEach((courseKey) => {
    data.courses[courseKey].items.forEach((item, i) => {
      noBannedWord(item.name, ctx, ['courses', courseKey, 'items', i, 'name']);
      noBannedWord(item.desc, ctx, ['courses', courseKey, 'items', i, 'desc']);
    });
  });
});

export type ArwMenuData = z.infer<typeof ArwMenuSchema>;

export const ARW_IDS = { antipasti: ANTIPASTI_IDS, entree: ENTREE_IDS, dolci: DOLCI_IDS };
