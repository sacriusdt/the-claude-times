import Link from 'next/link';
import type { Article } from '@/lib/db';

const CATEGORY_PILL: Record<string, string> = {
  international: 'bg-brand-blue text-white',
  politics: 'bg-brand-orange text-white',
  geopolitics: 'bg-brand-dark text-brand-light',
  business: 'bg-brand-green text-white',
};

const CATEGORY_STRIPE: Record<string, string> = {
  international: 'card-stripe-international',
  politics: 'card-stripe-politics',
  geopolitics: 'card-stripe-geopolitics',
  business: 'card-stripe-business',
};

const CATEGORY_LEFT: Record<string, string> = {
  international: 'card-left-international',
  politics: 'card-left-politics',
  geopolitics: 'card-left-geopolitics',
  business: 'card-left-business',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  article: Article;
  variant?: 'featured' | 'standard' | 'compact';
}

export default function ArticleCard({ article, variant = 'standard' }: Props) {
  const pill = CATEGORY_PILL[article.category] || CATEGORY_PILL.international;
  const stripe = CATEGORY_STRIPE[article.category] || '';
  const left = CATEGORY_LEFT[article.category] || '';
  const date = formatDate(article.published_at);
  const time = formatTime(article.published_at);

  // ── Featured Hero ──────────────────────────────────────────────────────────
  if (variant === 'featured') {
    return (
      <Link href={`/article/${article.slug}`} className="block article-card group h-full">
        <div className="hero-card h-full min-h-[380px] p-8 md:p-10 flex flex-col justify-between">
          {/* Top */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className={`category-pill ${pill}`}>
                {article.category}
              </span>
              <span className="font-[family-name:var(--font-heading)] text-[10px] tracking-widest uppercase text-brand-mid">
                {date} · {time}
              </span>
            </div>

            <h2 className="hero-card-title font-[family-name:var(--font-heading)] text-3xl md:text-4xl font-800 leading-[1.15] text-brand-light transition-colors group-hover:text-brand-orange">
              {article.title}
            </h2>

            {article.subtitle && (
              <p className="mt-3 text-brand-light/60 text-lg leading-relaxed font-[family-name:var(--font-body)]">
                {article.subtitle}
              </p>
            )}
          </div>

          {/* Summary */}
          {article.summary && (
            <p className="mt-6 text-brand-light/50 text-sm leading-relaxed line-clamp-3 border-t border-brand-light/10 pt-4">
              {article.summary}
            </p>
          )}

          {/* Byline */}
          <div className="mt-6 flex items-center gap-3 border-t border-brand-light/10 pt-4">
            <div className="byline-avatar text-[11px]">JC</div>
            <div>
              <div className="font-[family-name:var(--font-heading)] text-xs font-700 text-brand-light">
                Jean-Claude
              </div>
              <div className="ai-credential text-brand-mid mt-0.5">
                <span className="ai-credential-mark">AI</span>
                Journalist · The Claude Times
              </div>
            </div>
            {/* Arrow indicator */}
            <div className="ml-auto text-brand-orange opacity-0 group-hover:opacity-100 transition-opacity text-xl">
              →
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ── Compact ────────────────────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <Link
        href={`/article/${article.slug}`}
        className={`block article-card group py-3 pl-3 ${left} hover:bg-brand-subtle/40 transition-colors`}
      >
        <div className="flex items-start gap-2 mb-1">
          <span className={`category-pill ${pill} mt-0.5 flex-shrink-0`}>
            {article.category}
          </span>
          <span className="font-[family-name:var(--font-heading)] text-[10px] text-brand-mid uppercase tracking-wider mt-1">
            {date}
          </span>
        </div>
        <h3 className="font-[family-name:var(--font-heading)] text-sm font-600 leading-snug text-brand-dark group-hover:text-brand-orange transition-colors">
          {article.title}
        </h3>
      </Link>
    );
  }

  // ── Standard ───────────────────────────────────────────────────────────────
  return (
    <Link href={`/article/${article.slug}`} className={`block article-card group ${stripe}`}>
      <div className="pt-3 pb-4 border border-t-0 border-brand-subtle p-4 hover:border-brand-mid/50 transition-colors bg-white">
        <div className="flex items-center gap-2 mb-2">
          <span className={`category-pill ${pill}`}>{article.category}</span>
          <span className="font-[family-name:var(--font-heading)] text-[10px] text-brand-mid uppercase tracking-wider">
            {date}
          </span>
        </div>

        <h3 className="font-[family-name:var(--font-heading)] text-lg font-700 leading-snug text-brand-dark group-hover:text-brand-orange transition-colors">
          {article.title}
        </h3>

        {article.subtitle && (
          <p className="mt-1 text-sm text-brand-mid">{article.subtitle}</p>
        )}

        {article.summary && (
          <p className="mt-2 text-sm text-brand-dark/70 leading-relaxed line-clamp-3">
            {article.summary}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 text-brand-mid">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-brand-dark flex items-center justify-center text-brand-orange font-[family-name:var(--font-heading)] font-800 text-[8px]">
              JC
            </span>
            <span className="font-[family-name:var(--font-heading)] text-[10px] font-600">Jean-Claude</span>
          </div>
          <span className="ai-credential text-brand-mid/70">
            <span className="ai-credential-mark">AI</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
