import Link from 'next/link';

// Every save on this menu is direct-edit (no draft/publish) — see
// BUILD-SPEC §0. This landing page's only job is to make the manager pick a
// visual style before any editing UI appears; the same menu data drives
// either style, so picking a style never touches menu-data.json. The
// thumbnails are live iframes of the current menu (not static images), so
// they always reflect whatever's actually saved.

const STYLES = [
  {
    key: 'classic',
    label: 'Two-Column Classic',
    desc: 'Centered header and dish names. Antipasti and Entrée run in a 2-column grid, Dolci in 3 — the layout this menu launched with.',
  },
  {
    key: 'left-aligned',
    label: 'Left-Aligned',
    desc: 'Logo sits to the right of the header. Every course is a single stacked list — dish name, a dash, then the description, one line per dish.',
  },
] as const;

export default function ArwStylePickerPage() {
  return (
    <div className="dinner-landing">
      <header className="dl-header">
        <div className="dl-header-inner">
          <Link href="/" className="dl-back">🏠 Home</Link>
          <h1 className="dl-title">Austin Restaurant Weeks</h1>
          <p className="dl-subtitle">Choose a style to start editing. Both styles share the exact same menu content — switch anytime from inside the editor.</p>
        </div>
      </header>

      <main className="arw-picker-main">
        <div className="arw-style-grid">
          {STYLES.map((s) => (
            <Link key={s.key} href={`/arw/edit?style=${s.key}`} className="arw-style-card">
              <div className="arw-style-thumb">
                <iframe src={`/arw-preview?style=${s.key}`} title={`${s.label} preview`} tabIndex={-1} />
              </div>
              <div className="arw-style-title">{s.label}</div>
              <div className="arw-style-desc">{s.desc}</div>
              <div className="arw-style-cta">Choose this style →</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
