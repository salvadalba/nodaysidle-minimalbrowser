/**
 * Drift Browser - Database Module
 * SQLite database for bookmarks and history
 * Prepared statements cached for performance
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
    this.prepareStatements();
  }

  initTables() {
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

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);
      CREATE INDEX IF NOT EXISTS idx_history_last_visit ON history(last_visit DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_parent ON bookmarks(parent_id);
    `);

    console.log('Database tables initialized');
  }

  /**
   * Pre-compile all SQL statements once for performance
   */
  prepareStatements() {
    // Bookmark statements
    this._stmts = {
      addBookmark: this.db.prepare(
        'INSERT INTO bookmarks (title, url, parent_id, is_folder) VALUES (?, ?, ?, 0)'
      ),
      removeBookmark: this.db.prepare('DELETE FROM bookmarks WHERE id = ?'),
      removeBookmarkByUrl: this.db.prepare('DELETE FROM bookmarks WHERE url = ?'),
      isBookmarked: this.db.prepare(
        'SELECT id FROM bookmarks WHERE url = ? AND is_folder = 0 LIMIT 1'
      ),
      getBookmarks: this.db.prepare(
        'SELECT * FROM bookmarks WHERE parent_id IS ? ORDER BY position, created_at'
      ),
      getBookmarkById: this.db.prepare('SELECT * FROM bookmarks WHERE id = ?'),
      createBookmarkFolder: this.db.prepare(
        'INSERT INTO bookmarks (title, url, parent_id, is_folder) VALUES (?, NULL, ?, 1)'
      ),

      // History statements
      getHistoryByUrl: this.db.prepare('SELECT * FROM history WHERE url = ?'),
      updateVisit: this.db.prepare(
        `UPDATE history SET visit_count = visit_count + 1,
         last_visit = strftime('%s', 'now'), title = COALESCE(?, title) WHERE id = ?`
      ),
      insertVisit: this.db.prepare('INSERT INTO history (url, title) VALUES (?, ?)'),
      getHistory: this.db.prepare(
        'SELECT * FROM history ORDER BY last_visit DESC LIMIT ? OFFSET ?'
      ),
      getHistoryById: this.db.prepare('SELECT * FROM history WHERE id = ?'),
      searchHistory: this.db.prepare(
        'SELECT * FROM history WHERE url LIKE ? OR title LIKE ? ORDER BY last_visit DESC LIMIT 50'
      ),
      clearAllHistory: this.db.prepare('DELETE FROM history'),
      clearHistoryBefore: this.db.prepare('DELETE FROM history WHERE last_visit < ?'),
      deleteHistoryEntry: this.db.prepare('DELETE FROM history WHERE id = ?'),
    };
  }

  // ============================================
  // Bookmarks
  // ============================================

  addBookmark(title, url, parentId = null) {
    const result = this._stmts.addBookmark.run(title, url, parentId);
    return this.getBookmarkById(result.lastInsertRowid);
  }

  removeBookmark(id) {
    this._stmts.removeBookmark.run(id);
    return true;
  }

  removeBookmarkByUrl(url) {
    const result = this._stmts.removeBookmarkByUrl.run(url);
    return result.changes > 0;
  }

  isBookmarked(url) {
    const result = this._stmts.isBookmarked.get(url);
    return result ? { bookmarked: true, id: result.id } : { bookmarked: false, id: null };
  }

  getBookmarks(parentId = null) {
    return this._stmts.getBookmarks.all(parentId);
  }

  getBookmarkById(id) {
    return this._stmts.getBookmarkById.get(id);
  }

  createBookmarkFolder(title, parentId = null) {
    const result = this._stmts.createBookmarkFolder.run(title, parentId);
    return this.getBookmarkById(result.lastInsertRowid);
  }

  // ============================================
  // History
  // ============================================

  recordVisit(url, title = null) {
    const existing = this._stmts.getHistoryByUrl.get(url);

    if (existing) {
      this._stmts.updateVisit.run(title, existing.id);
      return this._stmts.getHistoryById.get(existing.id);
    } else {
      const result = this._stmts.insertVisit.run(url, title);
      return this._stmts.getHistoryById.get(result.lastInsertRowid);
    }
  }

  getHistory(limit = 100, offset = 0) {
    return this._stmts.getHistory.all(limit, offset);
  }

  getHistoryById(id) {
    return this._stmts.getHistoryById.get(id);
  }

  searchHistory(query) {
    const pattern = `%${query}%`;
    return this._stmts.searchHistory.all(pattern, pattern);
  }

  clearHistory(beforeTimestamp = null) {
    if (beforeTimestamp) {
      const result = this._stmts.clearHistoryBefore.run(beforeTimestamp);
      return result.changes;
    } else {
      const result = this._stmts.clearAllHistory.run();
      return result.changes;
    }
  }

  deleteHistoryEntry(id) {
    this._stmts.deleteHistoryEntry.run(id);
    return true;
  }

  close() {
    this.db.close();
  }
}

module.exports = DriftDatabase;
