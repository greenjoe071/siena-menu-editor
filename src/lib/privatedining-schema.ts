import { z } from 'zod';

// ── Soft sanity caps (loose paste guards — validate.js is the real fit
//    authority for the base menu; the 2-item alternate cap is enforced
//    structurally below, not just by length) ────────────────────────────────
export const PRIVATEDINING_CHAR_LIMITS = {
  menuLabel: 40,
  priceRef: 10,
  courseLabel: 60,
  dishName: 80,
  dishDesc: 220,
  alternateName: 60,
} as const;

const L = PRIVATEDINING_CHAR_LIMITS;

export const PRIVATEDINING_MENU_IDS = ['san-gimignano', 'firenze', 'siena'] as const;
export type PrivateDiningMenuId = (typeof PRIVATEDINING_MENU_IDS)[number];

// ── Dishes / courses (the default menu content — protected via draft/publish) ──
const DishSchema = z.object({
  name: z.string().min(1, 'Dish name is required').max(L.dishName),
  desc: z.string().max(L.dishDesc).optional().default(''),
});

const CourseSchema = z.object({
  label: z.string().min(1, 'Course label is required').max(L.courseLabel),
  dishes: z.array(DishSchema),
});

// label/internalPriceRef are EDITOR-ONLY identifiers (which menu, what to
// quote) — never rendered on the printed page. See handoff-privatedining/BUILD-SPEC.md.
export const PrivateDiningMenuSchema = z.object({
  label: z.string().min(1).max(L.menuLabel),
  internalPriceRef: z.string().max(L.priceRef),
  courses: z.array(CourseSchema),
});
export type PrivateDiningMenuData = z.infer<typeof PrivateDiningMenuSchema>;

// ── Alternates (a named, saved library per menu — NOT draft/publish-protected;
//    editing/adding/removing an alternate never touches the live default) ──
const ExtraItemSchema = z.object({
  courseIndex: z.number().int().min(0),
  name: z.string().min(1, 'Dish name is required').max(L.dishName),
  desc: z.string().max(L.dishDesc).optional().default(''),
});

export const AlternateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Alternate name is required').max(L.alternateName),
  extraItems: z.array(ExtraItemSchema).max(2, 'An alternate may carry at most 2 extra items total'),
});
export type PrivateDiningAlternate = z.infer<typeof AlternateSchema>;

export const AlternatesListSchema = z.array(AlternateSchema);
export type PrivateDiningAlternatesList = z.infer<typeof AlternatesListSchema>;

// ── Print-time-only fields — entered fresh per event, never stored as part
//    of a menu or alternate. See BUILD-SPEC.md "eventFields". ─────────────
export const PrintEventFieldsSchema = z.object({
  eventTitle: z.string().max(120),
  eventDate: z.string().max(60),
  logoUrl: z.string().nullable().optional(),
});
export type PrintEventFields = z.infer<typeof PrintEventFieldsSchema>;
