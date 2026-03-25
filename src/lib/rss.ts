import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import { insertFeedItem } from './db';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'TheClaude Times/1.0 (News Aggregator)',
  },
});

interface FeedConfig {
  title: string;
  url: string;
  category: string;
  subcategories: string[];
  country: string;
}

// Categories Jean-Claude covers
const RELEVANT_CATEGORIES = new Set(['News', 'Politics', 'Business']);

function loadFeeds(): FeedConfig[] {
  const feedsPath = path.join(process.cwd(), 'feeds.json');
  const raw = fs.readFileSync(feedsPath, 'utf-8');
  const allFeeds: FeedConfig[] = JSON.parse(raw);
  return allFeeds.filter(f => RELEVANT_CATEGORIES.has(f.category));
}

function mapCategory(feed: FeedConfig): string {
  const sub = feed.subcategories.map(s => s.toLowerCase()).join(' ');
  const title = feed.title.toLowerCase();

  if (feed.category === 'Politics' || sub.includes('politic')) return 'politics';
  if (sub.includes('foreign') || sub.includes('diplomac') || sub.includes('geopolit') || sub.includes('international affairs')) return 'geopolitics';
  if (feed.category === 'Business' || sub.includes('business') || sub.includes('market') || sub.includes('econom')) return 'business';
  if (sub.includes('world') || sub.includes('international') || title.includes('world')) return 'international';

  // Default mapping by feed category
  if (feed.category === 'News') return 'international';
  return 'international';
}

export async function pollFeeds(): Promise<{ fetched: number; errors: string[] }> {
  const feeds = loadFeeds();
  let fetched = 0;
  const errors: string[] = [];

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        const category = mapCategory(feed);
        let count = 0;

        for (const item of parsed.items || []) {
          if (!item.title || !item.link) continue;

          const result = insertFeedItem({
            feed_title: feed.title,
            title: item.title.trim(),
            link: item.link,
            description: (item.contentSnippet || item.content || '').slice(0, 1000),
            pub_date: item.pubDate || item.isoDate || new Date().toISOString(),
            category,
          });

          if (result.changes > 0) count++;
        }
        return count;
      } catch (err) {
        errors.push(`${feed.title}: ${(err as Error).message}`);
        return 0;
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') fetched += r.value;
  }

  return { fetched, errors };
}
