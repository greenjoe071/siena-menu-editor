// The menu cards on the home screen, in Joe's order. `core` = the everyday
// menus (Dinner → Drinks & Dessert), which get the dark card treatment.

export interface HomeMenu {
  id: string;
  label: string;
  description: string;
  href: string;
  image: string;               // /images/home/* — real Siena photography / artwork
  fit?: 'cover' | 'contain';   // 'contain' for logos & sketches on white
  core?: boolean;
  badge?: 'new' | 'inprogress';
}

export const HOME_MENUS: HomeMenu[] = [
  { id: 'dinner',        label: 'Dinner Menu',             href: '/dinner',        image: '/images/home/dinner.webp', core: true,
    description: 'View or print the active menu, or start a new draft' },
  { id: 'monday',        label: 'Monday $26 Specials',     href: '/monday',        image: '/images/home/monday.webp', core: true,
    description: 'Weekly Monday night specials' },
  { id: 'tuewed',        label: 'Tue – Wed $45 Specials',  href: '/tueswed',       image: '/images/home/tueswed.webp', core: true,
    description: '3-course prix-fixe dinner, Tuesday and Wednesday nights' },
  { id: 'weekend',       label: 'Weekend Specials',        href: '/weekend',       image: '/images/home/weekend.webp', core: true,
    description: "Thu–Sat chef's specials — changes every week" },
  { id: 'drinksdessert', label: 'Drinks & Dessert',        href: '/drinksdessert', image: '/images/home/drinks-sketch.webp', fit: 'contain', core: true,
    description: 'Drinks Menu (Cocktails, Spritz, Spirits & Beer, Dopa Cena) and the Desserts insert', badge: 'new' },
  { id: 'happyhour',     label: 'Happy Hour',              href: '/happyhour',     image: '/images/home/happyhour.webp',
    description: 'Edit bites, cocktails, wine, beer, and the bar promo' },
  { id: 'coursemenu',    label: 'Generic Menu',            href: '/coursemenu',    image: '/images/home/generic.webp',
    description: 'Flexible 2, 3, or 4-course menu for one-off specials and events', badge: 'new' },
  { id: 'privatedining', label: 'Private Dining',          href: '/privatedining', image: '/images/home/privatedining.webp',
    description: 'San Gimignano, Firenze, and Siena menus, plus saved alternates for events', badge: 'inprogress' },
  { id: 'arw',           label: 'Austin Restaurant Weeks', href: '/arw',           image: '/images/home/arw-logo.png', fit: 'contain',
    description: '$50 three-course prix fixe — Aug 28–Sep 13, 2026', badge: 'new' },
];

export const BADGE_TEXT: Record<NonNullable<HomeMenu['badge']>, string> = {
  new: 'New',
  inprogress: 'In progress',
};
