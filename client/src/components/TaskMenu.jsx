// Bir çalışma/tekrar kutusuna basınca açılan menü:
// tamamlandı işaretle, bugüne taşı, tarihi değiştir, konuyu düzenle, sil.
import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { taskLabel, isOverdue } from './TaskItem.jsx';
import { formatLong, relative } from '../dates.js';
import { IconCheck, IconArrowDown, IconEdit, IconTrash } from './Icons.jsx';

export default function TaskMenu({ task, today, courses, actions, onClose }) {
  const [date, setDate] = useState(task.date);
  const [editing, setEditing] = useState(false);
  const [topicName, setTopicName] = useState(task.topicName);
  const [courseId, setCourseId] = useState(task.courseId);
  const overdue = isOverdue(task, today);

  // Her işlemden sonra menüyü kapat (işlem başarısızsa açık kalsın)
  const run = (fn) => async () => {
    if (await fn()) onClose();
  };

  return (
    <Sheet title="Görev" onClose={onClose}>
      <div className="menu-head" style={{ '--c': task.color }}>
        <span className="dot big" />
        <div>
          <div className="menu-title">
            {task.courseName} – {task.topicName}
          </div>
          <div className={overdue ? 'danger-text' : 'muted'}>
            {taskLabel(task)} · {formatLong(task.date)} ({relative(task.date, today)})
            {task.done && ' · tamamlandı'}
          </div>
        </div>
      </div>

      <div className="stack">
        <button className="btn primary" onClick={run(() => actions.toggleDone(task))}>
          <IconCheck width={18} height={18} />
          {task.done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
        </button>

        {task.date !== today && (
          <button className="btn secondary" onClick={run(() => actions.moveTask(task, today, { askScope: !overdue }))}>
            <IconArrowDown width={18} height={18} /> Bugüne taşı
          </button>
        )}

        <div className="field-row">
          <label className="field grow">
            <span>Tarihi değiştir</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button
            className="btn secondary"
            disabled={!date || date === task.date}
            onClick={run(() => actions.moveTask(task, date))}
          >
            Taşı
          </button>
        </div>
        <p className="hint">İpucu: Takvim ekranında kutuyu sağdaki tutamaçtan tutup başka bir güne sürükleyebilirsin.</p>

        {!editing ? (
          <button className="btn secondary" onClick={() => setEditing(true)}>
            <IconEdit width={18} height={18} /> Konuyu düzenle
          </button>
        ) : (
          <div className="card-inner stack">
            <label className="field">
              <span>Konu adı</span>
              <input value={topicName} onChange={(e) => setTopicName(e.target.value)} maxLength={100} />
            </label>
            <label className="field">
              <span>Ders</span>
              <select value={courseId} onChange={(e) => setCourseId(Number(e.target.value))}>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">Bu değişiklik konunun çalışması ve tüm tekrarları için geçerli olur.</p>
            <button className="btn primary" onClick={run(() => actions.editTopic(task.topicId, topicName, courseId))}>
              Kaydet
            </button>
          </div>
        )}

        <button className="btn danger" onClick={run(() => actions.deleteTask(task))}>
          <IconTrash width={18} height={18} /> {task.kind === 'study' ? 'Konuyu sil' : 'Bu tekrarı sil'}
        </button>
      </div>
    </Sheet>
  );
}
