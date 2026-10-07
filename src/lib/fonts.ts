import { Playfair_Display, Montserrat } from 'next/font/google';

// Shared with the home screen's "Sera" look (Oct 2026) — the landing pages
// one click in from home use the same two faces.
export const playfair = Playfair_Display({ subsets: ['latin'], style: ['italic'], weight: ['600'], variable: '--font-playfair' });
export const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '600', '700'] });
