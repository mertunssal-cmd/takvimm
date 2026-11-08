# Tekrar Takvimi 📅

Kişisel kullanım için **aralıklı tekrar** (spaced repetition) ders takvimi.
Bir konuyu çalıştığını işaretlersin, uygulama tekrar günlerini (varsayılan **3 / 7 / 21 gün** sonra)
otomatik planlar; sınav tarihin yaklaşıyorsa tekrarları sınavdan önceye sığdırır.
Telefona uygulama gibi yüklenebilir (PWA); veriler sunucuda tutulduğu için telefon ve bilgisayarda aynı görünür.

- **Frontend:** React + Vite (`client/`)
- **Backend:** Node.js + Express (`server/`)
- **Veritabanı:** SQLite (Node 22'nin yerleşik `node:sqlite` modülü — ekstra derleme gerekmez)
- **Ortak kod:** Tekrar tarihi hesaplama (`shared/schedule.js`) hem sunucuda hem arayüzde kullanılır

---

## İçindekiler

1. [Özellikler](#özellikler)
2. [Bilgisayarında çalıştırma](#bilgisayarında-çalıştırma)
3. [İlk şifreyi belirleme / değiştirme](#i̇lk-şifreyi-belirleme--değiştirme)
4. [Testler](#testler)
5. [Telefona yükleme](#telefona-yükleme)
6. [Ücretsiz ve HTTPS ile yayınlama](#ücretsiz-ve-https-ile-yayınlama)
7. [Proje yapısı](#proje-yapısı)
8. [Tekrar hesaplama kuralları](#tekrar-hesaplama-kuralları)
9. [Güvenlik nasıl sağlanıyor?](#güvenlik-nasıl-sağlanıyor)
10. [Sık karşılaşılan sorunlar](#sık-karşılaşılan-sorunlar)

---

## Özellikler

- **Dersler:** ad, renk, (isteğe bağlı) sınav tarihi. Ekle / düzenle / sil.
- **"Çalıştım":** ders + konu + tarih (varsayılan bugün). Kaydetmeden önce tekrarların hangi günlere düşeceği önizlenir.
- **Otomatik tekrarlar:** 3 / 7 / 21 gün sonra (Ayarlar'dan değiştirilebilir). Sınavdan sonraya düşecekse orantılı kısaltılır.
- **Görev menüsü** (bir kutuya basınca): tamamlandı işaretle, bugüne taşı, tarihi değiştir, konuyu düzenle, sil.
- **Sürükle-bırak:** Takvim ekranında kutunun sağındaki tutamaçtan (⋮⋮) tutup başka güne bırak (telefonda da çalışır).
- **Taşırken soru:** "Sadece bunu mu, sonraki tekrarları da mı kaydırayım?"
- **Elle ekleme:** "Ekle" → *Çalıştım* (yeni konu) veya *Tekrar ekle* (var olan konuya ek tekrar).
- **Gecikenler:** Tamamlanmamış geçmiş tekrarlar kırmızı; tek tuşla "Bugüne taşı" veya "Hepsini bugüne taşı".
- **Ekranlar:** Bugün · Takvim (ay görünümü, hafta Pazartesi başlar) · Dersler · Ayarlar
- **Yedekleme:** JSON olarak indir / geri yükle.
- **Giriş:** tek kullanıcı, kullanıcı adı + şifre, "beni hatırla", çıkış, yanlış denemelere karşı bekletme.
- **Tema:** siyah zemin, koyu mor ızgara, canlı mor vurgular.

---

## Bilgisayarında çalıştırma

### 1) Gerekenler

- **Node.js 22.13 veya üstü** (yerleşik SQLite için). Sürümünü görmek için: `node -v`
  Yoksa <https://nodejs.org> adresinden **LTS** sürümünü kur.
- **Git** (projeyi indirmek için).

### 2) Projeyi indir ve paketleri kur

```bash
git clone https://github.com/mertunssal-cmd/takvimm.git
cd takvimm
npm install
```

### 3) Kullanıcı adı ve şifreyi belirle

```bash
npm run setup
```

Senden kullanıcı adı ve şifre ister, şifreyi **bcrypt** ile özetleyip (hash) proje klasöründeki
`.env` dosyasına yazar. Ayrıntı: [İlk şifreyi belirleme](#i̇lk-şifreyi-belirleme--değiştirme).

### 4a) Geliştirme modu (kodu değiştirirken)

```bash
npm run dev
```

- Arayüz: <http://localhost:5173> (kodu kaydettiğinde sayfa kendini yeniler)
- API sunucusu arka planda 3000 portunda çalışır; Vite istekleri ona aktarır.
- Not: Geliştirme modunda arayüz dosyalarını Vite sunar; **veriler (API) yine giriş ister**.
  "Giriş yapmadan hiçbir sayfa açılmaz" kuralı tam olarak üretim modunda (4b) geçerlidir.

### 4b) Üretim modu (gerçek kullanım)

```bash
npm run build   # arayüzü derler -> dist/ klasörü
npm start       # sunucuyu başlatır
```

Tarayıcıda <http://localhost:3000> aç → giriş ekranı gelir.

Veritabanı `data/takvim.db` dosyasında tutulur (ilk çalıştırmada otomatik oluşur).

### Aynı Wi-Fi'daki telefondan denemek

Sunucu çalışırken bilgisayarının yerel IP adresini bul (Windows: `ipconfig`, macOS/Linux: `ifconfig` veya `ip a`),
telefonda `http://192.168.x.x:3000` adresini aç. (Bu şekilde HTTP olduğu için telefona *yükleme* çalışmaz;
yükleme için HTTPS gerekir, aşağıya bak.)

---

## İlk şifreyi belirleme / değiştirme

Şifren **hiçbir yerde düz metin olarak saklanmaz**. Sadece bcrypt özeti saklanır; özetten şifre geri elde edilemez.

```bash
npm run setup
```

Bu komut `.env` dosyasını oluşturur ya da günceller:

```env
APP_USERNAME=mert
APP_PASSWORD_HASH='$2b$12$....'
```

- Şifreyi değiştirmek için komutu tekrar çalıştır ve sunucuyu yeniden başlat.
- `.env` dosyası `.gitignore`'da; **git'e gönderilmez**. Asla paylaşma.
- Bir barındırma servisine (sunucuya) koyarken bu iki değeri o servisin "Environment Variables"
  bölümüne gir (komut çıktısında kopyalanabilir hâlde yazar). Orada tırnak işareti kullanma.
- Diğer isteğe bağlı ayarlar için `.env.example` dosyasına bak (`PORT`, `DB_PATH`, `TRUST_PROXY`).

---

## Testler

```bash
npm test
```

- `test/schedule.test.js` — tekrar tarihi hesaplama fonksiyonunun **birim testleri**:
  sınav yok, sınav uzak, sınav yakın, sınavdan sonraya düşen tekrar (orantılı kısaltma),
  sınav yarın, sınav geçmiş, ay/yıl geçişleri, artık yıl.
- `test/api.test.js` — sunucuyu bellek içi veritabanıyla başlatıp uçtan uca dener:
  girişsiz erişimin engellenmesi, 5 yanlış denemede bekletme, cookie ayarları, çalışma ekleme,
  tekrar taşıma (sadece bunu / sonrakileri de), elle tekrar, silme, yedekle-geri yükle, çıkış.

---

## Telefona yükleme

Uygulama bir **PWA**'dır: telefona uygulama gibi yüklenir, ana ekranda ikonu olur, tam ekran açılır.
Bunun için sitenin **HTTPS** ile yayında olması gerekir (bir sonraki bölüm).

**Android (Chrome):**
1. Sitenin adresini Chrome'da aç ve giriş yap.
2. Sağ üstteki **⋮** menüsü → **"Ana ekrana ekle"** / **"Uygulamayı yükle"**.

**iPhone (Safari):**
1. Sitenin adresini **Safari**'de aç ve giriş yap (diğer tarayıcılarda bu seçenek olmayabilir).
2. Alttaki **Paylaş** (□↑) butonu → **"Ana Ekrana Ekle"**.

"Beni hatırla" işaretliyse 30 gün boyunca tekrar giriş yapman gerekmez.

---

## Ücretsiz ve HTTPS ile yayınlama

Bu uygulama veriyi **SQLite dosyasında** tuttuğu için, sunucunun diski **kalıcı** olmalı.
Bazı ücretsiz servislerde disk her yeniden başlatmada silinir → verilerin gider. Aşağıdaki seçenekler
bunu dikkate alıyor. (Ücretsiz plan koşulları zamanla değişebilir; başlamadan güncel koşullara göz at.)

### Seçenek A — Oracle Cloud "Always Free" sanal sunucu + Caddy (önerilen, kalıcı ve ücretsiz)

Oracle'ın her zaman ücretsiz katmanında küçük bir Linux sunucu alırsın; disk kalıcıdır.
Caddy web sunucusu HTTPS sertifikasını (Let's Encrypt) **otomatik** alır ve yeniler.

1. **Sunucu:** <https://www.oracle.com/cloud/free/> → hesap aç (kimlik doğrulama için kart isteyebilir,
   ücret çekilmez). *Compute → Instances → Create* ile **Ubuntu** bir "Always Free eligible" sunucu oluştur.
   SSH anahtarını indir.
2. **Portları aç:** Instance'ın *Subnet → Security List*'ine 80 ve 443 TCP için "Ingress Rule" ekle.
   Sunucuda da:
   ```bash
   sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
3. **Ücretsiz alan adı:** <https://www.duckdns.org> → GitHub/Google ile gir, örn. `mertakvim.duckdns.org`
   oluştur ve sunucunun **public IP**'sini yaz.
4. **Node.js ve proje:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   git clone https://github.com/mertunssal-cmd/takvimm.git
   cd takvimm
   npm install
   npm run build
   npm run setup        # kullanıcı adı + şifre
   ```
5. **Sürekli çalışsın (systemd servisi):** `sudo nano /etc/systemd/system/takvim.service`
   ```ini
   [Unit]
   Description=Tekrar Takvimi
   After=network.target

   [Service]
   User=ubuntu
   WorkingDirectory=/home/ubuntu/takvimm
   ExecStart=/usr/bin/npm start
   Restart=always
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now takvim
   ```
6. **HTTPS (Caddy):**
   ```bash
   sudo apt-get install -y caddy
   ```
   (Paket bulunamazsa resmi kurulum adımları: <https://caddyserver.com/docs/install#debian-ubuntu-raspbian>)
   `/etc/caddy/Caddyfile` içeriğini şununla değiştir:
   ```
   mertakvim.duckdns.org {
       reverse_proxy localhost:3000
   }
   ```
   ```bash
   sudo systemctl restart caddy
   ```
   Birkaç saniye içinde `https://mertakvim.duckdns.org` hazır. 🎉
7. **Güncelleme:** `cd ~/takvimm && git pull && npm install && npm run build && sudo systemctl restart takvim`

> Caddy, Express'in önünde "ters vekil" (reverse proxy) olarak çalışır. `TRUST_PROXY=1` (varsayılan) sayesinde
> uygulama HTTPS'i doğru algılar ve oturum cookie'sini **Secure** olarak işaretler.

### Seçenek B — Kendi bilgisayarın + Cloudflare Tunnel

Bilgisayarın açıkken çalışır; port açmana gerek kalmaz, HTTPS'i Cloudflare sağlar.

```bash
npm run build && npm start
# başka bir terminalde (cloudflared'i https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ adresinden kur):
cloudflared tunnel --url http://localhost:3000
```

Komut `https://....trycloudflare.com` gibi bir adres verir. Bu hızlı adres **her çalıştırmada değişir**;
kalıcı adres için Cloudflare'e bir alan adı bağlayıp "named tunnel" oluşturman gerekir.

### Seçenek C — Render.com (en kolay, ama dikkat!)

Render'ın ücretsiz web servisinde disk **kalıcı değildir**: servis uyuyup uyandığında veya yeniden
dağıtıldığında `data/takvim.db` sıfırlanır. Sadece denemek içindir; kullanacaksan düzenli olarak
**Ayarlar → Yedeği indir** yap. (Kalıcı disk ücretli plan ister.)
Kurulum: New → Web Service → bu repo; Build: `npm install && npm run build`, Start: `npm start`,
Environment: `APP_USERNAME`, `APP_PASSWORD_HASH`, `NODE_VERSION=22`.

---

## Proje yapısı

```
takvimm/
├── shared/
│   ├── dates.js          # "YYYY-AA-GG" tarih yardımcıları (gün ekle, fark al)
│   └── schedule.js       # ⭐ tekrar tarihlerini hesaplayan saf fonksiyon
├── server/
│   ├── index.js          # giriş noktası: .env'yi okur, sunucuyu başlatır
│   ├── app.js            # Express kurulumu, giriş kapısı, statik dosyalar
│   ├── auth.js           # giriş/çıkış, oturum cookie'si, yanlış deneme sınırı
│   ├── routes.js         # REST API (dersler, çalışmalar, görevler, yedek)
│   ├── db.js             # SQLite tabloları ve yardımcılar
│   ├── setup.js          # "npm run setup": şifreyi hash'leyip .env'ye yazar
│   └── login/            # giriş sayfası (girişsiz açılabilen tek sayfa)
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── public/           # manifest, service worker, ikonlar (PWA)
│   └── src/
│       ├── App.jsx       # ana bileşen: veri yükleme + tüm işlemler (actions)
│       ├── api.js        # sunucuya istek atan yardımcı
│       ├── dates.js      # Türkçe tarih biçimlendirme
│       ├── styles.css    # siyah/mor tema
│       └── components/   # Bugün, Takvim, Dersler, Ayarlar, menüler...
├── test/                 # birim ve API testleri
└── data/                 # SQLite veritabanı (git'e eklenmez)
```

**Veri modeli** (`server/db.js`):
- `courses` — dersler
- `topics` — çalışılan konular (bir derse bağlı)
- `tasks` — takvimdeki kutular: `kind = 'study'` (ilk çalışma) veya `'review'` (tekrar), `seq` = kaçıncı tekrar
- `settings` — tekrar aralıkları
- `sessions` — oturumlar

---

## Tekrar hesaplama kuralları

`shared/schedule.js` → `computeReviewDates(çalışmaTarihi, aralıklar, sınavTarihi)`

1. Normalde tekrarlar: çalışma günü + 3, + 7, + 21 gün.
2. Sınav varsa son tekrar **en geç sınavdan 1 gün önce** olabilir.
3. En uzak tekrar bu sınırı aşıyorsa tüm aralıklar **aynı oranla** küçültülür.
   Örnek: 8 Kasım'da çalıştın, sınav 18 Kasım → en fazla 9 gün var → oran 9/21 →
   3→**1**, 7→**3**, 21→**9** gün: 9, 11 ve 17 Kasım.
4. Kısaltma sonrası iki tekrar aynı güne düşerse biri atılır.
5. Sınav yarınsa (arada gün yoksa) tekrar oluşmaz.
6. Sınav çalışma gününden önceyse (geçmişse) sınav kısıtı uygulanmaz.

Elle taşımalar serbesttir; bir tekrarı sınav gününe/sonrasına taşırsan uygulama sadece uyarır.
Sınav tarihini veya aralıkları sonradan değiştirmek **mevcut** tekrarları değiştirmez, yeni eklenenlere uygulanır.

---

## Güvenlik nasıl sağlanıyor?

| Konu | Nasıl |
|---|---|
| Şifre saklama | Sadece **bcrypt** özeti `.env`'de; kodda şifre yok |
| Oturum | Girişte rastgele 256-bit anahtar → **HTTP-only**, `SameSite=Lax` cookie (HTTPS'te `Secure`). Veritabanında anahtarın SHA-256 özeti tutulur |
| Beni hatırla | İşaretliyse 30 gün; değilse tarayıcı kapanınca biten cookie (en fazla 12 saat) |
| Erişim kontrolü | **Sunucu tarafında**: girişsiz her API isteği `401`, her sayfa `/login`'e yönlenir. Girişsiz açılabilenler sadece giriş sayfası ve veri içermeyen PWA dosyaları (manifest, ikon) |
| Kaba kuvvet | Aynı IP'den 15 dk içinde **5 yanlış** deneme → **15 dk bekletme** |
| Diğer | `helmet` ile güvenlik başlıkları (CSP vb.), girdi doğrulama, kayıt ol sayfası yok |

---

## Sık karşılaşılan sorunlar

- **`node:sqlite` bulunamadı / `No such built-in module`** → Node sürümün eski. `node -v` en az `v22.13` olmalı.
- **"APP_USERNAME ve APP_PASSWORD_HASH tanımlı değil"** → `npm run setup` çalıştır.
- **"Arayüz derlenmemiş"** → `npm start`'tan önce `npm run build`.
- **`TRUST_PROXY` ne işe yarar?** → Uygulama önünde Caddy/Cloudflare/Render gibi bir ters vekil varken (varsayılan `1`)
  gerçek ziyaretçi IP'sini ve HTTPS'i doğru görür. Sunucuyu ters vekil **olmadan** doğrudan internete açarsan
  `.env`'ye `TRUST_PROXY=0` yaz; yoksa biri sahte `X-Forwarded-For` başlığıyla yanlış giriş sınırını atlatabilir.
- **"Çok fazla yanlış deneme"** → 15 dakika bekle (ya da sunucuyu yeniden başlat; sayaç bellekte tutulur).
- **Telefonda "Ana ekrana ekle" yok** → Site HTTPS değilse PWA yüklenemez; iPhone'da Safari kullan.
