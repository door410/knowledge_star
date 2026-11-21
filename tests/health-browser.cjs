// 瀏覽器端的體檢測試（M2、M3、S5）：node tests/health-browser.cjs
// 需要 Electron 本體，第一次先跑：node node_modules/electron/install.js
const { execFileSync, spawnSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const root = path.join(__dirname, '..');
execFileSync(process.execPath, ['scripts/build-web.mjs'], { cwd: root, stdio: 'inherit' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-health-'));
const env = { ...process.env, KN_TEST_DIR: dir }; delete env.ELECTRON_RUN_AS_NODE;
const r = spawnSync(require('electron'), [path.join(__dirname, 'health-browser-main.cjs')], { cwd: root, env, encoding: 'utf8', timeout: 180000 });
fs.rmSync(dir, { recursive: true, force: true });
const line = (r.stdout || '').split('\n').find(l => l.startsWith('KNTEST'));
if (!line || !line.startsWith('KNTEST ')) { console.error('測試沒有跑完：', line || r.stderr || r.error); process.exit(1); }
const res = JSON.parse(line.slice(7)); let bad = 0;
for (const [k, v] of Object.entries(res)) { console.log((v === 'ok' ? '通過　' : '失敗　') + k + (v === 'ok' ? '' : '：' + v)); if (v !== 'ok') bad++; }
process.exit(bad ? 1 : 0);
