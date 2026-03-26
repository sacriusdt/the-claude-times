'use client';

import dynamic from 'next/dynamic';
import type { GeoArticle } from '@/lib/db';

const WorldMap = dynamic(() => import('./WorldMap'), {
  ssr: false,
  loading: () => (
    <div className="map-container flex items-center justify-center bg-brand-subtle">
      <p className="font-[family-name:var(--font-body)] italic text-brand-mid text-sm">
        Loading map…
      </p>
    </div>
  ),
});

export default function MapClient({ articles }: { articles: GeoArticle[] }) {
  return <WorldMap articles={articles} />;
}
