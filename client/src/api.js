// Sunucuyla konuşan küçük yardımcı. Cookie aynı sitede olduğu için fetch
// otomatik gönderir; ayrıca token saklamamıza gerek yok.

export async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    // Oturum düşmüş: giriş sayfasına git
    window.location.href = '/login';
    throw new Error('Giriş gerekli.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Bir hata oluştu.');
  return data;
}
