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
  subtitle?: string;
  category: string;
  content: string;
  summary?: string;
  source_items?: string;
  image_url?: string;
  image_query?: string;
}) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO articles (slug, title, subtitle, category, content, summary, source_items, image_url, image_query)
    VALUES (@slug, @title, @subtitle, @category, @content, @summary, @source_items, @image_url, @image_query)
  `).run(article);
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

export function getAllArticles(limit = 100) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM articles WHERE status = 'published'
    ORDER BY published_at DESC LIMIT ?
  `).all(limit) as Article[];
}

// --- Chat ---

export function insertChatMessage(role: string, content: string) {
  const db = getDb();
  return db.prepare('INSERT INTO chat_messages (role, content) VALUES (?, ?)').run(role, content);
}

export function getChatHistory(limit = 50) {
  const db = getDb();
  return db.prepare('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT ?').all(limit) as ChatMessage[];
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
  author: string;
  published_at: string;
  status: string;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}
