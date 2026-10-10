import { z } from 'zod';

const DishBase = z.object({
  id: z.string().regex(/^d-[0-9a-f]{4}$/),
  name: z.string().min(1, 'Dish name is required'),
  desc: z.string().min(1, 'Description is required'),
  raw: z.boolean().optional(),
});

// Simpler flat dish schema (discriminatedUnion is finicky with optional keys)
// Oct 2026: name/desc/price may be blank so a draft ALWAYS saves while Chef
// is mid-typing (e.g. a just-added pasta dish). Blank fields are caught by
// the editor's publish check and the pre-print warnings instead.
export const AnyDishSchema = z.object({
  id: z.string().regex(/^d-[0-9a-f]{4}$/),
  // Hide/show switch (absent = shown). Hidden dishes stay in the data.
  enabled: z.boolean().optional(),
  name: z.string(),
  desc: z.string(),
  raw: z.boolean().optional(),
  price_format: z.enum(['single', 'dual']).optional(),
  price: z.string().optional(),
  // Dual-price fields (price_a_label / price_a / price_b_label / price_b)
  price_a_label: z.string().optional(),
  price_a: z.string().optional(),
  price_b_label: z.string().optional(),
  price_b: z.string().optional(),
  // Legacy dual-price fields — kept for backward compatibility with existing Blobs data
  bowl_price: z.string().optional(),
  cup_price: z.string().optional(),
});

export const SectionSchema = z.object({
  title: z.string().min(1).max(40, 'Section title too long (max 40 chars)'),
  items: z.array(AnyDishSchema),
});

export const SECTION_IDS = [
  'antipasti',
  'zuppa-insalate',
  'pasta',
  'contorni',
  'secondi',
  'non-alcoholic',
] as const;

// Section cardinalities — enforced to prevent layout breaks. Pasta is the
// one section that can grow (Oct 2026): at least its 7 template dishes, and
// at most 8 VISIBLE — that limit is checked at publish, not on save.
export const PASTA_MAX_VISIBLE = 8;
export const SECTION_COUNTS: Record<string, number> = {
  antipasti: 10,
  'zuppa-insalate': 4,
  pasta: 7,
  contorni: 6,
  secondi: 8,
  'non-alcoholic': 9,
};

// ── Add-on block schemas ──────────────────────────────────────────────────

// Oct 2026: all three add-on lines are fully editable (names, add/remove,
// reorder); blanks allowed so a new item saves while it's being typed.
const AddonItemSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  price: z.string(),
  enabled: z.boolean(),
});

const AddonBlockSchema = z.object({
  enabled: z.boolean(),
  label: z.string(),
  items: z.array(AddonItemSchema),
  tail: z.string().optional(),
});

export const MenuSchema = z.object({
  header: z.object({
    restaurant_name: z.string().min(1),
    sub_page_1: z.string().min(1),
    sub_other_pages: z.string().min(1),
  }),
  about_blurb: z.string().min(1),
  bread_note: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
  }),
  raw_warning_main: z.string().min(1),
  raw_warning_qualifier: z.string().min(1),
  policy_line: z.string().min(1),
  // Oct 2026: true = two-column grid sections list dishes left column top
  // to bottom, then right column (render.js). Absent on older saved menus,
  // which keep the original row-by-row order.
  column_order: z.boolean().optional(),
  salad_addons: AddonBlockSchema,
  pasta_addons: AddonBlockSchema,
  steak_addons: AddonBlockSchema,
  sections: z.object({
    antipasti: SectionSchema,
    'zuppa-insalate': SectionSchema,
    pasta: SectionSchema,
    contorni: SectionSchema,
    secondi: SectionSchema,
    'non-alcoholic': SectionSchema,
  }),
}).superRefine((data, ctx) => {
  for (const [id, count] of Object.entries(SECTION_COUNTS)) {
    const section = data.sections[id as keyof typeof data.sections];
    if (!section) continue;
    if (id === 'pasta' ? section.items.length < count : section.items.length !== count) {
      ctx.addIssue({
        code: 'custom',
        path: ['sections', id, 'items'],
        message: id === 'pasta'
          ? `Pasta must keep at least ${count} dishes (hide one instead of removing it)`
          : `Section "${id}" must have exactly ${count} items (dishes can be hidden, not removed)`,
      });
    }
  }
});

export type MenuData = z.infer<typeof MenuSchema>;
export type AddonItem = z.infer<typeof AddonItemSchema>;
export type AddonBlock = z.infer<typeof AddonBlockSchema>;
