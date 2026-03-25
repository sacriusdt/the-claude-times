'use client';

interface ContentBlock {
  type: string;
  text?: string;
  level?: number;
  query?: string;
  caption?: string;
  url?: string;
  alt?: string;
  headers?: string[];
  rows?: string[][];
  title?: string;
  events?: { date: string; title: string; description: string }[];
  attribution?: string;
  value?: string;
  label?: string;
  context?: string;
  variant?: 'analysis' | 'context' | 'opinion';
  items?: string[];
  ordered?: boolean;
}

function Paragraph({ block }: { block: ContentBlock }) {
  return <p>{block.text}</p>;
}

function Heading({ block }: { block: ContentBlock }) {
  if (block.level === 3) return <h3>{block.text}</h3>;
  return <h2>{block.text}</h2>;
}

function ImageBlock({ block }: { block: ContentBlock }) {
  return (
    <figure className="my-8">
      <div className="aspect-[16/9] bg-gradient-to-br from-brand-subtle to-brand-mid/20 rounded-sm flex items-center justify-center overflow-hidden">
        <div className="text-center text-brand-mid/60 p-4">
          <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span className="text-xs font-[family-name:var(--font-heading)]">{block.query || block.alt || 'Image'}</span>
        </div>
      </div>
      {block.caption && (
        <figcaption className="mt-2 text-sm text-brand-mid text-center italic">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

function Table({ block }: { block: ContentBlock }) {
  return (
    <div className="my-8 overflow-x-auto">
      {block.caption && (
        <p className="mb-2 font-[family-name:var(--font-heading)] text-sm font-semibold uppercase tracking-wider text-brand-mid">
          {block.caption}
        </p>
      )}
      <table className="editorial-table">
        <thead>
          <tr>
            {block.headers?.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows?.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({ block }: { block: ContentBlock }) {
  return (
    <div className="my-8">
      {block.title && (
        <h4 className="font-[family-name:var(--font-heading)] text-lg font-semibold mb-4">{block.title}</h4>
      )}
      <div className="relative pl-8">
        <div className="timeline-line" />
        {block.events?.map((event, i) => (
          <div key={i} className="relative pb-6 last:pb-0">
            <div className="timeline-dot" />
            <div className="ml-4">
              <span className="font-[family-name:var(--font-heading)] text-xs font-semibold text-brand-orange uppercase tracking-wider">
                {event.date}
              </span>
              <h5 className="font-[family-name:var(--font-heading)] text-base font-semibold mt-0.5">
                {event.title}
              </h5>
              <p className="text-sm text-brand-dark/70 mt-0.5">{event.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Quote({ block }: { block: ContentBlock }) {
  return (
    <blockquote className="pull-quote">
      &ldquo;{block.text}&rdquo;
      {block.attribution && (
        <div className="attribution">&mdash; {block.attribution}</div>
      )}
    </blockquote>
  );
}

function KeyFigure({ block }: { block: ContentBlock }) {
  return (
    <div className="key-figure my-6">
      <div className="font-[family-name:var(--font-heading)] text-3xl font-bold text-brand-orange">
        {block.value}
      </div>
      <div className="font-[family-name:var(--font-heading)] text-sm font-semibold mt-1 uppercase tracking-wider">
        {block.label}
      </div>
      {block.context && (
        <p className="text-sm text-brand-dark/60 mt-1">{block.context}</p>
      )}
    </div>
  );
}

function Callout({ block }: { block: ContentBlock }) {
  const variantClass = block.variant === 'analysis'
    ? 'callout-analysis'
    : block.variant === 'opinion'
      ? 'callout-opinion'
      : 'callout-context';

  const variantLabel = block.variant === 'analysis'
    ? 'Analysis'
    : block.variant === 'opinion'
      ? "Jean-Claude's Take"
      : 'Context';

  return (
    <div className={`${variantClass} p-5 my-6 rounded-r-sm`}>
      <div className="font-[family-name:var(--font-heading)] text-xs font-semibold uppercase tracking-wider text-brand-mid mb-2">
        {block.title || variantLabel}
      </div>
      <p className="text-[0.95rem] leading-relaxed">{block.text}</p>
    </div>
  );
}

function List({ block }: { block: ContentBlock }) {
  const Tag = block.ordered ? 'ol' : 'ul';
  return (
    <Tag className={`my-4 pl-6 space-y-1.5 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
      {block.items?.map((item, i) => (
        <li key={i} className="text-[1.05rem] leading-relaxed">{item}</li>
      ))}
    </Tag>
  );
}

function Separator() {
  return (
    <div className="my-8 flex items-center justify-center gap-2 text-brand-mid">
      <span className="w-1.5 h-1.5 rounded-full bg-brand-mid" />
      <span className="w-1.5 h-1.5 rounded-full bg-brand-mid" />
      <span className="w-1.5 h-1.5 rounded-full bg-brand-mid" />
    </div>
  );
}

export default function ArticleContent({ content }: { content: string }) {
  let blocks: ContentBlock[];
  try {
    blocks = JSON.parse(content);
  } catch {
    return <p className="text-red-500">Error rendering article content.</p>;
  }

  if (!Array.isArray(blocks)) return null;

  return (
    <div className="article-content">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'paragraph': return <Paragraph key={i} block={block} />;
          case 'heading': return <Heading key={i} block={block} />;
          case 'image': return <ImageBlock key={i} block={block} />;
          case 'table': return <Table key={i} block={block} />;
          case 'timeline': return <Timeline key={i} block={block} />;
          case 'quote': return <Quote key={i} block={block} />;
          case 'key_figure': return <KeyFigure key={i} block={block} />;
          case 'callout': return <Callout key={i} block={block} />;
          case 'list': return <List key={i} block={block} />;
          case 'separator': return <Separator key={i} />;
          default: return null;
        }
      })}
    </div>
  );
}
