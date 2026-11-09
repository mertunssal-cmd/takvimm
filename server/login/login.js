// Giriş formu: bilgileri sunucuya gönderir, başarılıysa uygulamaya geçer.
// (Bu dosya ayrı tutuldu çünkü güvenlik politikası (CSP) satır içi script'e izin vermiyor.)
const form = document.getElementById('form');
const errorBox = document.getElementById('error');
const button = document.getElementById('submit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  button.disabled = true;
  button.textContent = 'Kontrol ediliyor…';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username.value.trim(),
        password: form.password.value,
        remember: form.remember.checked,
      }),
    });
    if (res.ok) {
      window.location.replace('/');
      return;
    }
    const data = await res.json().catch(() => ({}));
    showError(data.error || 'Giriş yapılamadı.');
  } catch {
    showError('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
  }
  button.disabled = false;
  button.textContent = 'Giriş yap';
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
  form.password.value = '';
  form.password.focus();
}
