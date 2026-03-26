import Link from 'next/link';
import type { Article } from '@/lib/db';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Props {
  article: Article;
  variant?: 'featured' | 'standard' | 'compact';
}

/* ══════════════════════════════════════════════════════════
   Featured  — dark hero block. Heavyweight Playfair headline.
   ══════════════════════════════════════════════════════════ */
export default function ArticleCard({ article, variant = 'standard' }: Props) {
  const date = fmtDate(article.published_at);

  if (variant === 'featured') {
    return (
      <Link href={`/article/${article.slug}`} className="block story-card group">
        <div className="hero-block p-8 md:p-10 flex flex-col gap-5 min-h-[380px]">

          {/* Kicker */}
          <div className="flex items-center gap-3">
            <span className="kicker text-brand-light/40">{cap(article.category)}</span>
            <span className="w-3 h-px bg-brand-light/20" />
            <span className="story-meta text-brand-light/30">{date}</span>
          </div>

          {/* Headline */}
          <div className="flex-1">
            <h2 className="hero-title">{article.title}</h2>
            {article.subtitle && (
              <p className="mt-3 font-[family-name:var(--font-body)] italic text-brand-light/55 text-base leading-relaxed max-w-xl">
                {article.subtitle}
              </p>
            )}
          </div>

          {/* Summary */}
          {article.summary && (
            <p className="font-[family-name:var(--font-body)] text-sm text-brand-light/40 leading-relaxed line-clamp-3 border-t border-brand-light/10 pt-4">
              {article.summary}
            </p>
          )}

          {/* Byline */}
          <div className="flex items-center gap-3 border-t border-brand-light/10 pt-4">
            <div className="byline-avatar text-[10px]">{article.author === 'Sophia' ? 'S' : 'JC'}</div>
            <div>
              <p className="font-[family-name:var(--font-heading)] italic text-sm font-bold text-brand-light/80">
                By {article.author || 'Jean-Claude'}
              </p>
              <p className="ai-note text-brand-light/30 mt-0.5">AI Correspondent · The Claude Times</p>
            </div>
            <span className="ml-auto text-brand-light/20 group-hover:text-brand-light/60 transition-colors text-sm font-[family-name:var(--font-heading)] italic">
              Read →
            </span>
          </div>
        </div>
      </Link>
    );
  }

  /* ══════════════════════════════════════════════════════════
     Compact  — right-rail and category columns.
     No background. Minimal. Separated by 0.5px rules.
     ══════════════════════════════════════════════════════════ */
  if (variant === 'compact') {
    return (
      <Link href={`/article/${article.slug}`} className="block story-card group story-block pt-3">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="kicker">{cap(article.category)}</span>
          <span className="w-2 h-px bg-brand-rule mt-1" />
          <span className="story-meta">{date}</span>
        </div>
        <h3 className="story-title-sm">{article.title}</h3>
        {article.summary && (
          <p className="mt-1 font-[family-name:var(--font-body)] text-sm text-brand-mid leading-relaxed line-clamp-2 italic">
            {article.summary}
          </p>
        )}
      </Link>
    );
  }

  /* ══════════════════════════════════════════════════════════
     Standard  — section grid. Double-rule top, no background.
     ══════════════════════════════════════════════════════════ */
  return (
    <Link href={`/article/${article.slug}`} className="block story-card group story-block">
      {/* Section double-rule */}
      <div className="section-head mb-3" />

      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="kicker">{cap(article.category)}</span>
        <span className="w-2 h-px bg-brand-rule mt-1" />
        <span className="story-meta">{date}</span>
      </div>

      <h3 className="story-title-md">{article.title}</h3>

      {article.subtitle && (
        <p className="mt-1 font-[family-name:var(--font-body)] italic text-sm text-brand-mid line-clamp-1">
          {article.subtitle}
        </p>
      )}

      {article.summary && (
        <p className="mt-2 story-deck text-sm line-clamp-3">{article.summary}</p>
      )}

      <p className="mt-3 ai-note">By {article.author || 'Jean-Claude'}, AI Correspondent</p>
    </Link>
  );
}
