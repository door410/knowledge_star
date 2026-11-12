// 把網頁（知識網.html＋js）複製到 www/，給 Android（Capacitor）和 Windows（Electron）用
import { cpSync, mkdirSync, readdirSync, rmSync, copyFileSync } from 'node:fs';
rmSync('www', { recursive: true, force: true }); mkdirSync('www');
copyFileSync('知識網.html', 'www/index.html');
for (const f of readdirSync('.')) if (f.endsWith('.js')) copyFileSync(f, 'www/' + f);
cpSync('data', 'www/data', { recursive: true });
console.log('www/ 建好了');
