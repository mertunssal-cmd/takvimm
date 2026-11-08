// Giriş / oturum / yanlış giriş sınırlaması.
//
// Nasıl çalışır?
//  1. Kullanıcı adı ve şifrenin bcrypt özeti (.env dosyasındaki APP_USERNAME ve
//     APP_PASSWORD_HASH) sunucuda saklanır. Şifrenin kendisi hiçbir yerde tutulmaz.
//  2. Giriş başarılıysa rastgele, tahmin edilemez bir anahtar (token) üretilir ve
//     tarayıcıya HTTP-only cookie olarak gönderilir. HTTP-only = sayfadaki JavaScript
//     bu cookie'yi okuyamaz (XSS saldırılarına karşı koruma).
//  3. Veritabanında anahtarın kendisi değil SHA-256 özeti tutulur; veritabanı
//     sızsa bile oturum çalınamaz.
//  4. Her istekte cookie kontrol edilir; geçersizse API 401 döner, sayfalar /login'e yönlenir.

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const COOKIE_NAME = 'takvim_session';
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // "Beni hatırla": 30 gün
const SHORT_MS = 12 * 60 * 60 * 1000; // Hatırlama yoksa: 12 saat (ve tarayıcı kapanınca silinir)

// Yanlış giriş sınırı: aynı IP'den 15 dakika içinde 5 yanlış deneme -> 15 dakika bekletme.
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Zamanlama saldırılarına karşı sabit sürede metin karşılaştırma. */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function createAuth({ db, username, passwordHash }) {
  if (!username || !passwordHash) {
    throw new Error(
      'APP_USERNAME ve APP_PASSWORD_HASH tanımlı değil. Önce "npm run setup" komutunu çalıştırın.',
    );
  }

  // ---- Oturum işlemleri (veritabanında) ----
  const insertSession = db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)');
  const findSession = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?');
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const deleteExpired = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

  function isLoggedIn(req) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return false;
    const row = findSession.get(hashToken(token));
    return !!row && row.expires_at > Date.now();
  }

  // ---- Yanlış giriş sayacı (bellekte; sunucu yeniden başlarsa sıfırlanır) ----
  const attempts = new Map(); // ip -> { fails, firstFailAt, lockedUntil }

  function lockRemainingMs(ip) {
    const a = attempts.get(ip);
    return a && a.lockedUntil > Date.now() ? a.lockedUntil - Date.now() : 0;
  }

  function registerFail(ip) {
    const now = Date.now();
    let a = attempts.get(ip);
    if (!a || now - a.firstFailAt > WINDOW_MS) a = { fails: 0, firstFailAt: now, lockedUntil: 0 };
    a.fails += 1;
    if (a.fails >= MAX_FAILS) {
      a.lockedUntil = now + LOCK_MS;
      a.fails = 0;
      a.firstFailAt = now;
    }
    attempts.set(ip, a);
  }

  // ---- Express route'ları ----

  async function login(req, res) {
    const ip = req.ip;
    const wait = lockRemainingMs(ip);
    if (wait > 0) {
      const minutes = Math.ceil(wait / 60000);
      return res
        .status(429)
        .json({ error: `Çok fazla yanlış deneme. ${minutes} dakika sonra tekrar deneyin.` });
    }

    const { username: u, password: p, remember } = req.body ?? {};
    // Kullanıcı adı yanlış olsa bile bcrypt'i çalıştırıyoruz ki yanıt süresinden
    // "kullanıcı adı doğru mu" anlaşılmasın.
    const passOk = await bcrypt.compare(String(p ?? ''), passwordHash);
    const userOk = safeEqual(u ?? '', username);

    if (!(passOk && userOk)) {
      registerFail(ip);
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    attempts.delete(ip);
    deleteExpired.run(Date.now());

    const token = crypto.randomBytes(32).toString('base64url');
    const lifetime = remember ? REMEMBER_MS : SHORT_MS;
    insertSession.run(hashToken(token), Date.now() + lifetime);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true, // JavaScript okuyamaz
      sameSite: 'lax', // başka sitelerden gelen isteklerde gönderilmez (CSRF koruması)
      secure: req.secure, // HTTPS üzerindeyken sadece HTTPS'te gönderilir
      path: '/',
      // remember yoksa maxAge vermiyoruz -> tarayıcı kapanınca silinen "oturum cookie'si"
      ...(remember ? { maxAge: REMEMBER_MS } : {}),
    });
    res.json({ ok: true });
  }

  function logout(req, res) {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) deleteSession.run(hashToken(token));
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  }

  /** API için: giriş yoksa 401 döner. */
  function requireApiAuth(req, res, next) {
    if (isLoggedIn(req)) return next();
    res.status(401).json({ error: 'Giriş gerekli.' });
  }

  /** Sayfalar için: giriş yoksa /login'e yönlendirir. */
  function requirePageAuth(req, res, next) {
    if (isLoggedIn(req)) return next();
    res.redirect('/login');
  }

  return { login, logout, isLoggedIn, requireApiAuth, requirePageAuth };
}
