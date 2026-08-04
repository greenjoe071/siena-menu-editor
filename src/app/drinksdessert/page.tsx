import Link from 'next/link';

// Entry fork for the old "Drinks & Dessert" home card. Dolci became its own
// standalone insert (see drinksdessert-dolci-archive.json) — this screen
// lets Joe pick which side he's working on.

export default function DrinksDessertChooserPage() {
  return (
    <div className="dinner-landing">
      <header className="dl-header">
        <div className="dl-header-inner">
          <Link href="/" className="dl-back">🏠 Home</Link>
          <h1 className="dl-title">Drinks &amp; Dessert</h1>
          <p className="dl-subtitle">Choose which menu you want to work on.</p>
        </div>
      </header>

      <main className="dd-chooser">
        <Link href="/drinksdessert/menu" className="dd-chooser-card">
          <span className="dd-chooser-emoji">🍸</span>
          <span className="dd-chooser-title">Drinks Menu</span>
          <span className="dd-chooser-hint">Cocktails, Spritz, Spirits &amp; Beer, Dopa Cena</span>
        </Link>

        <Link href="/dessert" className="dd-chooser-card">
          <span className="dd-chooser-emoji">🍰</span>
          <span className="dd-chooser-title">Desserts</span>
          <span className="dd-chooser-hint">Dolci — the single dessert insert card</span>
        </Link>
      </main>
    </div>
  );
}
