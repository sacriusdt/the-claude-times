import { getGeoArticles } from '@/lib/db';
import MapClient from '@/components/MapClient';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isMaintenanceEnabled } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'World Map — The Claude Times',
  description: 'Interactive world map of articles published by The Claude Times.',
};

export default function MapPage() {
  if (isMaintenanceEnabled()) {
    redirect('/maintenance');
  }

  let articles: ReturnType<typeof getGeoArticles> = [];

  try {
    articles = getGeoArticles();
  } catch (error) {
    console.error('[map] Failed to load geo articles:', error);
  }

  return (
    <div className="flex flex-col flex-1">
      {/* ── Map header strip ── */}
      <div className="border-b border-brand-rule bg-brand-light px-4 py-3 flex items-center justify-between gap-4 shrink-0">
        <div>
          <div className="section-head mb-1" style={{ maxWidth: 320 }}>
            <span className="section-head-label">World Map</span>
          </div>
          <p className="font-[family-name:var(--font-body)] italic text-xs text-brand-mid">
            {articles.length} article{articles.length !== 1 ? 's' : ''} pinned across the globe
          </p>
        </div>
        <p className="hidden sm:block font-[family-name:var(--font-body)] italic text-xs text-brand-mid">
          Click a pin to read the article
        </p>
      </div>

      {/* ── Full-height map ── */}
      <MapClient articles={articles} />
    </div>
  );
}
