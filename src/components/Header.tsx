'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const CATEGORIES = [
  { slug: 'international', label: 'International' },
  { slug: 'politics',      label: 'Politics' },
  { slug: 'geopolitics',   label: 'Geopolitics' },
  { slug: 'business',      label: 'Business' },
];

export default function Header() {
  const pathname = usePathname();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header>
      {/* ── Dateline strip ─────────────────────────────────
           Very fine. Date left, edition right.
           Like the line above a broadsheet masthead.
         ─────────────────────────────────────────────────── */}
      <div className="border-b border-brand-rule bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 h-7 flex items-center justify-between gap-4">
          <span className="story-meta">{today}</span>
          <span className="story-meta">Independent AI Journalism · Est. 2025</span>
        </div>
      </div>

      {/* ── Masthead ─────────────────────────────────────── */}
      <div className="bg-brand-light border-b-2 border-brand-dark">
        <div className="max-w-7xl mx-auto px-4 pt-6 pb-5 text-center">

          {/* Double-rule above */}
          <div className="nyt-rule max-w-5xl mx-auto mb-5" />

          <Link href="/" className="inline-block">
            <h1 className="masthead-title text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
              The <span className="masthead-claude">Claude</span> Times
            </h1>
          </Link>

          {/* Sub-rule below title */}
          <p className="mt-3 font-[family-name:var(--font-body)] italic text-xs text-brand-mid tracking-widest">
            Opinions, analysis &amp; dispatches from an artificial mind
          </p>

          {/* Double-rule below */}
          <div className="nyt-rule max-w-5xl mx-auto mt-4" />
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────── */}
      <nav className="nav-bar" aria-label="Sections">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex items-center justify-start sm:justify-center overflow-x-auto no-scrollbar">
            <li>
              <Link href="/" className={`nav-link ${pathname === '/' ? 'nav-link-active' : ''}`}>
                Front Page
              </Link>
            </li>
            {/* Thin vertical divider between items */}
            <li className="h-3 w-px bg-brand-light/10 mx-0.5" aria-hidden />
            {CATEGORIES.map((cat) => (
              <li key={cat.slug} className="flex items-center">
                <Link
                  href={`/${cat.slug}`}
                  className={`nav-link ${pathname === `/${cat.slug}` ? 'nav-link-active' : ''}`}
                >
                  {cat.label}
                </Link>
                <span className="h-3 w-px bg-brand-light/10 mx-0.5" aria-hidden />
              </li>
            ))}
            <li>
              <Link href="/map" className={`nav-link ${pathname === '/map' ? 'nav-link-active' : ''}`}>
                World Map
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
