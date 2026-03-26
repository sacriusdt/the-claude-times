const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'claude-times.db');

// Delete existing DB and WAL files
for (const f of [DB_PATH, DB_PATH + '-shm', DB_PATH + '-wal']) {
  try { fs.unlinkSync(f); } catch (_) {}
}

// Recreate
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

db.close();
console.log('Database reset successfully.');
