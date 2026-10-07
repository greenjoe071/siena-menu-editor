import Link from 'next/link';
import { HOME_MENUS } from '@/lib/home-menus';
import { playfair } from '@/lib/fonts';

// Photo header for the pages one click in from home (Oct 2026, Joe: match
// the home screen). Uses the menu's own home-card photo; logos and sketches
// (fit: 'contain') would crop badly, so those fall back to the night exterior.

const FALLBACK = '/images/home/exterior-night.webp';

export function heroImageFor(path: string | null | undefined): string {
  if (!path) return FALLBACK;
  const m = HOME_MENUS.find((h) => path === h.href || path.startsWith(h.href + '/'));
  return m && m.fit !== 'contain' ? m.image : FALLBACK;
}

export default function LandingHero({
  title, subtitle, image, back,
}: {
  title: string;
  subtitle?: string;
  image: string;
  back?: { href: string; label: string };   // omit when the page has its own Home button
}) {
  return (
    <header className="lh-hero" style={{ backgroundImage: `url('${image}')` }}>
      <div className="lh-shade" />
      {back && <Link href={back.href} className="lh-back">{back.label}</Link>}
      <div className="lh-text">
        <p className="lh-kicker">Siena Ristorante Toscana</p>
        <h1 className={`${playfair.className} lh-title`}>{title}</h1>
        {subtitle && <p className="lh-sub">{subtitle}</p>}
      </div>
    </header>
  );
}
