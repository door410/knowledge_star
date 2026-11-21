// Windows 版「匯入舊的知識網資料夾」的體檢測試（M3）：node tests/health-import.cjs
// 需要 Electron 本體，第一次先跑：node node_modules/electron/install.js
// 會短暫開一個知識網視窗；資料放在暫存資料夾，不碰真正的「文件＼知識網資料」。
const { execFileSync, spawnSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const root = path.join(__dirname, '..');
execFileSync(process.execPath, ['scripts/build-web.mjs'], { cwd: root, stdio: 'inherit' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-import-'));
const old = path.join(dir, '舊的', '知識網資料');   // 選「舊的」資料夾，程式要自己找到裡面的「知識網資料」
const put = (p, t) => { const f = path.join(old, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
put('02-知識/2026-01-01 舊來源/舊點.md', '---\nid: oldpt\n主題: 測試\n子主題: 其他\n---\n# 舊點\n\n說明\n');
put('03-我的/同名.md', '舊資料夾的版本');
const env = { ...process.env, KN_TEST_DIR: dir, KN_TEST_JS: path.join(__dirname, 'health-import.js'), KN_IMPORT_DIR: path.join(dir, '舊的') };
delete env.ELECTRON_RUN_AS_NODE;
const r = spawnSync(require('electron'), [path.join(__dirname, 'health-import-main.cjs')], { cwd: root, env, encoding: 'utf8', timeout: 180000 });
fs.rmSync(dir, { recursive: true, force: true });
const line = (r.stdout || '').split('\n').find(l => l.startsWith('KNTEST'));
if (!line || !line.startsWith('KNTEST ')) { console.error('測試沒有跑完：', line || r.stderr || r.error); process.exit(1); }
const res = JSON.parse(line.slice(7)); let bad = 0;
for (const [k, v] of Object.entries(res)) { console.log((v === 'ok' ? '通過　' : '失敗　') + k + (v === 'ok' ? '' : '：' + v)); if (v !== 'ok') bad++; }
process.exit(bad ? 1 : 0);
