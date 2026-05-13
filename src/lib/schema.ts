import { z } from 'zod';

const DishBase = z.object({
  id: z.string().regex(/^d-[0-9a-f]{4}$/),
  name: z.string().min(1, 'Dish name is required'),
  desc: z.string().min(1, 'Description is required'),
  raw: z.boolean().optional(),
});

const SinglePriceDish = DishBase.extend({
  price_format: z.literal('single').optional(),
  price: z.string().min(1, 'Price is required'),
});

const DualPriceDish = DishBase.extend({
  price_format: z.literal('dual'),
  bowl_price: z.string().min(1, 'Bowl price is required'),
  cup_price: z.string().min(1, 'Cup price is required'),
});

export const DishSchema = z.discriminatedUnion('price_format', [
  DualPriceDish,
  // single is the default, catches anything without price_format or with 'single'
  SinglePriceDish,
]).or(DishBase.extend({ price: z.string().min(1) }));

// Simpler flat dish schema (discriminatedUnion is finicky with optional keys)
export const AnyDishSchema = z.object({
  id: z.string().regex(/^d-[0-9a-f]{4}$/),
  name: z.string().min(1, 'Dish name is required'),
  desc: z.string().min(1, 'Description is required'),
  raw: z.boolean().optional(),
  price_format: z.enum(['single', 'dual']).optional(),
  price: z.string().optional(),
  bowl_price: z.string().optional(),
  cup_price: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.price_format === 'dual') {
    if (!d.bowl_price) ctx.addIssue({ code: 'custom', message: 'bowl_price required', path: ['bowl_price'] });
    if (!d.cup_price) ctx.addIssue({ code: 'custom', message: 'cup_price required', path: ['cup_price'] });
  } else {
    if (!d.price) ctx.addIssue({ code: 'custom', message: 'price required', path: ['price'] });
  }
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

// Section cardinalities — enforced to prevent layout breaks
export const SECTION_COUNTS: Record<string, number> = {
  antipasti: 10,
  'zuppa-insalate': 4,
  pasta: 7,
  contorni: 6,
  secondi: 8,
  'non-alcoholic': 7,
};

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
  raw_warning_full: z.string().min(1),
  raw_warning_short: z.string().min(1),
  policy_line: z.string().min(1),
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
    if (section && section.items.length !== count) {
      ctx.addIssue({
        code: 'custom',
        path: ['sections', id, 'items'],
        message: `Section "${id}" must have exactly ${count} items (adding/removing dishes is out of scope)`,
      });
    }
  }
});

export type MenuData = z.infer<typeof MenuSchema>;
