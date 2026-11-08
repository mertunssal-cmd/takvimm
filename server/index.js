// Sunucunun giriş noktası: .env'yi okur ve uygulamayı başlatır.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.DB_PATH || path.join(root, 'data', 'takvim.db');

let app;
try {
  ({ app } = createApp({
    dbPath: DB_PATH,
    username: process.env.APP_USERNAME,
    passwordHash: process.env.APP_PASSWORD_HASH,
    trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  }));
} catch (err) {
  console.error('\n❌ ' + err.message + '\n');
  process.exit(1);
}

// 0.0.0.0 = aynı Wi-Fi'daki telefondan da erişilebilsin
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
  console.log(`   Veritabanı: ${DB_PATH}`);
});
