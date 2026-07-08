import Link from 'next/link';

const MENUS = [
  {
    id: 'dinner',
    label: 'Dinner Menu',
    description: 'View or print the current menu, or start a new draft',
    icon: '🍽️',
    ready: true,
    href: '/dinner',
    action: 'Open →',
  },
  {
    id: 'happyhour',
    label: 'Happy Hour',
    description: 'Edit bites, cocktails, wine, beer, and the bar promo',
    icon: '🍹',
    ready: true,
    href: '/happyhour',
  },
  {
    id: 'monday',
    label: 'Monday $26 Specials',
    description: 'Weekly Monday night specials',
    icon: '🍝',
    ready: true,
    href: '/monday',
  },
  {
    id: 'tuewed',
    label: 'Tue – Wed $45 Specials',
    description: '3-course prix-fixe dinner, Tuesday and Wednesday nights',
    icon: '✨',
    ready: true,
    href: '/tueswed',
  },
  {
    id: 'weekend',
    label: 'Weekend Specials',
    description: "Thu–Sat chef's specials — changes every week",
    icon: '🌅',
    ready: true,
    href: '/weekend',
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
          <h1 className="home-title">Menu Editor</h1>
          <p className="home-subtitle">Siena Ristorante Toscana</p>
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
              <div className="menu-card-action">{menu.action ?? 'Open →'}</div>
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
