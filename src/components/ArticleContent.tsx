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
  // chapter
  number?: number;
  // person
  name?: string;
  role?: string;
  description?: string;
  // comparison
  left_label?: string;
  right_label?: string;
  points?: { aspect: string; left: string; right: string }[];
  // map_highlight
  region?: string;
  stakes?: string;
}

function Paragraph({ block }: { block: ContentBlock }) {
  return <p>{block.text}</p>;
}

function Heading({ block }: { block: ContentBlock }) {
  if (block.level === 3) return <h3>{block.text}</h3>;
  return <h2>{block.text}</h2>;
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
  const events = block.events ?? [];
  return (
    <div className="my-8 border-t border-brand-rule pt-4">
      {block.title && (
        <h4 className="font-[family-name:var(--font-heading)] text-sm font-bold uppercase tracking-widest text-brand-mid mb-6">
          {block.title}
        </h4>
      )}
      <div>
        {events.map((event, i) => (
          <div key={i} className="grid gap-x-6" style={{ gridTemplateColumns: '1px 1fr', paddingBottom: i < events.length - 1 ? '2rem' : 0 }}>

            {/* ── Left: vertical axis + dot ── */}
            <div className="flex flex-col items-center">
              {/* Dot */}
              <div
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: '#141413',
                  border: '2px solid #141413',
                  flexShrink: 0,
                  marginLeft: -5,
                  marginTop: 4,
                }}
              />
              {/* Connector line below dot */}
              {i < events.length - 1 && (
                <div style={{ flex: 1, width: 1, background: '#d4d2c8', marginTop: 6 }} />
              )}
            </div>

            {/* ── Right: date + title + description ── */}
            <div style={{ paddingLeft: '1.25rem' }}>
              <span
                className="font-[family-name:var(--font-heading)] uppercase"
                style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', color: '#767570', display: 'block', marginBottom: '0.3rem' }}
              >
                {event.date}
              </span>
              <h5 className="font-[family-name:var(--font-heading)] font-bold" style={{ fontSize: '1rem', lineHeight: 1.3, marginBottom: '0.35rem' }}>
                {event.title}
              </h5>
              <p className="font-[family-name:var(--font-body)] italic" style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'rgba(20,20,19,0.6)' }}>
                {event.description}
              </p>
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
      <p className="pull-quote-text">{block.text}</p>
      {block.attribution && (
        <div className="pull-quote-attribution">{block.attribution}</div>
      )}
    </blockquote>
  );
}

function KeyFigure({ block }: { block: ContentBlock }) {
  return (
    <div className="key-figure my-6">
      <div className="key-figure-value">
        {block.value}
      </div>
      <div className="key-figure-label">
        {block.label}
      </div>
      {block.context && (
        <div className="key-figure-context">{block.context}</div>
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
    <div className={`callout ${variantClass}`}>
      <div className="callout-label">
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
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
        <li key={i} className="text-[1.05rem] leading-relaxed text-brand-dark/88">{item}</li>
      ))}
    </Tag>
  );
}

function Separator() {
  return (
    <div className="ornament" aria-hidden>✦</div>
  );
}

function Chapter({ block }: { block: ContentBlock }) {
  return (
    <div className="chapter-marker">
      <div className="chapter-number">Chapter {block.number}</div>
      <div className="chapter-title">{block.title}</div>
    </div>
  );
}

function PullQuote({ block }: { block: ContentBlock }) {
  return (
    <div className="inline-pull-quote">
      <div className="inline-pull-quote-text">{block.text}</div>
      {block.context && (
        <div className="inline-pull-quote-context">{block.context}</div>
      )}
    </div>
  );
}

function Person({ block }: { block: ContentBlock }) {
  return (
    <div className="person-card my-8">
      <div className="person-card-header">
        <div className="person-card-name">{block.name}</div>
        {block.role && <div className="person-card-role">{block.role}</div>}
      </div>
      {block.description && (
        <div className="person-card-body">{block.description}</div>
      )}
    </div>
  );
}

function Comparison({ block }: { block: ContentBlock }) {
  const points = block.points ?? [];
  return (
    <div className="comparison-block my-8">
      <div className="comparison-header">
        <div className="comparison-header-cell">{block.left_label}</div>
        <div className="comparison-header-cell">{block.right_label}</div>
      </div>
      {points.map((p, i) => (
        <div key={i}>
          <div className="comparison-aspect">{p.aspect}</div>
          <div className="comparison-row">
            <div className="comparison-cell">{p.left}</div>
            <div className="comparison-cell comparison-cell-right">{p.right}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MapHighlight({ block }: { block: ContentBlock }) {
  return (
    <div className="map-highlight my-8">
      {block.region && (
        <div className="map-highlight-region">Geographic Focus · {block.region}</div>
      )}
      {block.label && (
        <div className="map-highlight-label">{block.label}</div>
      )}
      {block.context && (
        <div className="map-highlight-text">{block.context}</div>
      )}
      {block.stakes && (
        <div className="map-highlight-stakes">{block.stakes}</div>
      )}
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
          case 'chapter': return <Chapter key={i} block={block} />;
          case 'pull_quote': return <PullQuote key={i} block={block} />;
          case 'quote': return <Quote key={i} block={block} />;
          case 'callout': return <Callout key={i} block={block} />;
          case 'person': return <Person key={i} block={block} />;
          case 'key_figure': return <KeyFigure key={i} block={block} />;
          case 'comparison': return <Comparison key={i} block={block} />;
          case 'map_highlight': return <MapHighlight key={i} block={block} />;
          case 'timeline': return <Timeline key={i} block={block} />;
          case 'table': return <Table key={i} block={block} />;
          case 'list': return <List key={i} block={block} />;
          case 'separator': return <Separator key={i} />;
          default: return null;
        }
      })}
    </div>
  );
}
