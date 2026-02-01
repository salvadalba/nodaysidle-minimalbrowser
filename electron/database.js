/**
 * Drift Browser - Database Module
 * SQLite database for bookmarks and history
 */

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class DriftDatabase {
  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'drift.db');

    console.log('Opening database at:', dbPath);

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initTables();
  }

  initTables() {
    // Bookmarks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT,
        parent_id INTEGER,
        is_folder INTEGER DEFAULT 0,
        position INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (parent_id) REFERENCES bookmarks(id) ON DELETE CASCADE
      )
    `);

    // History table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        visit_count INTEGER DEFAULT 1,
        last_visit INTEGER DEFAULT (strftime('%s', 'now')),
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);
      CREATE INDEX IF NOT EXISTS idx_history_last_visit ON history(last_visit DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_parent ON bookmarks(parent_id);
    `);

    console.log('Database tables initialized');
  }

  // ============================================
  // Bookmarks
  // ============================================

  addBookmark(title, url, parentId = null) {
    const stmt = this.db.prepare(`
      INSERT INTO bookmarks (title, url, parent_id, is_folder)
      VALUES (?, ?, ?, 0)
    `);
    const result = stmt.run(title, url, parentId);
    return this.getBookmarkById(result.lastInsertRowid);
  }

  removeBookmark(id) {
    const stmt = this.db.prepare('DELETE FROM bookmarks WHERE id = ?');
    stmt.run(id);
    return true;
  }

  getBookmarks(parentId = null) {
    const stmt = this.db.prepare(`
      SELECT * FROM bookmarks
      WHERE parent_id IS ?
      ORDER BY position, created_at
    `);
    return stmt.all(parentId);
  }

  getBookmarkById(id) {
    const stmt = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?');
    return stmt.get(id);
  }

  createBookmarkFolder(title, parentId = null) {
    const stmt = this.db.prepare(`
      INSERT INTO bookmarks (title, url, parent_id, is_folder)
      VALUES (?, NULL, ?, 1)
    `);
    const result = stmt.run(title, parentId);
    return this.getBookmarkById(result.lastInsertRowid);
  }

  // ============================================
  // History
  // ============================================

  recordVisit(url, title = null) {
    // Check if URL already exists
    const existing = this.db.prepare('SELECT * FROM history WHERE url = ?').get(url);

    if (existing) {
      // Update existing entry
      const stmt = this.db.prepare(`
        UPDATE history
        SET visit_count = visit_count + 1,
            last_visit = strftime('%s', 'now'),
            title = COALESCE(?, title)
        WHERE id = ?
      `);
      stmt.run(title, existing.id);
      return this.getHistoryById(existing.id);
    } else {
      // Insert new entry
      const stmt = this.db.prepare(`
        INSERT INTO history (url, title)
        VALUES (?, ?)
      `);
      const result = stmt.run(url, title);
      return this.getHistoryById(result.lastInsertRowid);
    }
  }

  getHistory(limit = 100, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM history
      ORDER BY last_visit DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  getHistoryById(id) {
    const stmt = this.db.prepare('SELECT * FROM history WHERE id = ?');
    return stmt.get(id);
  }

  searchHistory(query) {
    const stmt = this.db.prepare(`
      SELECT * FROM history
      WHERE url LIKE ? OR title LIKE ?
      ORDER BY last_visit DESC
      LIMIT 50
    `);
    const pattern = `%${query}%`;
    return stmt.all(pattern, pattern);
  }

  clearHistory(beforeTimestamp = null) {
    if (beforeTimestamp) {
      const stmt = this.db.prepare('DELETE FROM history WHERE last_visit < ?');
      const result = stmt.run(beforeTimestamp);
      return result.changes;
    } else {
      const stmt = this.db.prepare('DELETE FROM history');
      const result = stmt.run();
      return result.changes;
    }
  }

  deleteHistoryEntry(id) {
    const stmt = this.db.prepare('DELETE FROM history WHERE id = ?');
    stmt.run(id);
    return true;
  }

  close() {
    this.db.close();
  }
}

module.exports = DriftDatabase;
