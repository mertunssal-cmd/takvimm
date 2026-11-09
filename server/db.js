// SQLite veritabanı katmanı.
// Node.js 22'nin yerleşik "node:sqlite" modülünü kullanıyoruz; ekstra derleme
// gerektiren bir paket yok. Veritabanı tek bir dosyadır (varsayılan data/takvim.db).

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_INTERVALS } from '../shared/schedule.js';

/**
 * Tablolar:
 *  courses  : dersler (ad, renk, sınav tarihi)
 *  topics   : çalışılan konular (hangi derse ait, ne zaman çalışıldı)
 *  tasks    : takvimdeki kutular. kind = 'study' (ilk çalışma) veya 'review' (tekrar).
 *             seq: 0 = çalışma, 1,2,3... = kaçıncı tekrar olduğu
 *  settings : anahtar/değer ayarları (ör. tekrar aralıkları)
 *  sessions : giriş yapılmış oturumlar (cookie'deki rastgele anahtarın SHA-256 özeti)
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS courses (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  color     TEXT NOT NULL,
  exam_date TEXT
);
CREATE TABLE IF NOT EXISTS topics (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  study_date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  kind     TEXT NOT NULL CHECK (kind IN ('study', 'review')),
  seq      INTEGER NOT NULL,
  date     TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_tasks_topic ON tasks(topic_id);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
`;

export function openDatabase(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;'); // aynı anda okuma/yazma için daha sağlam
  db.exec('PRAGMA foreign_keys = ON;'); // ders silinince konuları/görevleri de sil
  db.exec(SCHEMA);
  return db;
}

/** Verilen fonksiyonu tek bir işlem (transaction) içinde çalıştırır: ya hepsi ya hiçbiri. */
export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---------- Ayarlar ----------

export function getIntervals(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'intervals'").get();
  return row ? JSON.parse(row.value) : DEFAULT_INTERVALS;
}

export function setIntervals(db, intervals) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('intervals', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(JSON.stringify(intervals));
}

// ---------- Görevler ----------

/**
 * Bir konunun tekrarlarını tarih sırasına göre yeniden numaralar (1., 2., 3. tekrar...).
 * Elle tekrar eklenince ya da bir tekrar taşınınca etiketler doğru kalsın diye çağrılır.
 */
export function renumberReviews(db, topicId) {
  const reviews = db
    .prepare("SELECT id FROM tasks WHERE topic_id = ? AND kind = 'review' ORDER BY date, seq, id")
    .all(topicId);
  const update = db.prepare('UPDATE tasks SET seq = ? WHERE id = ?');
  reviews.forEach((r, i) => update.run(i + 1, r.id));
}

/** Takvimde gösterilecek tüm görevler; ders ve konu bilgileriyle birlikte. */
export function listTasks(db) {
  return db
    .prepare(
      `SELECT t.id, t.topic_id AS topicId, t.kind, t.seq, t.date, t.done,
              tp.name AS topicName, c.id AS courseId, c.name AS courseName, c.color
         FROM tasks t
         JOIN topics tp ON tp.id = t.topic_id
         JOIN courses c ON c.id = tp.course_id
        ORDER BY t.date, c.name, tp.name, t.seq`,
    )
    .all()
    .map((t) => ({ ...t, done: !!t.done }));
}
