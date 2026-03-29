import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'claude-times.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_title TEXT,
      title TEXT NOT NULL,
      link TEXT UNIQUE,
      description TEXT,
      pub_date TEXT,
      category TEXT,
      fetched_at TEXT DEFAULT (datetime('now')),
      analyzed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      source_items TEXT,
      image_url TEXT,
      image_query TEXT,
      geo_lat REAL,
      geo_lng REAL,
      geo_label TEXT,
      author TEXT DEFAULT 'Jean-Claude',
      published_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'published'
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
    CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
    CREATE INDEX IF NOT EXISTS idx_feed_items_analyzed ON feed_items(analyzed);
  `);

  // Add geo columns to existing DBs (safe to run multiple times)
  for (const col of [
    "ALTER TABLE articles ADD COLUMN status TEXT DEFAULT 'published'",
    "ALTER TABLE articles ADD COLUMN published_at TEXT DEFAULT (datetime('now'))",
    'ALTER TABLE articles ADD COLUMN source_items TEXT',
    'ALTER TABLE articles ADD COLUMN image_url TEXT',
    'ALTER TABLE articles ADD COLUMN image_query TEXT',
    'ALTER TABLE articles ADD COLUMN geo_lat REAL',
    'ALTER TABLE articles ADD COLUMN geo_lng REAL',
    'ALTER TABLE articles ADD COLUMN geo_label TEXT',
    "ALTER TABLE articles ADD COLUMN author TEXT DEFAULT 'Jean-Claude'",
    "ALTER TABLE chat_messages ADD COLUMN journalist TEXT DEFAULT 'jean-claude'",
  ]) {
    try { db.exec(col); } catch { /* column already exists */ }
  }
}

// --- Feed Items ---

export function insertFeedItem(item: {
  feed_title: string;
  title: string;
  link: string;
  description: string;
  pub_date: string;
  category: string;
}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO feed_items (feed_title, title, link, description, pub_date, category)
    VALUES (@feed_title, @title, @link, @description, @pub_date, @category)
  `);
  return stmt.run(item);
}

export function getUnanalyzedItems(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM feed_items WHERE analyzed = 0 ORDER BY fetched_at DESC LIMIT ?
  `).all(limit) as FeedItem[];
}

export function markItemsAnalyzed(ids: number[]) {
  const db = getDb();
  const stmt = db.prepare('UPDATE feed_items SET analyzed = 1 WHERE id = ?');
  const tx = db.transaction(() => {
    for (const id of ids) stmt.run(id);
  });
  tx();
}

// --- Articles ---

export function insertArticle(article: {
  slug: string;
  title: string;
  subtitle?: string | null;
  category: string;
  content: string;
  summary?: string;
  source_items?: string;
  image_url?: string;
  image_query?: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  geo_label?: string | null;
  author?: string;
}) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO articles (slug, title, subtitle, category, content, summary, source_items, image_url, image_query, geo_lat, geo_lng, geo_label, author)
    VALUES (@slug, @title, @subtitle, @category, @content, @summary, @source_items, @image_url, @image_query, @geo_lat, @geo_lng, @geo_label, @author)
  `).run({ ...article, author: article.author ?? 'Jean-Claude' });
}

export function getGeoArticles() {
  const db = getDb();
  return db.prepare(`
    SELECT id, slug, title, subtitle, summary, category, published_at, geo_lat, geo_lng, geo_label
    FROM articles
    WHERE status = 'published' AND geo_lat IS NOT NULL AND geo_lng IS NOT NULL
    ORDER BY published_at DESC
  `).all() as GeoArticle[];
}

export function getArticleBySlug(slug: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM articles WHERE slug = ? AND status = ?').get(slug, 'published') as Article | undefined;
}

export function getArticlesByCategory(category: string, limit = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM articles WHERE category = ? AND status = 'published'
    ORDER BY published_at DESC LIMIT ?
  `).all(category, limit) as Article[];
}

export function getLatestArticles(limit = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM articles WHERE status = 'published'
    ORDER BY published_at DESC LIMIT ?
  `).all(limit) as Article[];
}

export function deleteArticle(slug: string) {
  const db = getDb();
  return db.prepare('DELETE FROM articles WHERE slug = ?').run(slug);
}

// Returns a lightweight memory of recent articles for editorial deduplication (across all journalists)
export function getRecentArticleMemory(limit = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT title, subtitle, category, summary, published_at, author
    FROM articles WHERE status = 'published'
    ORDER BY published_at DESC LIMIT ?
  `).all(limit) as Pick<Article, 'title' | 'subtitle' | 'category' | 'summary' | 'published_at' | 'author'>[];
}

export function getAllArticles(limit = 100) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM articles WHERE status = 'published'
    ORDER BY published_at DESC LIMIT ?
  `).all(limit) as Article[];
}

// --- Chat ---

export function insertChatMessage(role: string, content: string, journalist: string = 'jean-claude') {
  const db = getDb();
  return db.prepare('INSERT INTO chat_messages (role, content, journalist) VALUES (?, ?, ?)').run(role, content, journalist);
}

export function getChatHistory(limit = 50, journalist: string = 'jean-claude') {
  const db = getDb();
  return db.prepare('SELECT * FROM chat_messages WHERE journalist = ? ORDER BY created_at DESC LIMIT ?').all(journalist, limit) as ChatMessage[];
}

// --- Agent State ---

export function getAgentState(key: string): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT value FROM agent_state WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setAgentState(key: string, value: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO agent_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
}

// --- Types ---

export interface FeedItem {
  id: number;
  feed_title: string;
  title: string;
  link: string;
  description: string;
  pub_date: string;
  category: string;
  fetched_at: string;
  analyzed: number;
}

export interface Article {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  content: string;
  summary: string | null;
  source_items: string | null;
  image_url: string | null;
  image_query: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_label: string | null;
  author: string;
  published_at: string;
  status: string;
}

export interface GeoArticle {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  category: string;
  published_at: string;
  geo_lat: number;
  geo_lng: number;
  geo_label: string | null;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  journalist: string;
  created_at: string;
}
