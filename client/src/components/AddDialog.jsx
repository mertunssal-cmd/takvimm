// "Ekle" penceresi. İki mod:
//  - Çalıştım: yeni konu + otomatik tekrarlar (önizlemeli)
//  - Tekrar ekle: var olan bir konuya elle tekrar
import { useMemo, useState } from 'react';
import Sheet from './Sheet.jsx';
import { computeReviewDates } from '../../../shared/schedule.js';
import { formatShort } from '../dates.js';

export default function AddDialog({ defaultDate, today, courses, tasks, intervals, actions, onClose, goToCourses }) {
  const [mode, setMode] = useState('study');
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [topic, setTopic] = useState('');
  const [topicId, setTopicId] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);

  const course = courses.find((c) => c.id === Number(courseId));

  // Seçili derse ait konular (her konunun bir "study" görevi var)
  const topics = useMemo(
    () => tasks.filter((t) => t.kind === 'study' && t.courseId === Number(courseId)),
    [tasks, courseId],
  );

  // Önizleme: sunucunun kullanacağı fonksiyonun aynısıyla hesaplanıyor
  const preview = useMemo(() => {
    if (mode !== 'study' || !course || !date) return null;
    try {
      const dates = computeReviewDates(date, intervals, course.examDate);
      const normal = computeReviewDates(date, intervals, null);
      const shortened = dates.length !== normal.length || dates.some((d, i) => d !== normal[i]);
      return { dates, shortened };
    } catch {
      return null;
    }
  }, [mode, course, date, intervals]);

  if (courses.length === 0) {
    return (
      <Sheet title="Ekle" onClose={onClose}>
        <p className="muted">Önce bir ders eklemelisin.</p>
        <button className="btn primary" onClick={goToCourses}>
          Ders ekle
        </button>
      </Sheet>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const ok =
      mode === 'study'
        ? await actions.addStudy({ courseId: Number(courseId), topic, date, done: date <= today })
        : await actions.addReview({ topicId: Number(topicId), date });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Sheet title="Ekle" onClose={onClose}>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={mode === 'study'} onClick={() => setMode('study')}>
          Çalıştım
        </button>
        <button role="tab" aria-selected={mode === 'review'} onClick={() => setMode('review')}>
          Tekrar ekle
        </button>
      </div>

      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Ders</span>
          <select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setTopicId('');
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {mode === 'study' ? (
          <label className="field">
            <span>Konu</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="örn. Matrisler"
              maxLength={100}
              required
              autoFocus
            />
          </label>
        ) : (
          <label className="field">
            <span>Konu</span>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)} required>
              <option value="" disabled>
                {topics.length ? 'Konu seç' : 'Bu derste henüz konu yok'}
              </option>
              {topics.map((t) => (
                <option key={t.topicId} value={t.topicId}>
                  {t.topicName}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>{mode === 'study' ? 'Çalıştığın gün' : 'Tekrar günü'}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        {preview && (
          <div className="preview">
            <div className="muted small">Otomatik tekrarlar:</div>
            {preview.dates.length ? (
              <div className="chips">
                {preview.dates.map((d, i) => (
                  <span key={d} className="chip">
                    {i + 1}. {formatShort(d)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="danger-text small">Sınava çok az kaldığı için tekrar oluşturulmayacak.</div>
            )}
            {preview.shortened && preview.dates.length > 0 && (
              <div className="small accent-text">Sınav tarihine ({formatShort(course.examDate)}) sığması için aralıklar kısaltıldı.</div>
            )}
          </div>
        )}

        <button className="btn primary" disabled={busy}>
          {mode === 'study' ? 'Kaydet ve tekrarları oluştur' : 'Tekrarı ekle'}
        </button>
      </form>
    </Sheet>
  );
}
