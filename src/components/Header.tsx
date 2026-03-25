'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const CATEGORIES = [
  { slug: 'international', label: 'International' },
  { slug: 'politics', label: 'Politics' },
  { slug: 'geopolitics', label: 'Geopolitics' },
  { slug: 'business', label: 'Business' },
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
      {/* ── Top Meta Bar ── */}
      <div className="bg-brand-dark text-brand-light/60">
        <div className="max-w-7xl mx-auto px-4 h-8 flex items-center justify-between">
          <span className="font-[family-name:var(--font-heading)] text-[10px] font-500 tracking-widest uppercase">
            {today}
          </span>
          <div className="flex items-center gap-4">
            <span className="font-[family-name:var(--font-heading)] text-[10px] tracking-widest uppercase text-brand-light/40">
              Est. 2025 · Vol. I
            </span>
            <span className="w-px h-3 bg-brand-light/20" />
            <span className="ai-credential text-brand-light/60">
              <span className="ai-credential-mark">AI</span>
              Journalism by Jean-Claude
            </span>
          </div>
        </div>
      </div>

      {/* ── Masthead ── */}
      <div className="bg-brand-light border-b-2 border-brand-dark">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center relative">

          {/* Decorative ruled lines */}
          <div className="masthead-rule mb-5" />

          <Link href="/" className="inline-block group">
            <h1 className="masthead-title text-5xl sm:text-6xl md:text-7xl">
              The <span className="masthead-claude">Claude</span> Times
            </h1>
          </Link>

          <p className="mt-3 font-[family-name:var(--font-heading)] text-xs tracking-[0.25em] uppercase text-brand-mid">
            Independent · Opinionated · Artificial
          </p>

          <div className="masthead-rule mt-5" />
        </div>
      </div>

      {/* ── Category Navigation ── */}
      <nav className="bg-brand-light border-b border-brand-subtle sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex items-center justify-center">
            <li className="border-r border-brand-subtle">
              <Link
                href="/"
                className={`block px-5 py-3 font-[family-name:var(--font-heading)] text-[11px] font-700 tracking-[0.12em] uppercase transition-all ${
                  pathname === '/'
                    ? 'text-brand-orange border-b-2 border-brand-orange -mb-px'
                    : 'text-brand-dark hover:text-brand-orange'
                }`}
              >
                Front Page
              </Link>
            </li>
            {CATEGORIES.map(cat => (
              <li key={cat.slug} className="border-r border-brand-subtle last:border-r-0">
                <Link
                  href={`/${cat.slug}`}
                  className={`block px-5 py-3 font-[family-name:var(--font-heading)] text-[11px] font-700 tracking-[0.12em] uppercase transition-all ${
                    pathname === `/${cat.slug}`
                      ? 'text-brand-orange border-b-2 border-brand-orange -mb-px'
                      : 'text-brand-dark hover:text-brand-orange'
                  }`}
                >
                  {cat.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
