// Service worker: uygulamanın telefona "yüklenebilir" olmasını sağlar ve
// derlenmiş JS/CSS dosyalarını önbelleğe alarak açılışı hızlandırır.
// Veriler (API) ve sayfalar ÖNBELLEĞE ALINMAZ: her zaman sunucudan gelir,
// böylece telefon ve bilgisayar hep aynı güncel veriyi görür ve giriş kontrolü atlanamaz.
const CACHE = 'takvim-assets-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  // Eski önbellek sürümlerini temizle
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Sadece /assets/ altındaki (adı içerik özeti taşıyan, değişmeyen) dosyalar önbellekten.
  if (event.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith('/assets/')) {
    return; // tarayıcı normal şekilde ağdan alsın
  }
  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ||
        fetch(event.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        }),
    ),
  );
});
