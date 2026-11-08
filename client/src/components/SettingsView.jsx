// Ayarlar: tekrar aralıkları, yedekleme / geri yükleme, çıkış.
import { useRef, useState } from 'react';
import { IconLogout, IconPlus, IconX } from './Icons.jsx';

export default function SettingsView({ intervals, actions }) {
  const [list, setList] = useState(intervals.map(String));
  const fileRef = useRef(null);
  const changed = list.join(',') !== intervals.join(',');

  const setAt = (i, v) => setList(list.map((x, j) => (j === i ? v.replace(/\D/g, '') : x)));

  return (
    <section className="view">
      <header className="view-head">
        <h1>Ayarlar</h1>
      </header>

      <div className="group card-inner">
        <h2>Tekrar aralıkları</h2>
        <p className="muted small">
          Bir konuyu çalıştığın günden kaç gün sonra tekrar edeceğin. Varsayılan: 3, 7, 21. Değişiklik yalnızca bundan sonra eklenen çalışmalara uygulanır.
        </p>
        <div className="intervals">
          {list.map((v, i) => (
            <div key={i} className="interval">
              <span className="muted small">{i + 1}.</span>
              <input inputMode="numeric" value={v} onChange={(e) => setAt(i, e.target.value)} aria-label={`${i + 1}. tekrar (gün)`} />
              <span className="muted small">gün</span>
              {list.length > 1 && (
                <button className="icon-btn" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label="Kaldır">
                  <IconX width={16} height={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="row">
          {list.length < 10 && (
            <button className="btn small secondary" onClick={() => setList([...list, ''])}>
              <IconPlus width={16} height={16} /> Aralık ekle
            </button>
          )}
          <button className="btn small secondary" onClick={() => setList(['3', '7', '21'])}>
            Varsayılana dön
          </button>
          <button className="btn small primary" disabled={!changed} onClick={() => actions.saveIntervals(list.map(Number)).then((r) => r && setList(r.map(String)))}>
            Kaydet
          </button>
        </div>
      </div>

      <div className="group card-inner">
        <h2>Yedekleme</h2>
        <p className="muted small">Tüm ders, konu ve tekrarlarını JSON dosyası olarak indir; gerekirse geri yükle.</p>
        <div className="row">
          {/* Normal bir bağlantı: cookie otomatik gider, dosya indirilir */}
          <a className="btn small secondary" href="/api/backup" download>
            Yedeği indir
          </a>
          <button className="btn small secondary" onClick={() => fileRef.current.click()}>
            Yedekten geri yükle
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files[0];
              e.target.value = '';
              if (f) actions.restore(f);
            }}
          />
        </div>
      </div>

      <div className="group card-inner">
        <h2>Hesap</h2>
        <button className="btn secondary" onClick={actions.logout}>
          <IconLogout width={18} height={18} /> Çıkış yap
        </button>
      </div>
    </section>
  );
}
