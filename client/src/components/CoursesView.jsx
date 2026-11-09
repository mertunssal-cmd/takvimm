// Dersler: ekle / düzenle / sil.
import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { formatShort, diffDays } from '../dates.js';
import { IconEdit, IconPlus, IconTrash } from './Icons.jsx';

// Siyah zeminde okunur, birbirinden ayırt edilebilir hazır renkler
export const PALETTE = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#22d3ee', '#a3e635', '#fb923c', '#c4b5fd', '#e879f9'];

function CourseForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);
  const [examDate, setExamDate] = useState(initial?.examDate ?? '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const ok = await onSave({ name, color, examDate: examDate || null });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Sheet title={initial ? 'Dersi düzenle' : 'Yeni ders'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Ders adı</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Matematik" maxLength={60} required autoFocus />
        </label>
        <div className="field">
          <span>Renk</span>
          <div className="swatches">
            {PALETTE.map((p) => (
              <button
                type="button"
                key={p}
                className={`swatch ${p === color ? 'on' : ''}`}
                style={{ background: p }}
                onClick={() => setColor(p)}
                aria-label={p}
              />
            ))}
            <label className="swatch custom" title="Özel renk" style={{ background: PALETTE.includes(color) ? undefined : color }}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />+
            </label>
          </div>
        </div>
        <label className="field">
          <span>Sınav tarihi (isteğe bağlı)</span>
          <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </label>
        <p className="hint">Tekrarlar sınav tarihinden önceye sığacak şekilde planlanır. Sınav tarihini sonradan değiştirmek mevcut tekrarları değiştirmez.</p>
        <button className="btn primary" disabled={busy}>
          Kaydet
        </button>
      </form>
    </Sheet>
  );
}

export default function CoursesView({ today, courses, tasks, actions }) {
  const [editing, setEditing] = useState(null); // null | 'new' | ders nesnesi

  return (
    <section className="view">
      <header className="view-head">
        <h1>Dersler</h1>
        <button className="btn small primary" onClick={() => setEditing('new')}>
          <IconPlus width={16} height={16} /> Ders ekle
        </button>
      </header>

      {courses.length === 0 ? (
        <div className="empty">Henüz ders yok. "Ders ekle" ile başla: ad, renk ve sınav tarihi.</div>
      ) : (
        <div className="list">
          {courses.map((c) => {
            const topicCount = tasks.filter((t) => t.courseId === c.id && t.kind === 'study').length;
            const left = c.examDate ? diffDays(today, c.examDate) : null;
            return (
              <div key={c.id} className="course" style={{ '--c': c.color }}>
                <span className="dot big" />
                <div className="grow">
                  <div className="course-name">{c.name}</div>
                  <div className="muted small">
                    {topicCount} konu
                    {c.examDate &&
                      ` · Sınav ${formatShort(c.examDate)} (${left > 0 ? `${left} gün kaldı` : left === 0 ? 'bugün' : 'geçti'})`}
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setEditing(c)} aria-label="Düzenle">
                  <IconEdit width={18} height={18} />
                </button>
                <button className="icon-btn danger-text" onClick={() => actions.deleteCourse(c, topicCount)} aria-label="Sil">
                  <IconTrash width={18} height={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <CourseForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(data) => (editing === 'new' ? actions.addCourse(data) : actions.updateCourse(editing.id, data))}
        />
      )}
    </section>
  );
}
