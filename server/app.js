// Express uygulamasını kurar. index.js bunu çalıştırır; testler de doğrudan kullanır.

import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { createAuth } from './auth.js';
import { createApiRouter } from './routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, '..', 'dist'); // "npm run build" çıktısı (React uygulaması)
const LOGIN_DIR = path.join(here, 'login'); // giriş sayfası (girişsiz erişilebilen TEK sayfa)

/**
 * @param {object} opts
 * @param {string} opts.dbPath        SQLite dosya yolu (testlerde ':memory:')
 * @param {string} opts.username      Kullanıcı adı
 * @param {string} opts.passwordHash  Şifrenin bcrypt özeti
 */
export function createApp({ dbPath, username, passwordHash, trustProxy = 1 }) {
  const db = openDatabase(dbPath);
  const auth = createAuth({ db, username, passwordHash });
  const app = express();

  // Render, Caddy, Cloudflare gibi bir ters vekil (reverse proxy) arkasında
  // çalışırken gerçek IP'yi (yanlış giriş sınırı için) ve HTTPS bilgisini
  // (Secure cookie için) doğru okumak. Vekil yoksa .env'de TRUST_PROXY=0 yapın.
  app.set('trust proxy', trustProxy);

  // Güvenlik başlıkları. "upgrade-insecure-requests" kapalı, yoksa evdeki ağda
  // http://192.168.x.x ile denerken dosyalar yüklenmez.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { 'upgrade-insecure-requests': null },
      },
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  // ---- Girişsiz erişilebilenler ----
  app.post('/api/login', auth.login);
  app.post('/api/logout', auth.logout);
  app.get('/api/me', (req, res) => res.json({ loggedIn: auth.isLoggedIn(req) }));

  // Giriş sayfası. Zaten giriş yapılmışsa doğrudan uygulamaya gönder.
  app.get('/login', (req, res) => {
    if (auth.isLoggedIn(req)) return res.redirect('/');
    res.sendFile(path.join(LOGIN_DIR, 'login.html'));
  });
  app.use('/login-assets', express.static(LOGIN_DIR));

  // PWA dosyaları (manifest, ikonlar, service worker) veri içermez; telefona
  // yükleme sırasında tarayıcı bunları cookie'siz isteyebildiği için açık.
  for (const file of ['manifest.webmanifest', 'sw.js']) {
    app.get('/' + file, (req, res, next) => {
      const p = path.join(DIST, file);
      fs.existsSync(p) ? res.sendFile(p) : next();
    });
  }
  app.use('/icons', express.static(path.join(DIST, 'icons')));

  // ---- Buradan sonrası giriş ister ----
  app.use('/api', auth.requireApiAuth, createApiRouter(db));

  // React uygulaması (derlenmiş). Giriş yoksa /login'e yönlendir.
  app.use(auth.requirePageAuth);
  app.use(express.static(DIST, { index: false }));
  // Diğer tüm adresler için index.html (tek sayfalık uygulama)
  app.use((req, res) => {
    const index = path.join(DIST, 'index.html');
    if (fs.existsSync(index)) return res.sendFile(index);
    res
      .status(404)
      .send('Arayüz derlenmemiş. Önce "npm run build" çalıştırın (geliştirirken: npm run dev).');
  });

  return { app, db };
}
