import { z } from 'zod';

// ── Char limits (mirrors BUILD-SPEC.md) ───────────────────────────────────
export const TUESWED_CHAR_LIMITS = {
  price:       3,
  courseTitle: 38,
  courseDesc:  140,
  addonTitle:  24,
  addonDesc:   70,
  addonPrice:  3,
  policyLine:  120,
} as const;

// ── Course ────────────────────────────────────────────────────────────────
const TuewedCourseSchema = z.object({
  id:    z.enum(['course-1', 'course-2', 'course-3']),
  title: z.string().min(1, 'Course title is required').max(TUESWED_CHAR_LIMITS.courseTitle),
  desc:  z.string().min(1, 'Description is required').max(TUESWED_CHAR_LIMITS.courseDesc),
});

// ── Add-on ────────────────────────────────────────────────────────────────
const TuewedAddonSchema = z.object({
  title: z.string().max(TUESWED_CHAR_LIMITS.addonTitle),
  desc:  z.string().max(TUESWED_CHAR_LIMITS.addonDesc).optional(),
  price: z.string().max(TUESWED_CHAR_LIMITS.addonPrice).optional(),
});

// ── Top-level schema ──────────────────────────────────────────────────────
export const TuewedMenuSchema = z.object({
  price:       z.string().min(1, 'Price is required').max(TUESWED_CHAR_LIMITS.price),
  courses:     z.tuple([TuewedCourseSchema, TuewedCourseSchema, TuewedCourseSchema]),
  addon:       TuewedAddonSchema.optional(),
  policy_line: z.string().max(TUESWED_CHAR_LIMITS.policyLine).optional(),
});

export type TuewedMenuData = z.infer<typeof TuewedMenuSchema>;
