// REST API. Tüm route'lar /api altında ve giriş gerektirir (app.js'de bağlanıyor).
//
// Özet:
//   GET    /api/data                 -> dersler + görevler + ayarlar (tek seferde)
//   POST   /api/courses              -> ders ekle
//   PUT    /api/courses/:id          -> ders düzenle
//   DELETE /api/courses/:id          -> ders sil (konuları ve görevleriyle)
//   PUT    /api/settings             -> tekrar aralıklarını değiştir
//   POST   /api/studies              -> "Çalıştım": konu + otomatik tekrarlar oluşturur
//   POST   /api/tasks                -> var olan konuya elle tekrar ekle
//   PATCH  /api/tasks/:id            -> tarih değiştir / tamamlandı işaretle
//   DELETE /api/tasks/:id            -> görevi sil (çalışma silinirse konu tamamen silinir)
//   PUT    /api/topics/:id           -> konuyu düzenle (ad / ders)
//   GET    /api/backup               -> JSON yedek indir
//   POST   /api/restore              -> JSON yedekten geri yükle (mevcut veriyi siler!)

import express from 'express';
import { addDays, diffDays, isValidDate } from '../shared/dates.js';
import { computeReviewDates, normalizeIntervals } from '../shared/schedule.js';
import { getIntervals, listTasks, renumberReviews, setIntervals, transaction } from './db.js';

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Kullanıcıya gösterilecek hata. Route'larda `throw bad('mesaj')` ile kullanılır. */
class BadRequest extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new BadRequest(msg);
const notFound = () => new BadRequest('Kayıt bulunamadı.', 404);

/** Metni temizler ve boş/çok uzun mu diye kontrol eder. */
function cleanText(value, field, max = 100) {
  const s = String(value ?? '').trim();
  if (!s) throw bad(`${field} boş olamaz.`);
  if (s.length > max) throw bad(`${field} en fazla ${max} karakter olabilir.`);
  return s;
}

function cleanDate(value, field, { optional = false } = {}) {
  if (optional && (value === null || value === undefined || value === '')) return null;
  if (!isValidDate(value)) throw bad(`${field} geçerli bir tarih değil.`);
  return value;
}

function cleanCourse(body) {
  const color = String(body.color ?? '');
  if (!COLOR_RE.test(color)) throw bad('Renk #RRGGBB biçiminde olmalı.');
  return {
    name: cleanText(body.name, 'Ders adı', 60),
    color,
    examDate: cleanDate(body.examDate, 'Sınav tarihi', { optional: true }),
  };
}

