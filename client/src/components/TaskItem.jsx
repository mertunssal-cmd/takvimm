// Takvimdeki tek bir çalışma/tekrar kutusu.
// Örn: [ ] ▌Matematik – Matrisler   2. tekrar
import { IconCheck, IconGrip } from './Icons.jsx';

/** "Çalışma" veya "2. tekrar" */
export function taskLabel(task) {
  return task.kind === 'study' ? 'Çalışma' : `${task.seq}. tekrar`;
}

export function isOverdue(task, today) {
  return !task.done && task.date < today; // "YYYY-AA-GG" metinleri sözlük sırasıyla karşılaştırılabilir
}

export default function TaskItem({ task, today, onToggle, onOpen, onDragStart, showDate, right }) {
  const overdue = isOverdue(task, today);
  const cls = ['task', task.done && 'done', overdue && 'overdue'].filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ '--c': task.color }}>
      <button
        className="check"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
        onClick={() => onToggle(task)}
      >
        {task.done && <IconCheck width={16} height={16} strokeWidth={3} />}
      </button>
      <button className="task-body" onClick={() => onOpen(task)}>
        <span className="task-title">
          {task.courseName} – {task.topicName}
        </span>
        <span className="task-sub">
          {taskLabel(task)}
          {showDate && ` · ${showDate}`}
          {overdue && ' · gecikti'}
        </span>
      </button>
      {right}
      {onDragStart && (
        <span
          className="grip"
          title="Başka güne sürükle"
          aria-hidden="true"
          onPointerDown={(e) => onDragStart(e, task)}
        >
          <IconGrip width={18} height={18} />
        </span>
      )}
    </div>
  );
}
