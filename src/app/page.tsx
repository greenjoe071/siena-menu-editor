import Link from 'next/link';

const MENUS = [
  {
    id: 'dinner',
    label: 'Dinner Menu',
    description: 'Edit dishes, descriptions, and prices for the main dinner menu',
    icon: '🍽️',
    ready: true,
    href: '/dinner',
  },
  {
    id: 'happyhour',
    label: 'Happy Hour',
    description: 'Discounted drinks and bites',
    icon: '🍹',
    ready: false,
  },
  {
    id: 'monday',
    label: 'Monday $26 Specials',
    description: 'Weekly Monday night specials',
    icon: '🥂',
    ready: true,
    href: '/monday',
  },
  {
    id: 'tuewed',
    label: 'Tue – Wed $45 Specials',
    description: 'Midweek prix fixe menu',
    icon: '✨',
    ready: false,
  },
  {
    id: 'weekend',
    label: 'Weekend Specials',
    description: 'Friday and Saturday evening specials',
    icon: '🌅',
    ready: false,
  },
  {
    id: 'misc2',
    label: 'Coming Soon',
    description: 'New menu — in progress',
    icon: '📋',
    ready: false,
  },
];

export default function HomePage() {
  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-header-inner">
          <div className="home-logo">SR</div>
          <div>
            <h1 className="home-title">Siena Ristorante Toscana</h1>
            <p className="home-subtitle">Menu Editor</p>
          </div>
        </div>
        <p className="home-tagline">Choose a menu below to make changes and print</p>
      </header>

      <main className="home-grid">
        {MENUS.map((menu) =>
          menu.ready ? (
            <Link key={menu.id} href={menu.href!} className="menu-card menu-card--active">
              <div className="menu-card-icon">{menu.icon}</div>
              <div className="menu-card-body">
                <h2 className="menu-card-title">{menu.label}</h2>
                <p className="menu-card-desc">{menu.description}</p>
              </div>
              <div className="menu-card-action">Open Editor →</div>
            </Link>
          ) : (
            <div key={menu.id} className="menu-card menu-card--soon">
              <div className="menu-card-icon">{menu.icon}</div>
              <div className="menu-card-body">
                <h2 className="menu-card-title">{menu.label}</h2>
                <p className="menu-card-desc">{menu.description}</p>
              </div>
              <div className="menu-card-badge">Coming Soon</div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
