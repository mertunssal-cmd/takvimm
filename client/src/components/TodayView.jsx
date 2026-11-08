// "Bugün" ekranı: gecikenler + bugünün işleri + yaklaşan sınavlar.
import TaskItem from './TaskItem.jsx';
import { formatLong, formatShort, diffDays } from '../dates.js';
import { IconPlus } from './Icons.jsx';

export default function TodayView({ today, tasks, courses, actions, openTask, openAdd }) {
  const overdue = tasks.filter((t) => !t.done && t.date < today);
  const todays = tasks.filter((t) => t.date === today);
  const doneCount = todays.filter((t) => t.done).length;

  const exams = courses
    .filter((c) => c.examDate && c.examDate >= today)
    .sort((a, b) => a.examDate.localeCompare(b.examDate));

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <h1>Bugün</h1>
          <div className="muted">{formatLong(today)}</div>
        </div>
        {todays.length > 0 && (
          <div className="progress" aria-label="İlerleme">
            {doneCount}/{todays.length}
          </div>
        )}
      </header>

      {exams.length > 0 && (
        <div className="chips exams">
          {exams.map((c) => {
            const n = diffDays(today, c.examDate);
            return (
              <span key={c.id} className="chip exam-chip" style={{ '--c': c.color }}>
                <span className="dot" /> {c.name}: {n === 0 ? 'sınav bugün!' : `${n} gün (${formatShort(c.examDate)})`}
              </span>
            );
          })}
        </div>
      )}

      {overdue.length > 0 && (
        <div className="group">
          <div className="group-head">
            <h2 className="danger-text">Gecikenler ({overdue.length})</h2>
            <button className="btn small danger-outline" onClick={() => actions.moveAllToToday(overdue)}>
              Hepsini bugüne taşı
            </button>
          </div>
          <div className="list">
            {overdue.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                today={today}
                onToggle={actions.toggleDone}
                onOpen={openTask}
                showDate={formatShort(t.date)}
                right={
                  <button className="btn small danger-outline" onClick={() => actions.moveTask(t, today, { askScope: false })}>
                    Bugüne taşı
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="group">
        <div className="group-head">
          <h2>Bugünün işleri</h2>
        </div>
        {todays.length === 0 ? (
          <div className="empty">
            {tasks.length === 0
              ? 'Takvimin boş. Bir ders ekleyip çalıştığın konuları girerek başla.'
              : 'Bugün için tekrar yok. 🎉'}
          </div>
        ) : (
          <div className="list">
            {todays.map((t) => (
              <TaskItem key={t.id} task={t} today={today} onToggle={actions.toggleDone} onOpen={openTask} />
            ))}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => openAdd(today)}>
        <IconPlus /> Çalıştım
      </button>
    </section>
  );
}
