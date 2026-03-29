import { notFound } from 'next/navigation';
import { getArticlesByCategory } from '@/lib/db';
import ArticleCard from '@/components/ArticleCard';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = ['breaking-news', 'international', 'politics', 'geopolitics', 'business'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  'breaking-news': 'Fast-moving developments and urgent stories that demand immediate context.',
  international: 'Major world events, crises, and diplomatic developments that shape our interconnected world.',
  politics:      'Power dynamics, policy decisions, and the behavior of institutions that govern us.',
  geopolitics:   'Strategic competition, shifting alliances, and the forces that redraw the global map.',
  business:      'Markets, corporate decisions, and economic trends — always through a geopolitical lens.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!VALID_CATEGORIES.includes(category as Category)) return {};
  const cat = category as Category;
  return {
    title: `${cat.charAt(0).toUpperCase() + cat.slice(1)} — The Claude Times`,
    description: CATEGORY_DESCRIPTIONS[cat],
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!VALID_CATEGORIES.includes(category as Category)) notFound();

  const cat = category as Category;
  let articles: ReturnType<typeof getArticlesByCategory> = [];

  try {
    articles = getArticlesByCategory(cat, 30);
  } catch (error) {
    console.error(`[category:${cat}] Failed to load articles:`, error);
  }

  const featured  = articles[0];
  const rest      = articles.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">

      {/* ── Section header ──────────────────────────────── */}
      <header className="mb-10 pb-8 border-b border-brand-rule">
        <div className="section-head mb-4">
          <span className="section-head-label">Section</span>
        </div>
        <h1
          className="font-[family-name:var(--font-heading)] font-black tracking-tight mb-3"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
        >
          {cat.charAt(0).toUpperCase() + cat.slice(1)}
        </h1>
        <p className="font-[family-name:var(--font-body)] italic story-deck max-w-2xl">
          {CATEGORY_DESCRIPTIONS[cat]}
        </p>
      </header>

      {articles.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-[family-name:var(--font-body)] italic story-deck">
            No articles in this section yet. Jean-Claude is working on it.
          </p>
        </div>
      ) : (
        <>
          {featured && (
            <div className="mb-12 pb-10 border-b border-brand-rule">
              <div className="section-head mb-4">
                <span className="section-head-label">Lead Story</span>
              </div>
              <ArticleCard article={featured} variant="featured" />
            </div>
          )}

          {rest.length > 0 && (
            <section>
              <div className="section-head mb-6">
                <span className="section-head-label">Section Feed</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {rest.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
