// Tekrar hesaplama fonksiyonunun birim testleri.
// Çalıştırma: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeReviewDates, normalizeIntervals } from '../shared/schedule.js';
import { addDays, diffDays, isValidDate } from '../shared/dates.js';

test('tarih yardımcıları: ay/yıl geçişleri ve artık yıl', () => {
  assert.equal(addDays('2026-01-30', 3), '2026-02-02');
  assert.equal(addDays('2026-12-30', 5), '2027-01-04');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29'); // 2028 artık yıl
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-01-01', '2026-01-22'), 21);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2026-2-3'), false);
  assert.equal(isValidDate('2026-02-28'), true);
});

test('sınav yoksa: 3 / 7 / 21 gün sonra', () => {
  assert.deepEqual(computeReviewDates('2026-11-08', [3, 7, 21], null), [
    '2026-11-11',
    '2026-11-15',
    '2026-11-29',
  ]);
});

test('sınav uzak: aralıklar aynen kalır', () => {
  // Sınav 2 ay sonra -> hiçbir tekrar sınavı geçmiyor
  assert.deepEqual(computeReviewDates('2026-11-08', [3, 7, 21], '2027-01-10'), [
    '2026-11-11',
    '2026-11-15',
    '2026-11-29',
  ]);
});

test('son tekrar tam sınavdan 1 gün önceye denk geliyorsa kısaltma yok', () => {
  // 08 + 21 = 29 Kasım, sınav 30 Kasım
  assert.deepEqual(computeReviewDates('2026-11-08', [3, 7, 21], '2026-11-30'), [
    '2026-11-11',
    '2026-11-15',
    '2026-11-29',
  ]);
});

test('sınavdan sonraya düşen tekrar: aralıklar orantılı kısalır', () => {
  // Sınav 18 Kasım -> son tekrar en geç 17 Kasım (9 gün sonra)
  // oran 9/21: 3->1.29->1, 7->3, 21->9
  const dates = computeReviewDates('2026-11-08', [3, 7, 21], '2026-11-18');
  assert.deepEqual(dates, ['2026-11-09', '2026-11-11', '2026-11-17']);
  // Hepsi sınavdan önce, son tekrar sınavdan en az 1 gün önce
  for (const d of dates) assert.ok(diffDays(d, '2026-11-18') >= 1);
  assert.equal(dates.at(-1), '2026-11-17');
});

test('sınav yakın (3 gün sonra): tekrarlar sıkışır, aynı güne düşenler atılır', () => {
  // available = 2 gün: 3->0.29->1, 7->0.67->1 (aynı gün, atılır), 21->2
  assert.deepEqual(computeReviewDates('2026-11-08', [3, 7, 21], '2026-11-11'), [
    '2026-11-09',
    '2026-11-10',
  ]);
});

test('sınav 2 gün sonra: tek tekrar (sınavdan önceki gün)', () => {
  assert.deepEqual(computeReviewDates('2026-11-08', [3, 7, 21], '2026-11-10'), ['2026-11-09']);
});

test('sınav yarın veya bugün: tekrar oluşmaz', () => {
  assert.deepEqual(computeReviewDates('2026-11-08', [3, 7, 21], '2026-11-09'), []);
});

test('sınav geçmişse (çalışmadan önce): sınav kısıtı uygulanmaz', () => {
  assert.deepEqual(computeReviewDates('2026-11-08', [3, 7, 21], '2026-11-01'), [
    '2026-11-11',
    '2026-11-15',
    '2026-11-29',
  ]);
  assert.deepEqual(computeReviewDates('2026-11-08', [3, 7, 21], '2026-11-08'), [
    '2026-11-11',
    '2026-11-15',
    '2026-11-29',
  ]);
});

test('özel aralıklar: sırasız/tekrarlı girilse de düzgün çalışır', () => {
  assert.deepEqual(computeReviewDates('2026-11-08', [7, 1, 7, 3], null), [
    '2026-11-09',
    '2026-11-11',
    '2026-11-15',
  ]);
});

test('ay sonunda sınav: yıl geçişi doğru', () => {
  const dates = computeReviewDates('2026-12-25', [3, 7, 21], '2027-01-05');
  // available = 10 gün: 3->1.43->1, 7->3.33->3, 21->10
  assert.deepEqual(dates, ['2026-12-26', '2026-12-28', '2027-01-04']);
});

test('geçersiz çalışma tarihi hata fırlatır', () => {
  assert.throws(() => computeReviewDates('2026-13-01', [3], null));
});

test('normalizeIntervals: doğrulama', () => {
  assert.deepEqual(normalizeIntervals([21, 3, 7]), [3, 7, 21]);
  assert.deepEqual(normalizeIntervals(['2', '5']), [2, 5]);
  assert.equal(normalizeIntervals([]), null);
  assert.equal(normalizeIntervals([0, 3]), null);
  assert.equal(normalizeIntervals([1.5]), null);
  assert.equal(normalizeIntervals('3,7'), null);
});
