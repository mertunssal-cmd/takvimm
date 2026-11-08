// İlk kurulum: kullanıcı adı ve şifre sorar, şifreyi bcrypt ile özetleyip .env'ye yazar.
// Çalıştırma: npm run setup
//
// Şifrenin kendisi hiçbir yere kaydedilmez; sadece bcrypt özeti (hash) kaydedilir.
// Şifreyi değiştirmek için bu komutu tekrar çalıştırmanız yeterli.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let muted = false;
// Şifre yazılırken ekranda görünmesin diye çıktıyı yıldızla değiştiriyoruz.
rl._writeToOutput = (s) => {
  if (!muted) return rl.output.write(s);
  if (s.includes('\n') || s.includes('\r')) rl.output.write('\n');
  else rl.output.write('*');
};
const input = rl[Symbol.asyncIterator]();
async function ask(question, hidden = false) {
  rl.output.write(question);
  muted = hidden;
  const { value } = await input.next();
  muted = false;
  return value ?? '';
}

const username = (await ask('Kullanıcı adı: ')).trim();
const password = await ask('Şifre (en az 8 karakter): ', true);
const again = await ask('Şifre (tekrar): ', true);
rl.close();

if (!username) fail('Kullanıcı adı boş olamaz.');
if (password.length < 8) fail('Şifre en az 8 karakter olmalı.');
if (password !== again) fail('Şifreler eşleşmiyor.');

const hash = await bcrypt.hash(password, 12);

// Var olan .env'deki diğer satırları (PORT, DB_PATH ...) koru, sadece bu ikisini güncelle.
let lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split('\n') : [];
lines = lines.filter((l) => !/^(APP_USERNAME|APP_PASSWORD_HASH)=/.test(l));
while (lines.length && lines.at(-1).trim() === '') lines.pop();
// bcrypt özetinde "$" işaretleri var; tek tırnak içinde yazıyoruz.
lines.push(`APP_USERNAME=${username}`, `APP_PASSWORD_HASH='${hash}'`, '');
fs.writeFileSync(envPath, lines.join('\n'));

console.log(`\n✅ .env dosyası güncellendi (${envPath}).`);
console.log('   Barındırma servisinde (Render vb.) kullanmak için şu iki değeri kopyalayın:');
console.log(`   APP_USERNAME=${username}`);
console.log(`   APP_PASSWORD_HASH=${hash}`);

function fail(msg) {
  console.error('\n❌ ' + msg);
  process.exit(1);
}