export function createApiRouter(db) {
  const router = express.Router();

  const getCourse = (id) => db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
  const getTask = (id) => db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  const insertTask = db.prepare(
    'INSERT INTO tasks (topic_id, kind, seq, date, done) VALUES (?, ?, ?, ?, ?)',
  );

  function allData() {
    return {
      courses: db
        .prepare('SELECT id, name, color, exam_date AS examDate FROM courses ORDER BY name')
        .all(),
      tasks: listTasks(db),
      settings: { intervals: getIntervals(db) },
    };
  }

  router.get('/data', (req, res) => res.json(allData()));

  // ---------- Dersler ----------

  router.post('/courses', (req, res) => {
    const c = cleanCourse(req.body);
    const r = db
      .prepare('INSERT INTO courses (name, color, exam_date) VALUES (?, ?, ?)')
      .run(c.name, c.color, c.examDate);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });

  router.put('/courses/:id', (req, res) => {
    if (!getCourse(req.params.id)) throw notFound();
    const c = cleanCourse(req.body);
    db.prepare('UPDATE courses SET name = ?, color = ?, exam_date = ? WHERE id = ?').run(
      c.name,
      c.color,
      c.examDate,
      req.params.id,
    );
    res.json({ ok: true });
  });

  router.delete('/courses/:id', (req, res) => {
    const r = db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
    if (r.changes === 0) throw notFound();
    res.json({ ok: true });
  });

  // ---------- Ayarlar ----------

  router.put('/settings', (req, res) => {
    const intervals = normalizeIntervals(req.body?.intervals);
    if (!intervals) throw bad('Aralıklar 1–365 arası tam sayılar olmalı (en fazla 10 tane).');
    setIntervals(db, intervals);
    res.json({ intervals });
  });

  // ---------- Çalışma ("Çalıştım") ----------

  router.post('/studies', (req, res) => {
    const course = getCourse(req.body?.courseId);
    if (!course) throw bad('Ders seçin.');
    const name = cleanText(req.body.topic, 'Konu', 100);
    const date = cleanDate(req.body.date, 'Tarih');

    // Asıl iş burada: tekrar günlerini hesapla (sınav tarihine göre kısaltma dahil).
    const reviewDates = computeReviewDates(date, getIntervals(db), course.exam_date);

    const topicId = transaction(db, () => {
      const t = db
        .prepare('INSERT INTO topics (course_id, name, study_date) VALUES (?, ?, ?)')
        .run(course.id, name, date);
      const id = Number(t.lastInsertRowid);
      // "Çalıştım" denildiği için çalışma kutusu yapılmış sayılır. İstemci ileri bir
      // tarihe plan olarak eklerse done:false gönderir.
      insertTask.run(id, 'study', 0, date, req.body.done === false ? 0 : 1);
      reviewDates.forEach((d, i) => insertTask.run(id, 'review', i + 1, d, 0));
      return id;
    });
    res.status(201).json({ topicId, reviewDates });
  });

  // ---------- Görevler ----------

  // Elle tekrar ekleme: var olan bir konuya istenen günde tekrar.
  router.post('/tasks', (req, res) => {
    const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(req.body?.topicId);
    if (!topic) throw bad('Konu seçin.');
    const date = cleanDate(req.body.date, 'Tarih');
    transaction(db, () => {
      insertTask.run(topic.id, 'review', 9999, date, 0);
      renumberReviews(db, topic.id);
    });
    res.status(201).json({ ok: true });
  });

  router.patch('/tasks/:id', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) throw notFound();
    const { date, done, shiftFollowing } = req.body ?? {};

    transaction(db, () => {
      if (done !== undefined) {
        db.prepare('UPDATE tasks SET done = ? WHERE id = ?').run(done ? 1 : 0, task.id);
      }
      if (date !== undefined) {
        const newDate = cleanDate(date, 'Tarih');
        const delta = diffDays(task.date, newDate);
        db.prepare('UPDATE tasks SET date = ? WHERE id = ?').run(newDate, task.id);
        if (task.kind === 'study') {
          db.prepare('UPDATE topics SET study_date = ? WHERE id = ?').run(newDate, task.topic_id);
        }
        // "Sonraki tekrarları da kaydır": bu görevden sonraki, henüz yapılmamış
        // tekrarlar aynı gün sayısı kadar ileri/geri alınır.
        if (shiftFollowing && delta !== 0) {
          const following = db
            .prepare(
              "SELECT id, date FROM tasks WHERE topic_id = ? AND kind = 'review' AND seq > ? AND done = 0 AND id != ?",
            )
            .all(task.topic_id, task.seq, task.id);
          const upd = db.prepare('UPDATE tasks SET date = ? WHERE id = ?');
          for (const f of following) upd.run(addDays(f.date, delta), f.id);
        }
        renumberReviews(db, task.topic_id);
      }
    });
    res.json({ ok: true });
  });

  router.delete('/tasks/:id', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) throw notFound();
    transaction(db, () => {
      if (task.kind === 'study') {
        // Çalışmayı silmek = konuyu ve tüm tekrarlarını silmek.
        db.prepare('DELETE FROM topics WHERE id = ?').run(task.topic_id);
      } else {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
        renumberReviews(db, task.topic_id);
      }
    });
    res.json({ ok: true });
  });

  // ---------- Konular ----------

  router.put('/topics/:id', (req, res) => {
    const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(req.params.id);
    if (!topic) throw notFound();
    const name = cleanText(req.body?.name, 'Konu', 100);
    const course = getCourse(req.body?.courseId);
    if (!course) throw bad('Ders seçin.');
    db.prepare('UPDATE topics SET name = ?, course_id = ? WHERE id = ?').run(
      name,
      course.id,
      topic.id,
    );
    res.json({ ok: true });
  });

  // ---------- Yedekleme ----------

  router.get('/backup', (req, res) => {
    const backup = {
      app: 'takvimm',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { intervals: getIntervals(db) },
      courses: db.prepare('SELECT * FROM courses').all(),
      topics: db.prepare('SELECT * FROM topics').all(),
      tasks: db.prepare('SELECT * FROM tasks').all(),
    };
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="takvim-yedek-${day}.json"`);
    res.json(backup);
  });

  router.post('/restore', (req, res) => {
    const b = req.body;
    if (!b || b.app !== 'takvimm' || !Array.isArray(b.courses) || !Array.isArray(b.topics) || !Array.isArray(b.tasks)) {
      throw bad('Bu dosya geçerli bir takvim yedeği değil.');
    }
    const intervals = normalizeIntervals(b.settings?.intervals);

    transaction(db, () => {
      db.exec('DELETE FROM tasks; DELETE FROM topics; DELETE FROM courses;');
      const ic = db.prepare('INSERT INTO courses (id, name, color, exam_date) VALUES (?, ?, ?, ?)');
      for (const c of b.courses) {
        const cc = cleanCourse({ name: c.name, color: c.color, examDate: c.exam_date });
        ic.run(Number(c.id), cc.name, cc.color, cc.examDate);
      }
      const it = db.prepare('INSERT INTO topics (id, course_id, name, study_date) VALUES (?, ?, ?, ?)');
      for (const t of b.topics) {
        it.run(Number(t.id), Number(t.course_id), cleanText(t.name, 'Konu'), cleanDate(t.study_date, 'Tarih'));
      }
      const ik = db.prepare('INSERT INTO tasks (id, topic_id, kind, seq, date, done) VALUES (?, ?, ?, ?, ?, ?)');
      for (const k of b.tasks) {
        if (k.kind !== 'study' && k.kind !== 'review') throw bad('Yedekte geçersiz görev türü.');
        ik.run(Number(k.id), Number(k.topic_id), k.kind, Number(k.seq), cleanDate(k.date, 'Tarih'), k.done ? 1 : 0);
      }
      if (intervals) setIntervals(db, intervals);
    });
    res.json({ ok: true });
  });

  // Hata yakalayıcı: BadRequest'leri kullanıcıya düzgün mesajla döndür.
  router.use((err, req, res, next) => {
    if (err instanceof BadRequest) return res.status(err.status).json({ error: err.message });
    // Yabancı anahtar hatası (ör. yedekte olmayan derse ait konu)
    if (String(err.message).includes('FOREIGN KEY')) {
      return res.status(400).json({ error: 'Yedek dosyası tutarsız (eksik ders/konu).' });
    }
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  });

  return router;
}
