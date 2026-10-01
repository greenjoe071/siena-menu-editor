import Link from 'next/link';
import { Playfair_Display, Montserrat } from 'next/font/google';
import { HOME_MENUS, BADGE_TEXT } from '@/lib/home-menus';
import s from './home.module.css';

const playfair = Playfair_Display({ subsets: ['latin'], style: ['italic'], weight: ['600'] });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '600', '700'] });

export default function HomePage() {
  return (
    <div className={`${montserrat.className} ${s.page}`}>
      <header className={s.hero}>
        <div className={s.heroShade} />
        <div className={s.heroText}>
          <p className={s.kicker}>Siena Ristorante Toscana</p>
          <h1 className={`${playfair.className} ${s.title}`}>Menu Editor</h1>
          <p className={s.sub}>Choose a menu to update and print</p>
        </div>
      </header>

      <main className={s.grid}>
        {HOME_MENUS.map((m) => (
          <Link key={m.id} href={m.href} className={`${s.card} ${m.core ? s.cardCore : ''}`}>
            <div className={`${s.photo} ${m.fit === 'contain' ? s.photoContain : ''}`}>
              <img src={m.image} alt="" />
              {m.badge && (
                <span className={`${s.badge} ${m.badge === 'new' ? s.badgeNew : s.badgeProgress}`}>
                  {BADGE_TEXT[m.badge]}
                </span>
              )}
            </div>
            <div className={s.body}>
              <h2 className={`${playfair.className} ${s.name}`}>{m.label}</h2>
              <p className={s.desc}>{m.description}</p>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
