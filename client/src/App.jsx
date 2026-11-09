// Uygulamanın ana bileşeni: verileri sunucudan yükler, sekmeleri gösterir ve
// tüm değişiklik işlemlerini (actions) tek bir yerde toplar.
import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { addDays, diffDays, todayStr } from './dates.js';
import TodayView from './components/TodayView.jsx';
import CalendarView from './components/CalendarView.jsx';
import CoursesView from './components/CoursesView.jsx';
import SettingsView from './components/SettingsView.jsx';
import TaskMenu from './components/TaskMenu.jsx';
import AddDialog from './components/AddDialog.jsx';
import ChoiceDialog from './components/ChoiceDialog.jsx';
import { IconBook, IconCalendar, IconSettings, IconToday } from './components/Icons.jsx';

const TABS = [
  { id: 'today', label: 'Bugün', Icon: IconToday },
  { id: 'calendar', label: 'Takvim', Icon: IconCalendar },
  { id: 'courses', label: 'Dersler', Icon: IconBook },
  { id: 'settings', label: 'Ayarlar', Icon: IconSettings },
];

export default function App() {
  const [data, setData] = useState(null); // { courses, tasks, settings }
  const [tab, setTab] = useState('today');
  const [today, setToday] = useState(todayStr());
  const [openTaskId, setOpenTaskId] = useState(null);
  const [addDate, setAddDate] = useState(null);
  const [choice, setChoice] = useState(null); // açık soru penceresi
  const [toast, setToast] = useState(null);

  const reload = useCallback(async () => {
    setData(await api('GET', '/data'));
  }, []);

  useEffect(() => {
    reload().catch((e) => showToast(e.message, true));
    // Uygulamaya geri dönünce (ör. telefonda başka uygulamadan) günü ve veriyi tazele:
    // bilgisayarda yapılan değişiklikler telefonda da görünsün.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setToday(todayStr());
        reload().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  function showToast(text, error = false) {
    setToast({ text, error });
    setTimeout(() => setToast(null), 2800);
  }

  /** Soru penceresi aç, kullanıcının seçimini bekle. */
  const ask = (opts) => new Promise((resolve) => setChoice({ ...opts, resolve }));

  /** Sunucu isteğini çalıştır, veriyi yenile, başarılıysa true döndür. */
  async function mutate(fn, successText) {
    try {
      const result = await fn();
      await reload();
      if (successText) showToast(successText);
      return result ?? true;
    } catch (e) {
      showToast(e.message, true);
      return false;
    }
  }

  const tasks = data?.tasks ?? [];
  const courses = data?.courses ?? [];

  // ---------- Tüm işlemler ----------
  const actions = {
    toggleDone: (t) => mutate(() => api('PATCH', `/tasks/${t.id}`, { done: !t.done })),

    /**
     * Görevi başka güne taşı. Sonrasında yapılmamış tekrarlar varsa
     * "sadece bunu mu, sonrakileri de mi?" diye sorar.
     */
    async moveTask(t, newDate, { askScope = true } = {}) {
      if (newDate === t.date) return true;
      const following = tasks.filter((x) => x.topicId === t.topicId && x.kind === 'review' && x.seq > t.seq && !x.done);
      let shiftFollowing = false;
      if (askScope && following.length > 0) {
        const answer = await ask({
          title: 'Tarihi değiştir',
          message: `Sadece bunu mu taşıyayım, yoksa sonraki ${following.length} tekrarı da aynı gün sayısı kadar kaydırayım mı?`,
          options: [
            { label: 'Sadece bunu', value: 'one', variant: 'secondary' },
            { label: 'Sonrakileri de kaydır', value: 'all', variant: 'primary' },
            { label: 'Vazgeç', value: null, variant: 'ghost' },
          ],
        });
        if (!answer) return false;
        shiftFollowing = answer === 'all';
      }
      // Taşıma sonrası bir tekrar sınav gününe veya sonrasına düşüyorsa uyar
      const exam = courses.find((c) => c.id === t.courseId)?.examDate;
      const delta = diffDays(t.date, newDate);
      const moved = [newDate, ...(shiftFollowing ? following.map((f) => addDays(f.date, delta)) : [])];
      const afterExam = exam && exam > t.date && moved.some((d) => d >= exam);
      return mutate(
        () => api('PATCH', `/tasks/${t.id}`, { date: newDate, shiftFollowing }),
        afterExam ? '⚠️ Taşındı, ama bir tekrar sınav gününe/sonrasına düştü' : 'Taşındı',
      );
    },

    moveAllToToday: (list) =>
      mutate(async () => {
        for (const t of list) await api('PATCH', `/tasks/${t.id}`, { date: today });
      }, `${list.length} görev bugüne taşındı`),

    async deleteTask(t) {
      const isStudy = t.kind === 'study';
      const answer = await ask({
        title: isStudy ? 'Konu silinsin mi?' : 'Tekrar silinsin mi?',
        message: isStudy
          ? `"${t.topicName}" konusu ve TÜM tekrarları silinecek.`
          : `"${t.topicName}" konusunun ${t.seq}. tekrarı silinecek.`,
        options: [
          { label: 'Sil', value: true, variant: 'danger' },
          { label: 'Vazgeç', value: null, variant: 'ghost' },
        ],
      });
      if (!answer) return false;
      return mutate(() => api('DELETE', `/tasks/${t.id}`), 'Silindi');
    },

    editTopic: (topicId, name, courseId) => mutate(() => api('PUT', `/topics/${topicId}`, { name, courseId }), 'Kaydedildi'),

    addStudy: (body) =>
      mutate(async () => {
        const r = await api('POST', '/studies', body);
        showToast(`Kaydedildi · ${r.reviewDates.length} tekrar planlandı`);
      }),

    addReview: (body) => mutate(() => api('POST', '/tasks', body), 'Tekrar eklendi'),

    addCourse: (body) => mutate(() => api('POST', '/courses', body), 'Ders eklendi'),
    updateCourse: (id, body) => mutate(() => api('PUT', `/courses/${id}`, body), 'Kaydedildi'),
    async deleteCourse(c, topicCount) {
      const answer = await ask({
        title: `"${c.name}" silinsin mi?`,
        message: topicCount ? `Bu derse ait ${topicCount} konu ve tüm tekrarları da silinecek.` : 'Bu ders silinecek.',
        options: [
          { label: 'Sil', value: true, variant: 'danger' },
          { label: 'Vazgeç', value: null, variant: 'ghost' },
        ],
      });
      if (answer) await mutate(() => api('DELETE', `/courses/${c.id}`), 'Ders silindi');
    },

    saveIntervals: (intervals) =>
      mutate(async () => (await api('PUT', '/settings', { intervals })).intervals, 'Aralıklar kaydedildi'),

    async restore(file) {
      let json;
      try {
        json = JSON.parse(await file.text());
      } catch {
        return showToast('Dosya okunamadı (geçerli JSON değil).', true);
      }
      const answer = await ask({
        title: 'Yedekten geri yüklensin mi?',
        message: 'Şu anki TÜM verilerin silinip yedekteki verilerle değiştirilecek.',
        options: [
          { label: 'Geri yükle', value: true, variant: 'danger' },
          { label: 'Vazgeç', value: null, variant: 'ghost' },
        ],
      });
      if (answer) await mutate(() => api('POST', '/restore', json), 'Yedek geri yüklendi');
    },

    async logout() {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/login';
    },
  };

  if (!data) return <div className="loading">Yükleniyor…</div>;

  // Menü açıkken veri yenilenirse güncel hâlini göster
  const openTask = tasks.find((t) => t.id === openTaskId);
  const viewProps = { today, tasks, courses, actions, openTask: (t) => setOpenTaskId(t.id), openAdd: setAddDate };

  return (
    <div className="app">
      <main>
        {tab === 'today' && <TodayView {...viewProps} />}
        {tab === 'calendar' && <CalendarView {...viewProps} />}
        {tab === 'courses' && <CoursesView {...viewProps} />}
        {tab === 'settings' && <SettingsView intervals={data.settings.intervals} actions={actions} />}
      </main>

      <nav className="tabbar">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {openTask && (
        <TaskMenu task={openTask} today={today} courses={courses} actions={actions} onClose={() => setOpenTaskId(null)} />
      )}
      {addDate && (
        <AddDialog
          defaultDate={addDate}
          today={today}
          courses={courses}
          tasks={tasks}
          intervals={data.settings.intervals}
          actions={actions}
          onClose={() => setAddDate(null)}
          goToCourses={() => {
            setAddDate(null);
            setTab('courses');
          }}
        />
      )}
      {choice && (
        <ChoiceDialog
          {...choice}
          onChoose={(v) => {
            choice.resolve(v);
            setChoice(null);
          }}
        />
      )}
      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.text}</div>}
    </div>
  );
}
