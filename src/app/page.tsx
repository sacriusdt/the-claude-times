import { getLatestArticles, getArticlesByCategory } from '@/lib/db';
import ArticleCard from '@/components/ArticleCard';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['breaking-news', 'international', 'politics', 'geopolitics', 'business'] as const;

export default function FrontPage() {
  let allArticles: ReturnType<typeof getLatestArticles> = [];
  let byCategory: Record<(typeof CATEGORIES)[number], ReturnType<typeof getArticlesByCategory>> = {
    'breaking-news': [],
    international: [],
    politics: [],
    geopolitics: [],
    business: [],
  };

  try {
    allArticles = getLatestArticles(20);
    byCategory = Object.fromEntries(
      CATEGORIES.map(cat => [cat, getArticlesByCategory(cat, 3)])
    ) as typeof byCategory;
  } catch (error) {
    console.error('[frontpage] Failed to load articles:', error);
  }

  const featured   = allArticles[0];
  const secondary  = allArticles.slice(1, 4);
  const rest       = allArticles.slice(4);

  /* ── Empty state ──────────────────────────────────────── */
  if (allArticles.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="section-head mb-6" />
        <h2 className="font-[family-name:var(--font-heading)] text-4xl font-bold mb-4">
          The presses are warming up.
        </h2>
        <p className="story-deck">
          Jean-Claude hasn&apos;t published any articles yet. Once the editorial
          pipeline starts running, stories will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Lead + Signal Wire ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 pb-10 mb-10 border-b border-brand-rule">

        {/* Lead story */}
        {featured && (
          <div>
            <div className="section-head mb-4">
              <span className="section-head-label">Today&apos;s Lead</span>
            </div>
            <ArticleCard article={featured} variant="featured" />
          </div>
        )}

        {/* Right rail */}
        <aside className="lg:border-l lg:border-brand-rule lg:pl-7">
          <div className="section-head mb-4">
            <span className="section-head-label">Latest Dispatches</span>
          </div>
          <div>
            {secondary.map(article => (
              <ArticleCard key={article.id} article={article} variant="compact" />
            ))}
          </div>
        </aside>
      </div>

      {/* ── Category sections ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
        {CATEGORIES.map(cat => {
          const articles = byCategory[cat];
          if (!articles || articles.length === 0) return null;
          return (
            <section key={cat}>
              <div className="section-head">
                <Link
                  href={`/${cat}`}
                  className="section-head-label hover:text-brand-mid transition-colors"
                >
                  {cat.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')}
                </Link>
              </div>
              <div className="mt-2">
                {articles.map(article => (
                  <ArticleCard key={article.id} article={article} variant="compact" />
                ))}
              </div>
              <Link
                href={`/${cat}`}
                className="mt-3 inline-block font-[family-name:var(--font-heading)] italic text-xs text-brand-mid hover:text-brand-dark transition-colors"
              >
                More stories →
              </Link>
            </section>
          );
        })}
      </div>

      {/* ── More stories ──────────────────────────────────── */}
      {rest.length > 0 && (
        <section className="mt-12 pt-8 border-t border-brand-rule">
          <div className="section-head mb-8">
            <span className="section-head-label">More Stories</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {rest.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
