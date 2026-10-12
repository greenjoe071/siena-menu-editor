import { z } from 'zod';

// ── Paste-safety caps (loose guards only — layout-budget validator is authoritative) ──
export const TUESWED_CHAR_LIMITS = {
  price:          3,
  courseTitle:    60,
  courseDesc:     240,
  addonTitle:     40,
  addonDesc:      120,
  addonPrice:     3,
  policyLine:     300,
  specialLabel:   30,
  specialTitle:   60,
  specialPrice:   3,
  specialDesc:    200,
  weeklyDay:      20,
  weeklyHeadline: 40,
  weeklyDetail:   140,
} as const;
const L = TUESWED_CHAR_LIMITS;

// Oct 2026 (designer v3): blanks are allowed everywhere so the editor ALWAYS
// saves while Chef is typing (Joe's rule). Required fields — course titles,
// the Tuesdays Only title/price — are checked when he publishes instead.

// ── Course ────────────────────────────────────────────────────────────────
const TuewedCourseSchema = z.object({
  id:    z.enum(['course-1', 'course-2', 'course-3']),
  title: z.string().max(L.courseTitle),
  desc:  z.string().max(L.courseDesc),
});

// ── Add-on ────────────────────────────────────────────────────────────────
const TuewedAddonSchema = z.object({
  title: z.string().max(L.addonTitle),
  desc:  z.string().max(L.addonDesc).optional(),
  price: z.string().max(L.addonPrice).optional(),
});

// ── v3: "Tuesdays Only" special box + editable weekly cells ───────────────
const TuewedSpecialSchema = z.object({
  label: z.string().max(L.specialLabel),
  title: z.string().max(L.specialTitle),
  price: z.string().max(L.specialPrice),
  desc:  z.string().max(L.specialDesc),
});

const TuewedWeeklySchema = z.object({
  id:       z.enum(['week-1', 'week-2', 'week-3', 'week-4']),
  day:      z.string().max(L.weeklyDay),
  headline: z.string().max(L.weeklyHeadline),
  detail:   z.string().max(L.weeklyDetail),
});

// ── Top-level schema ──────────────────────────────────────────────────────
// Covers BOTH shapes: v2 menus (no `special`/`weekly`, have `policy_line` —
// e.g. Past Menus, printed with handoff-tueswed-v2/) and v3 menus (have
// `special` + `weekly`, printed with handoff-tueswed/). `policy_line` is
// kept on v3 menus too (v3 doesn't print it) so nothing saved is ever lost.
export const TuewedMenuSchema = z.object({
  special:     TuewedSpecialSchema.optional(),
  price:       z.string().max(L.price),
  courses:     z.tuple([TuewedCourseSchema, TuewedCourseSchema, TuewedCourseSchema]),
  addon:       TuewedAddonSchema.optional(),
  weekly:      z.tuple([TuewedWeeklySchema, TuewedWeeklySchema, TuewedWeeklySchema, TuewedWeeklySchema]).optional(),
  policy_line: z.string().max(L.policyLine).optional(),
});

export type TuewedMenuData = z.infer<typeof TuewedMenuSchema>;

/** v3 menus carry the Tuesdays Only box; older menus print with the v2 package. */
export function isTuewedV3(data: { special?: unknown } | null | undefined): boolean {
  return !!data && data.special != null;
}

/** Folder holding the template/render/validate files for this menu's shape. */
export function tuewedHandoffDir(data: { special?: unknown } | null | undefined): string {
  return isTuewedV3(data) ? 'handoff-tueswed' : 'handoff-tueswed-v2';
}

// The four weekly cells exactly as they printed on the live v2 menu (Joe's
// wording — including the Oct 2026 Monday line), used when a v2 menu is
// upgraded in the editor.
export const TUESWED_DEFAULT_WEEKLY: NonNullable<TuewedMenuData['weekly']> = [
  { id: 'week-1', day: 'Mondays',    headline: '$26 for 26 Years',      detail: 'Two course meal $26: Choose a Caesar or soup and then 1 of 4 pastas.' },
  { id: 'week-2', day: 'Wednesdays', headline: 'Wine Lovers Wednesday', detail: '25% off all bottles of wine — and we mean all of them.' },
  { id: 'week-3', day: 'Thursdays',  headline: 'Thirsty Thursday',      detail: '$10 signature cocktails, all night long.' },
  { id: 'week-4', day: 'Thu – Sat',  headline: 'Weekend Specials',      detail: 'A new set of specials every week. This is where Chef gets creative.' },
];
