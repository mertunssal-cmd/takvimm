// Aralıklı tekrar tarihlerini hesaplayan SAF fonksiyon.
// (Saf = veritabanına/dış dünyaya dokunmaz; aynı girdiye hep aynı çıktıyı verir.
//  Bu sayede birim testle kolayca test edilebilir: test/schedule.test.js)

import { addDays, diffDays, isValidDate } from './dates.js';

export const DEFAULT_INTERVALS = [3, 7, 21];

/**
 * Bir konunun tekrar tarihlerini hesaplar.
 *
 * @param {string}   studyDate  Konunun çalışıldığı gün, "YYYY-AA-GG"
 * @param {number[]} intervals  Çalışma gününden itibaren kaç gün sonra tekrar
 *                              yapılacağı, örn. [3, 7, 21]
 * @param {string|null} examDate Dersin sınav tarihi (yoksa null)
 * @returns {string[]} Artan sırada tekrar tarihleri
 *
 * Kurallar:
 *  1. Normalde tekrar günleri = çalışma günü + her aralık.
 *  2. Sınav tarihi varsa TÜM tekrarlar sınavdan önce kalmalı. Son tekrarın
 *     yapılabileceği en geç gün "sınavdan 1 gün önce"dir.
 *  3. En uzak tekrar bu sınırı aşıyorsa, tüm aralıklar aynı oranla küçültülür
 *     (orantılı kısaltma). En uzak tekrar tam olarak sınavdan 1 gün önceye denk gelir.
 *  4. Kısaltma sonrası iki tekrar aynı güne düşerse tekrarlanan gün atılır
 *     (aynı gün iki kez tekrar yapmanın anlamı yok).
 *  5. Çalışma günü ile sınavdan önceki gün arasında hiç gün yoksa tekrar oluşmaz.
 *  6. Sınav, çalışma gününden önce (veya aynı gün) ise sınav geçmiş demektir;
 *     sınav kısıtı uygulanmaz, normal aralıklar kullanılır.
 */
export function computeReviewDates(studyDate, intervals = DEFAULT_INTERVALS, examDate = null) {
  if (!isValidDate(studyDate)) throw new Error('Geçersiz çalışma tarihi: ' + studyDate);

  // Aralıkları temizle: pozitif tam sayılar, küçükten büyüğe, tekrarsız.
  const offsets = [...new Set(intervals.map(Number))]
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
  if (offsets.length === 0) return [];

  const maxOffset = offsets[offsets.length - 1];

  // Sınav yoksa ya da sınav geçmişse (kural 6): düz hesap.
  const examApplies = examDate && isValidDate(examDate) && diffDays(studyDate, examDate) > 0;
  if (!examApplies) return offsets.map((d) => addDays(studyDate, d));

  // Son tekrarın en fazla kaç gün sonra olabileceği (sınavdan 1 gün önce).
  const available = diffDays(studyDate, examDate) - 1;
  if (available < 1) return []; // kural 5: sınav yarın ya da bugün sonrası boşluk yok

  // Hepsi zaten sığıyorsa dokunma (kural 1).
  if (maxOffset <= available) return offsets.map((d) => addDays(studyDate, d));

  // Orantılı kısaltma (kural 3): her aralığı available / maxOffset ile çarp.
  const ratio = available / maxOffset;
  const result = [];
  let last = 0;
  for (const d of offsets) {
    // En az 1 gün sonra, en geç "available" gün sonra olacak şekilde yuvarla.
    const scaled = Math.min(available, Math.max(1, Math.round(d * ratio)));
    if (scaled > last) {
      // kural 4: bir öncekiyle aynı güne düşeni atla
      result.push(scaled);
      last = scaled;
    }
  }
  return result.map((d) => addDays(studyDate, d));
}

/** Ayarlardan gelen aralık listesini doğrular. Geçerliyse temiz bir dizi döner, değilse null. */
export function normalizeIntervals(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) return null;
  const nums = value.map(Number);
  if (!nums.every((n) => Number.isInteger(n) && n >= 1 && n <= 365)) return null;
  return [...new Set(nums)].sort((a, b) => a - b);
}
