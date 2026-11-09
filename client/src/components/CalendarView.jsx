// Ay görünümü. Günlerde ders renginde noktalar; bir güne basınca altta o günün listesi.
// Listedeki kutular tutamaçtan (⋮⋮) tutulup takvimdeki başka bir güne sürüklenebilir.
import { useEffect, useMemo, useRef, useState } from 'react';
import TaskItem from './TaskItem.jsx';
import { MONTHS, WEEKDAYS_SHORT, formatLong, mondayIndex, ymd } from '../dates.js';
import { IconLeft, IconRight, IconPlus } from './Icons.jsx';

export default function CalendarView({ today, tasks, courses, actions, openTask, openAdd }) {
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1); // 0 = Ocak
  const [selected, setSelected] = useState(today);
  const [drag, setDrag] = useState(null); // { task, x, y, over }
  const swipe = useRef(null);

  // Tarihe göre görev grupları: { "2026-11-12": [görev, ...] }
  const byDate = useMemo(() => {
    const map = {};
    for (const t of tasks) (map[t.date] ||= []).push(t);
    return map;
  }, [tasks]);

  const examsByDate = useMemo(() => {
    const map = {};
    for (const c of courses) if (c.examDate) (map[c.examDate] ||= []).push(c);
    return map;
  }, [courses]);

  // Ay ızgarası: Pazartesi'den başlayan haftalar, önceki/sonraki aydan taşan günler dahil
  const cells = useMemo(() => {
    const first = mondayIndex(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((first + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(year, month, i - first + 1);
      return { date: ymd(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === month };
    });
  }, [year, month]);

  function changeMonth(delta) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function goToday() {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)) - 1);
    setSelected(today);
  }

  // ---------- Sürükle-bırak (fare ve dokunmatik ekranda çalışır) ----------
  function startDrag(e, task) {
    e.preventDefault();
    setDrag({ task, x: e.clientX, y: e.clientY, over: null });
  }

  useEffect(() => {
    if (!drag) return;
    // Parmağın/farenin altındaki gün hücresini bul
    const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-date]')?.dataset.date ?? null;
    const move = (e) => setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY, over: cellAt(e.clientX, e.clientY) });
    const up = (e) => {
      const target = cellAt(e.clientX, e.clientY);
      const task = drag.task;
      setDrag(null);
      if (target && target !== task.date) {
        actions.moveTask(task, target).then((ok) => ok && setSelected(target));
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag?.task]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Kaydırarak ay değiştirme ----------
  const onTouchStart = (e) => (swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e) => {
    if (!swipe.current || drag) return;
    const dx = e.changedTouches[0].clientX - swipe.current.x;
    const dy = e.changedTouches[0].clientY - swipe.current.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) changeMonth(dx < 0 ? 1 : -1);
    swipe.current = null;
  };

  const dayTasks = byDate[selected] || [];
  const dayExams = examsByDate[selected] || [];

  return (
    <section className="view">
      <header className="view-head">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => changeMonth(-1)} aria-label="Önceki ay">
            <IconLeft />
          </button>
          <h1>
            {MONTHS[month]} <span className="muted">{year}</span>
          </h1>
          <button className="icon-btn" onClick={() => changeMonth(1)} aria-label="Sonraki ay">
            <IconRight />
          </button>
        </div>
        <button className="btn small secondary" onClick={goToday}>
          Bugün
        </button>
      </header>

      <div className="calendar" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="weekday">
            {w}
          </div>
        ))}
        {cells.map((c) => {
          const list = byDate[c.date] || [];
          const exams = examsByDate[c.date] || [];
          const cls = [
            'day',
            !c.inMonth && 'other',
            c.date === today && 'today',
            c.date === selected && 'selected',
            drag?.over === c.date && 'drop',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button key={c.date} data-date={c.date} className={cls} onClick={() => setSelected(c.date)}>
              <span className="num">{c.day}</span>
              {exams.length > 0 && (
                <span className="exam-mark" style={{ '--c': exams[0].color }} title="Sınav">
                  S
                </span>
              )}
              <span className="dots">
                {list.slice(0, 4).map((t) => (
                  <span
                    key={t.id}
                    className={`dot ${t.done ? 'faded' : ''} ${!t.done && t.date < today ? 'late' : ''}`}
                    style={{ '--c': t.color }}
                  />
                ))}
                {list.length > 4 && <span className="more">+{list.length - 4}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="group">
        <div className="group-head">
          <h2>{formatLong(selected)}</h2>
          <button className="btn small primary" onClick={() => openAdd(selected)}>
            <IconPlus width={16} height={16} /> Ekle
          </button>
        </div>
        {dayExams.map((c) => (
          <div key={c.id} className="exam-banner" style={{ '--c': c.color }}>
            📝 {c.name} sınavı
          </div>
        ))}
        {dayTasks.length === 0 ? (
          <div className="empty">Bu gün için kayıt yok.</div>
        ) : (
          <div className="list">
            {dayTasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                today={today}
                onToggle={actions.toggleDone}
                onOpen={openTask}
                onDragStart={startDrag}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sürüklenen kutunun parmağı takip eden kopyası */}
      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y, '--c': drag.task.color }}>
          {drag.task.courseName} – {drag.task.topicName}
        </div>
      )}
    </section>
  );
}
