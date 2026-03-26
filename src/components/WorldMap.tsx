'use client';

import { useEffect, useRef } from 'react';
import type { GeoArticle } from '@/lib/db';

interface Props {
  articles: GeoArticle[];
}

export default function WorldMap({ articles }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamic import to avoid SSR issues
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [20, 10],
        zoom: 2,
        minZoom: 2,
        maxZoom: 10,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      mapInstanceRef.current = map;

      // CartoDB Positron — clean, muted, no API key needed
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);

      // Custom dot marker (small editorial circle)
      const dotIcon = L.divIcon({
        className: 'map-pin',
        html: '<div class="map-pin-dot"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -12],
      });

      // Add markers
      articles.forEach((article) => {
        const categoryLabel = article.category.charAt(0).toUpperCase() + article.category.slice(1);
        const date = new Date(article.published_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });

        const popupHtml = `
          <div class="map-popup">
            <div class="map-popup-kicker">${categoryLabel}${article.geo_label ? ` · ${article.geo_label}` : ''}</div>
            <a class="map-popup-title" href="/article/${article.slug}">${article.title}</a>
            ${article.summary ? `<p class="map-popup-summary">${article.summary}</p>` : ''}
            <div class="map-popup-date">${date}</div>
            <a class="map-popup-link" href="/article/${article.slug}">Read article →</a>
          </div>
        `;

        L.marker([article.geo_lat, article.geo_lng], { icon: dotIcon })
          .bindPopup(popupHtml, { maxWidth: 300, className: 'map-popup-wrapper' })
          .addTo(map);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [articles]);

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <div ref={mapRef} className="map-container" />
    </>
  );
}
