import { z } from 'zod';

// ── Char limits (mirrors BUILD-SPEC.md) ───────────────────────────────────
// Horizontal one-line fields keep hard caps; descriptions are ladder-governed
// (auto-fit via settle.js) and only have a loose sanity guard.
export const WEEKEND_CHAR_LIMITS = {
  sectionTitle:    20,
  dishName:        26,   // hard — shares row with inline price
  dishDesc:       180,   // soft guard only — ladder absorbs vertical growth (editor counter)
  dishDescMax:    400,   // paste-safety ceiling only; BUILD-SPEC: descriptions have no hard cap
  dishPrice:        8,   // hard — required, include $ glyph: "$17"
  weeklyDayLabel:  14,
  weeklyHeadline:  26,
  weeklyDetail:   110,
  policyLine:     120,
} as const;

// ── Dish ──────────────────────────────────────────────────────────────────
const WeekendDishSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Dish name is required').max(WEEKEND_CHAR_LIMITS.dishName),
  desc:  z.string().min(1, 'Description is required').max(WEEKEND_CHAR_LIMITS.dishDescMax),
  price: z.string().min(1, 'Price is required').max(WEEKEND_CHAR_LIMITS.dishPrice),
});

// ── Course section ────────────────────────────────────────────────────────
// v2 (Oct 2026): `subtitle` removed from the design + data model. Old saved
// JSON that still has it parses fine — zod strips unknown keys.
const WeekendSectionSchema = z.object({
  title:    z.string().min(1).max(WEEKEND_CHAR_LIMITS.sectionTitle),
  items:    z.array(WeekendDishSchema).min(1).max(4),
});

// ── Weekly row ────────────────────────────────────────────────────────────
const WeeklyRowSchema = z.object({
  id:        z.string(),
  day_label: z.string().min(1).max(WEEKEND_CHAR_LIMITS.weeklyDayLabel),
  headline:  z.string().min(1).max(WEEKEND_CHAR_LIMITS.weeklyHeadline),
  detail:    z.string().min(1).max(WEEKEND_CHAR_LIMITS.weeklyDetail),
});

// ── Dessert (optional whole-section) ─────────────────────────────────────
const WeekendDessertSchema = z.object({
  title: z.string().min(1).max(WEEKEND_CHAR_LIMITS.sectionTitle),
  name:  z.string().min(1).max(WEEKEND_CHAR_LIMITS.dishName),
  desc:  z.string().min(1).max(WEEKEND_CHAR_LIMITS.dishDescMax),
  price: z.string().min(1).max(WEEKEND_CHAR_LIMITS.dishPrice),
});

// ── Top-level schema ──────────────────────────────────────────────────────
export const WeekendMenuSchema = z.object({
  sections: z.object({
    starters: WeekendSectionSchema,
    entrees:  WeekendSectionSchema,
  }),
  dessert: WeekendDessertSchema.nullable().optional(),
  // v2: `weekly.title` removed ("Throughout the Week at Siena" no longer shown).
  weekly: z.object({
    rows:  z.array(WeeklyRowSchema).length(4),
  }),
  policy_line: z.string().min(1).max(WEEKEND_CHAR_LIMITS.policyLine),
});

export type WeekendMenuData = z.infer<typeof WeekendMenuSchema>;

// ── Draft (work in progress) ──────────────────────────────────────────────
// Same shape and caps, but every text field may be blank, so a half-typed
// menu autosaves instead of being rejected (Oct 2026: Chef lost a whole
// menu this way — Print showed his unsaved typing, so nothing looked wrong).
// Publishing still requires the full WeekendMenuSchema.
const L = WEEKEND_CHAR_LIMITS;
const DraftDish = z.object({
  id: z.string(), name: z.string().max(L.dishName), desc: z.string().max(L.dishDescMax), price: z.string().max(L.dishPrice),
});
export const WeekendDraftSchema = z.object({
  sections: z.object({
    starters: z.object({ title: z.string().max(L.sectionTitle), items: z.array(DraftDish).min(1).max(4) }),
    entrees:  z.object({ title: z.string().max(L.sectionTitle), items: z.array(DraftDish).min(1).max(4) }),
  }),
  dessert: z.object({
    title: z.string().max(L.sectionTitle), name: z.string().max(L.dishName),
    desc: z.string().max(L.dishDescMax), price: z.string().max(L.dishPrice),
  }).nullable().optional(),
  weekly: z.object({
    rows: z.array(z.object({
      id: z.string(), day_label: z.string().max(L.weeklyDayLabel),
      headline: z.string().max(L.weeklyHeadline), detail: z.string().max(L.weeklyDetail),
    })).length(4),
  }),
  policy_line: z.string().max(L.policyLine),
}) as unknown as typeof WeekendMenuSchema;
