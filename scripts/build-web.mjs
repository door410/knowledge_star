// 把網頁（知識網.html＋js）複製到 www/，給 Android（Capacitor）和 Windows（Electron）用
// node scripts/build-web.mjs        → AI 版（原本的）
// node scripts/build-web.mjs plain  → 無 AI 版：不放 ai.js，畫面上不出現任何 AI 功能和文字
import { cpSync, mkdirSync, readdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
const plain = process.argv.includes('plain') || process.env.KN_VARIANT === 'plain';
rmSync('www', { recursive: true, force: true }); mkdirSync('www');
let html = readFileSync('知識網.html', 'utf8');
const flag = /<script>if\(\/\[\?&\]plain=1\/\.test\(location\.search\)\)window\.KN_PLAIN=1<\/script>/;
if (!flag.test(html)) throw new Error('知識網.html 裡找不到版本開關');
html = html.replace(flag, plain ? '<script>window.KN_PLAIN=1</script>' : '');
if (plain) html = html.replace('<script src="ai.js"></script>\n', '');
writeFileSync('www/index.html', html);
for (const f of readdirSync('.')) if (f.endsWith('.js') && !(plain && f === 'ai.js')) copyFileSync(f, 'www/' + f);
cpSync('data', 'www/data', { recursive: true });
console.log(`www/ 建好了（${plain ? '無 AI 版' : 'AI 版'}）`);
