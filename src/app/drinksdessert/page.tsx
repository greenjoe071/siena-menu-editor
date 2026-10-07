import Link from 'next/link';
import LandingHero, { heroImageFor } from '@/components/LandingHero';
import { montserrat, playfair } from '@/lib/fonts';

// Entry fork for the old "Drinks & Dessert" home card. Dolci became its own
// standalone insert (see drinksdessert-dolci-archive.json) — this screen
// lets Joe pick which side he's working on.

export default function DrinksDessertChooserPage() {
  return (
    <div className={`dinner-landing ${montserrat.className} ${playfair.variable}`}>
      <LandingHero
        title="Drinks & Dessert"
        subtitle="Choose which menu you want to work on."
        image={heroImageFor('/drinksdessert')}
        back={{ href: '/', label: '← Home' }}
      />

      <main className="dd-chooser">
        <Link href="/drinksdessert/menu" className="dd-chooser-card">
          <span className={`${playfair.className} dd-chooser-title`}>Drinks Menu</span>
          <span className="dd-chooser-hint">Cocktails, Spritz, Spirits &amp; Beer, Dopa Cena</span>
        </Link>

        <Link href="/dessert" className="dd-chooser-card">
          <span className={`${playfair.className} dd-chooser-title`}>Desserts</span>
          <span className="dd-chooser-hint">Dolci — the single dessert insert card</span>
        </Link>
      </main>
    </div>
  );
}
