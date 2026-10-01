import { z } from 'zod';

// Generic 2–4 course menu (handoff-coursemenu). Layout-budget model: the
// validator in the preview iframe is authoritative; these caps are only
// paste-safety guards. Fields are allowed blank so a half-built draft still
// autosaves — the editor blocks publishing until the required ones are filled.
export const COURSEMENU_CHAR_LIMITS = {
  header:      60,
  price:       3,
  description: 120,
  courseTitle: 60,
  courseDesc:  240,
  addonTitle:  40,
  addonPrice:  3,
  addonDesc:   120,
  policyLine:  300,
} as const;

export const COURSEMENU_MIN_COURSES = 2;
export const COURSEMENU_MAX_COURSES = 4;

const L = COURSEMENU_CHAR_LIMITS;

const CourseSchema = z.object({
  id:    z.enum(['course-1', 'course-2', 'course-3', 'course-4']),
  title: z.string().max(L.courseTitle),
  desc:  z.string().max(L.courseDesc),
});

export const CourseMenuSchema = z.object({
  header:      z.string().max(L.header),
  price:       z.string().regex(/^\d*$/, 'Price must be digits only').max(L.price),
  description: z.string().max(L.description),
  courses:     z.array(CourseSchema).min(COURSEMENU_MIN_COURSES).max(COURSEMENU_MAX_COURSES),
  addon: z.object({
    title: z.string().max(L.addonTitle),
    price: z.string().regex(/^\d*$/, 'Add-on price must be digits only').max(L.addonPrice),
    desc:  z.string().max(L.addonDesc),
  }),
  footer: z.object({
    enabled:     z.boolean(),
    policy_line: z.string().max(L.policyLine),
  }),
});

export type CourseMenuData = z.infer<typeof CourseMenuSchema>;
export type CourseMenuCourse = CourseMenuData['courses'][number];
