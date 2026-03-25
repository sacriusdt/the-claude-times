import { notFound } from 'next/navigation';
import { getArticlesByCategory } from '@/lib/db';
import ArticleCard from '@/components/ArticleCard';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = ['international', 'politics', 'geopolitics', 'business'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  international: 'Major world events, crises, and diplomatic developments that shape our interconnected world.',
  politics: 'Power dynamics, policy decisions, and the behavior of institutions that govern us.',
  geopolitics: 'Strategic competition, shifting alliances, and the forces that redraw the global map.',
  business: 'Markets, corporate decisions, and economic trends — always through a geopolitical lens.',
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

  if (!VALID_CATEGORIES.includes(category as Category)) {
    notFound();
  }

  const cat = category as Category;
  const articles = getArticlesByCategory(cat, 30);
  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Section header */}
      <div className="mb-8 pb-4 border-b-2 border-brand-orange">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold">
          {cat.charAt(0).toUpperCase() + cat.slice(1)}
        </h1>
        <p className="mt-1 text-brand-mid">{CATEGORY_DESCRIPTIONS[cat]}</p>
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-brand-mid text-lg">
            No articles in this section yet. Jean-Claude is working on it.
          </p>
        </div>
      ) : (
        <>
          {/* Featured */}
          {featured && (
            <div className="mb-10 pb-8 border-b border-brand-subtle">
              <ArticleCard article={featured} variant="featured" />
            </div>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rest.map(article => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
