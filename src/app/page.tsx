import { getLatestArticles, getArticlesByCategory } from '@/lib/db';
import ArticleCard from '@/components/ArticleCard';

export const dynamic = 'force-dynamic';

export default function FrontPage() {
  const allArticles = getLatestArticles(20);
  const featured = allArticles[0];
  const secondary = allArticles.slice(1, 4);
  const rest = allArticles.slice(4);

  // Get latest per category for the sidebar
  const categories = ['international', 'politics', 'geopolitics', 'business'] as const;
  const byCategory = Object.fromEntries(
    categories.map(cat => [cat, getArticlesByCategory(cat, 3)])
  );

  if (allArticles.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="max-w-lg mx-auto">
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold mb-4">
            The presses are warming up.
          </h2>
          <p className="text-brand-mid text-lg leading-relaxed">
            Jean-Claude hasn&apos;t published any articles yet. Once the editorial pipeline
            starts running, articles will appear here automatically.
          </p>
          <div className="mt-8 p-6 bg-white border border-brand-subtle rounded-sm text-left">
            <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold uppercase tracking-wider text-brand-mid mb-3">
              Getting Started
            </h3>
            <ol className="space-y-2 text-sm text-brand-dark/70">
              <li>1. Copy <code className="text-brand-orange">.env.example</code> to <code className="text-brand-orange">.env</code></li>
              <li>2. Set your AI provider and API keys</li>
              <li>3. Set your <code className="text-brand-orange">TAVILY_API_KEY</code> for web search</li>
              <li>4. Set an <code className="text-brand-orange">ADMIN_PASSWORD</code></li>
              <li>5. Visit <code className="text-brand-orange">/chat</code> to tell Jean-Claude to write his first article</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Featured + Secondary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8 border-b border-brand-subtle">
        {/* Featured article */}
        {featured && (
          <div className="lg:col-span-2">
            <ArticleCard article={featured} variant="featured" />
          </div>
        )}

        {/* Secondary articles */}
        <div className="space-y-6 lg:pl-6 lg:border-l lg:border-brand-subtle">
          <h3 className="font-[family-name:var(--font-heading)] text-xs font-semibold uppercase tracking-wider text-brand-mid">
            Latest
          </h3>
          {secondary.map(article => (
            <ArticleCard key={article.id} article={article} variant="compact" />
          ))}
        </div>
      </div>

      {/* Category sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-8">
        {categories.map(cat => {
          const articles = byCategory[cat];
          if (!articles || articles.length === 0) return null;
          return (
            <section key={cat}>
              <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold uppercase tracking-wider text-brand-orange border-b-2 border-brand-orange pb-2 mb-4">
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </h3>
              <div className="space-y-4">
                {articles.map(article => (
                  <ArticleCard key={article.id} article={article} variant="compact" />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* More articles */}
      {rest.length > 0 && (
        <section className="mt-12 pt-8 border-t border-brand-subtle">
          <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold uppercase tracking-wider text-brand-mid mb-6">
            More Stories
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rest.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
