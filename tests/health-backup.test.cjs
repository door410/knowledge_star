// 體檢 11/21（M1）：Windows 版自動備份的檔名不能帶路徑，否則畫面端可以把檔案寫到備份資料夾外面
// 用假的 electron 模組載入 electron/main.cjs，直接呼叫 io:autoBackup（不需要下載 Electron）
// 執行：node tests/health-backup.test.cjs
const assert = require('node:assert'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), Module = require('node:module');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-health-'));
process.env.KN_TEST_DIR = dir;
const handlers = {};
const fake = {
  app: { getPath: k => path.join(dir, k), setPath() {}, requestSingleInstanceLock: () => false, quit() {}, on() {}, whenReady: () => new Promise(() => {}) },
  ipcMain: { handle: (n, f) => { handlers[n] = f; } },
  BrowserWindow: {}, dialog: {}, shell: {}, safeStorage: {}, Menu: {}, nativeImage: {},
};
const load = Module._load;
Module._load = function (req, ...a) { return req === 'electron' ? fake : load.call(this, req, ...a); };
require('../electron/main.cjs');
Module._load = load;
const done = code => { fs.rmSync(dir, { recursive: true, force: true }); process.exit(code); };
(async () => {
  const bk = path.join(dir, '知識網備份');
  await handlers['io:autoBackup'](null, '自動備份 2026-11-21 1200.zip', new Uint8Array([1, 2, 3]));
  assert.ok(fs.existsSync(path.join(bk, '自動備份 2026-11-21 1200.zip')), '正常檔名應該存得進去');
  for (const bad of ['../逃出去.zip', '..\\逃出去2.zip', path.join(dir, '絕對路徑.zip')]) {
    let threw = false;
    try { await handlers['io:autoBackup'](null, bad, new Uint8Array([9])); } catch (e) { threw = true; }
    assert.ok(threw, '應該拒絕這個檔名：' + bad);
  }
  for (const f of ['逃出去.zip', '逃出去2.zip', '絕對路徑.zip']) assert.ok(!fs.existsSync(path.join(dir, f)), '寫到備份資料夾外面了：' + f);
  console.log('✓ 自動備份的檔名不能帶路徑（M1）');
  done(0);
})().catch(e => { console.error('✗ ' + e.message); done(1); });
