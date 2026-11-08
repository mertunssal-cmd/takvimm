// Tarih yardımcıları.
//
// Uygulamada tüm tarihler "YYYY-AA-GG" biçiminde metin (string) olarak tutulur
// (örn. "2026-11-08"). Saat/saat dilimi yoktur; böylece yaz saati geçişleri
// veya sunucunun saat dilimi yüzünden tarihlerin bir gün kayması engellenir.
// Hesaplamaları UTC gece yarısı üzerinden yapıyoruz.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-11-08" geçerli bir takvim tarihi mi? (2026-02-30 gibi olanları reddeder) */
export function isValidDate(str) {
  if (typeof str !== 'string' || !DATE_RE.test(str)) return false;
  const d = new Date(str + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

/** Metni UTC gece yarısındaki gün sayısına çevirir (1970'ten beri geçen gün). */
function toDayNumber(str) {
  return Math.round(Date.parse(str + 'T00:00:00Z') / DAY_MS);
}

/** Gün sayısını tekrar "YYYY-AA-GG" metnine çevirir. */
function fromDayNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** Tarihe gün ekler (negatif de olabilir). addDays("2026-01-30", 3) -> "2026-02-02" */
export function addDays(str, days) {
  return fromDayNumber(toDayNumber(str) + days);
}

/** İki tarih arasındaki gün farkı (b - a). diffDays("2026-01-01","2026-01-04") -> 3 */
export function diffDays(a, b) {
  return toDayNumber(b) - toDayNumber(a);
}
