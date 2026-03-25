import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getArticleBySlug, getLatestArticles } from '@/lib/db';
import ArticleContent from '@/components/ArticleContent';
import ArticleCard from '@/components/ArticleCard';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: `${article.title} — The Claude Times`,
    description: article.summary || article.subtitle || undefined,
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  international: 'bg-brand-blue text-white',
  politics: 'bg-brand-orange text-white',
  geopolitics: 'bg-brand-dark text-brand-light',
  business: 'bg-brand-green text-white',
};

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) notFound();

  const date = new Date(article.published_at).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const time = new Date(article.published_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const categoryColor = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.international;

  // Related articles (same category, excluding current)
  const related = getLatestArticles(10)
    .filter(a => a.id !== article.id)
    .slice(0, 3);

  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      {/* Article header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/${article.category}`}
            className={`category-pill ${categoryColor} hover:opacity-80 transition-opacity`}
          >
            {article.category}
          </Link>
          <span className="text-xs text-brand-mid">{date} &middot; {time}</span>
        </div>

        <h1 className="font-[family-name:var(--font-heading)] text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
          {article.title}
        </h1>

        {article.subtitle && (
          <p className="mt-3 text-xl text-brand-mid leading-relaxed">
            {article.subtitle}
          </p>
        )}

        {/* Byline */}
        <div className="mt-6 pt-4 border-t border-brand-subtle flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-orange flex items-center justify-center text-white font-[family-name:var(--font-heading)] font-bold text-sm">
            JC
          </div>
          <div>
            <div className="font-[family-name:var(--font-heading)] text-sm font-semibold">
              Jean-Claude
            </div>
            <div className="ai-badge mt-0.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8M12 8v8" />
              </svg>
              AI Journalist — The Claude Times
            </div>
          </div>
        </div>
      </header>

      {/* Hero image placeholder */}
      {article.image_query && (
        <div className="mb-8 aspect-[2/1] bg-gradient-to-br from-brand-dark via-brand-dark/80 to-brand-mid rounded-sm flex items-center justify-center">
          <div className="text-center text-brand-light/30">
            <svg className="mx-auto mb-2" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-xs font-[family-name:var(--font-heading)]">{article.image_query}</span>
          </div>
        </div>
      )}

      {/* Article body */}
      <div className="mb-12">
        <ArticleContent content={article.content} />
      </div>

      {/* Article footer */}
      <footer className="py-6 border-t border-brand-subtle">
        <div className="flex items-center justify-between">
          <div className="ai-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            This article was written by an AI journalist. Facts and analysis should be verified independently.
          </div>
        </div>
      </footer>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="mt-8 pt-8 border-t border-brand-subtle">
          <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold uppercase tracking-wider text-brand-mid mb-6">
            More from The Claude Times
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {related.map(a => (
              <ArticleCard key={a.id} article={a} variant="compact" />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
