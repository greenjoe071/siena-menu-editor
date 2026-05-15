import { z } from 'zod';

// ── Char limits (mirrors BUILD-SPEC.md) ───────────────────────────────────
export const MONDAY_CHAR_LIMITS = {
  heroEyebrow:      48,
  heroPrice:         3,
  heroTagline:      38,
  heroMetaLeft:     22,
  heroMetaRight:    22,
  sectionTitle:     24,
  sectionSubtitle:  16,
  dishName:         30,
  dishDesc:        140,
  dishPrice:         6,
  weeklyTitle:      42,
  weeklyDayLabel:   14,
  weeklyHeadline:   26,
  weeklyDetail:    110,
  policyLine:      120,
} as const;

// ── Dish ──────────────────────────────────────────────────────────────────
const MondayDishSchema = z.object({
  id:    z.string(),
  name:  z.string().min(1, 'Dish name is required').max(MONDAY_CHAR_LIMITS.dishName),
  desc:  z.string().min(1, 'Description is required').max(MONDAY_CHAR_LIMITS.dishDesc),
  price: z.string().max(MONDAY_CHAR_LIMITS.dishPrice).optional().default(''),
});

// ── Course section ────────────────────────────────────────────────────────
const MondaySectionSchema = z.object({
  title:    z.string().min(1).max(MONDAY_CHAR_LIMITS.sectionTitle),
  subtitle: z.string().min(1).max(MONDAY_CHAR_LIMITS.sectionSubtitle),
  items:    z.array(MondayDishSchema),
});

// ── Weekly row ────────────────────────────────────────────────────────────
const WeeklyRowSchema = z.object({
  id:        z.string(),
  day_label: z.string().min(1).max(MONDAY_CHAR_LIMITS.weeklyDayLabel),
  headline:  z.string().min(1).max(MONDAY_CHAR_LIMITS.weeklyHeadline),
  detail:    z.string().min(1).max(MONDAY_CHAR_LIMITS.weeklyDetail),
});

// ── Top-level schema ──────────────────────────────────────────────────────
export const MondayMenuSchema = z.object({
  hero: z.object({
    eyebrow:    z.string().min(1).max(MONDAY_CHAR_LIMITS.heroEyebrow),
    price:      z.string().min(1).max(MONDAY_CHAR_LIMITS.heroPrice).regex(/^\d+$/, 'Price must be digits only (no $ sign)'),
    tagline:    z.string().min(1).max(MONDAY_CHAR_LIMITS.heroTagline),
    meta_left:  z.string().min(1).max(MONDAY_CHAR_LIMITS.heroMetaLeft),
    meta_right: z.string().min(1).max(MONDAY_CHAR_LIMITS.heroMetaRight),
  }),
  sections: z.object({
    'course-1': MondaySectionSchema,
    'course-2': MondaySectionSchema,
  }),
  weekly: z.object({
    title: z.string().min(1).max(MONDAY_CHAR_LIMITS.weeklyTitle),
    rows:  z.array(WeeklyRowSchema),
  }),
  policy_line: z.string().min(1).max(MONDAY_CHAR_LIMITS.policyLine),
}).superRefine((data, ctx) => {
  if (data.sections['course-1'].items.length !== 2) {
    ctx.addIssue({ code: 'custom', path: ['sections', 'course-1', 'items'], message: 'Course 1 must have exactly 2 items' });
  }
  if (data.sections['course-2'].items.length !== 4) {
    ctx.addIssue({ code: 'custom', path: ['sections', 'course-2', 'items'], message: 'Course 2 must have exactly 4 items' });
  }
  if (data.weekly.rows.length !== 4) {
    ctx.addIssue({ code: 'custom', path: ['weekly', 'rows'], message: 'Weekly grid must have exactly 4 rows' });
  }
});

export type MondayMenuData = z.infer<typeof MondayMenuSchema>;
