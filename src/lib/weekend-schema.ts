import { z } from 'zod';

// ── Char limits (mirrors BUILD-SPEC.md) ───────────────────────────────────
// Horizontal one-line fields keep hard caps; descriptions are ladder-governed
// (auto-fit via settle.js) and only have a loose sanity guard.
export const WEEKEND_CHAR_LIMITS = {
  sectionTitle:    20,
  sectionSubtitle: 16,
  dishName:        26,   // hard — shares row with inline price
  dishDesc:       180,   // soft guard only — ladder absorbs vertical growth
  dishPrice:        8,   // hard — required, include $ glyph: "$17"
  weeklyTitle:     42,
  weeklyDayLabel:  14,
  weeklyHeadline:  26,
  weeklyDetail:   110,
  policyLine:     120,
} as const;

// ── Dish ──────────────────────────────────────────────────────────────────
const WeekendDishSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Dish name is required').max(WEEKEND_CHAR_LIMITS.dishName),
  desc:  z.string().min(1, 'Description is required').max(WEEKEND_CHAR_LIMITS.dishDesc),
  price: z.string().min(1, 'Price is required').max(WEEKEND_CHAR_LIMITS.dishPrice),
});

// ── Course section ────────────────────────────────────────────────────────
const WeekendSectionSchema = z.object({
  title:    z.string().min(1).max(WEEKEND_CHAR_LIMITS.sectionTitle),
  subtitle: z.string().min(1).max(WEEKEND_CHAR_LIMITS.sectionSubtitle),
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
  desc:  z.string().min(1).max(WEEKEND_CHAR_LIMITS.dishDesc),
  price: z.string().min(1).max(WEEKEND_CHAR_LIMITS.dishPrice),
});

// ── Top-level schema ──────────────────────────────────────────────────────
export const WeekendMenuSchema = z.object({
  sections: z.object({
    starters: WeekendSectionSchema,
    entrees:  WeekendSectionSchema,
  }),
  dessert: WeekendDessertSchema.nullable().optional(),
  weekly: z.object({
    title: z.string().min(1).max(WEEKEND_CHAR_LIMITS.weeklyTitle),
    rows:  z.array(WeeklyRowSchema).length(4),
  }),
  policy_line: z.string().min(1).max(WEEKEND_CHAR_LIMITS.policyLine),
});

export type WeekendMenuData = z.infer<typeof WeekendMenuSchema>;
