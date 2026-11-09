// Arayüz için tarih yardımcıları (Türkçe biçimlendirme, bugünün tarihi vb.).
// Hesaplama yardımcıları (addDays, diffDays) sunucuyla ortak: shared/dates.js
import { diffDays } from '../../shared/dates.js';
export { addDays, diffDays } from '../../shared/dates.js';

const pad = (n) => String(n).padStart(2, '0');

/** Telefonun/bilgisayarın yerel saatine göre bugünün tarihi: "YYYY-AA-GG" */
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ymd(year, monthIndex, day) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

// Metni yerel tarihe çevir (sadece biçimlendirme için; saat önemsiz)
const toLocal = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
// Hafta Pazartesi başlar
export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const WEEKDAYS_LONG = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** "12 Kasım Perşembe" */
export function formatLong(str) {
  const d = toLocal(str);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${WEEKDAYS_LONG[d.getDay()]}`;
}

/** "12 Kas" */
export function formatShort(str) {
  const d = toLocal(str);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** Pazartesi=0 ... Pazar=6 */
export function mondayIndex(year, monthIndex, day) {
  return (new Date(year, monthIndex, day).getDay() + 6) % 7;
}

/** "bugün", "yarın", "3 gün sonra", "2 gün önce" */
export function relative(str, today) {
  const n = diffDays(today, str);
  if (n === 0) return 'bugün';
  if (n === 1) return 'yarın';
  if (n === -1) return 'dün';
  return n > 0 ? `${n} gün sonra` : `${-n} gün önce`;
}
