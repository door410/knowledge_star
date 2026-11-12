// ===== 知識網 Windows 版（Electron 主程序）=====
// 資料：文件\知識網資料（Markdown，和 Android 版透過 Google 雲端硬碟同步）；備份：文件\知識網備份
// Google 登入：電腦版應用程式 OAuth（系統瀏覽器＋127.0.0.1 回傳＋PKCE），長期授權用 Windows 帳號加密保存（google-token.bin）
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Menu } = require('electron');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
let GOOGLE = { clientId: '', clientSecret: '' };
try { GOOGLE = require('./google-client.cjs'); } catch (e) { /* 建置時由 GitHub Secrets 產生 */ }

// KN_TEST_DIR：自動測試用（tests/electron-smoke.cjs），不碰真正的資料
const DOCS = () => process.env.KN_TEST_DIR || app.getPath('documents');
const DATA = () => path.join(DOCS(), '知識網資料');
const BACKUP = () => path.join(DOCS(), '知識網備份');
const TEXT = /\.(md|json|txt)$/i;
function inside(base, rel) {
  const p = path.resolve(base, rel);
  if (!p.startsWith(path.resolve(base) + path.sep)) throw new Error('不允許的路徑');
  return p;
}
function walk(base, dir = '', out = []) {
  let list = []; try { list = fs.readdirSync(path.join(base, dir), { withFileTypes: true }); } catch (e) { return out; }
  for (const d of list) {
    const rel = dir ? dir + '/' + d.name : d.name;
    if (d.isDirectory()) { if (d.name !== '.obsidian' && d.name !== '.git') walk(base, rel, out); }
    else if (TEXT.test(d.name)) { const f = path.join(base, rel); out.push({ path: rel, text: fs.readFileSync(f, 'utf8').replace(/^﻿/, ''), mtime: fs.statSync(f).mtimeMs }); }
  }
  return out;
}

// ---------- 資料（vfs.js 用）----------
ipcMain.handle('vfs:list', () => { fs.mkdirSync(DATA(), { recursive: true }); return walk(DATA()); });
ipcMain.handle('vfs:write', (_e, rel, text) => {
  const f = inside(DATA(), rel); fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, text, 'utf8'); fs.renameSync(tmp, f);   // 先寫暫存檔再換名：寫到一半當機也不會壞掉
});
ipcMain.handle('vfs:remove', (_e, rel) => {
  const f = inside(DATA(), rel); fs.rmSync(f, { force: true });
  let d = path.dirname(f); const root = path.resolve(DATA());
  while (d.startsWith(root + path.sep)) { try { if (fs.readdirSync(d).length) break; fs.rmdirSync(d); } catch (e) { break; } d = path.dirname(d); }
});

// ---------- 備份、匯入 ----------
ipcMain.handle('io:saveAs', async (e, name, bytes) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  fs.mkdirSync(BACKUP(), { recursive: true });
  const r = await dialog.showSaveDialog(w, { defaultPath: path.join(BACKUP(), name), filters: [{ name: '知識網備份', extensions: ['zip'] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(bytes)); return r.filePath;
});
ipcMain.handle('io:autoBackup', (_e, name, bytes) => {
  fs.mkdirSync(BACKUP(), { recursive: true });
  fs.writeFileSync(path.join(BACKUP(), name), Buffer.from(bytes));
  const old = fs.readdirSync(BACKUP()).filter(n => n.startsWith('自動備份 ') && n.endsWith('.zip')).sort().reverse().slice(8);
  old.forEach(n => fs.rmSync(path.join(BACKUP(), n), { force: true }));
  return path.join(BACKUP(), name);
});
ipcMain.handle('io:importFolder', async e => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(w, { title: '選舊的「知識網資料」資料夾（裡面有 02-知識）', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  let base = r.filePaths[0];
  if (!fs.existsSync(path.join(base, '02-知識')) && fs.existsSync(path.join(base, '知識網資料', '02-知識'))) base = path.join(base, '知識網資料');
  if (!fs.existsSync(path.join(base, '02-知識'))) { await dialog.showMessageBox(w, { type: 'warning', message: '這個資料夾裡沒有「02-知識」，請選「知識網資料」資料夾。' }); return null; }
  return walk(base).filter(f => /^(00-收件匣|02-知識|03-我的|04-知識網)\//.test(f.path)).map(({ path, text }) => ({ path, text }));
});
ipcMain.handle('io:openDataDir', () => shell.openPath(DATA()));

// ---------- Google 登入（只要求 drive.file）----------
const SCOPE = 'https://www.googleapis.com/auth/drive.file', TOKEN_URL = 'https://oauth2.googleapis.com/token';
const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenFile = () => path.join(app.getPath('userData'), 'google-token.bin');
const configured = () => !!(GOOGLE.clientId && GOOGLE.clientSecret);
let access = null;
function readRefresh() {
  if (!fs.existsSync(tokenFile())) return null;
  const buf = fs.readFileSync(tokenFile());
  try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8'); } catch (e) { return null; }
}
const saveRefresh = t => fs.writeFileSync(tokenFile(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(t) : Buffer.from(t, 'utf8'));
async function tokenRequest(params) {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const j = await r.json().catch(() => ({})); return { ok: r.ok, ...j };
}
const page = msg => `<!doctype html><meta charset="utf-8"><title>知識網</title><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>${msg}</h2><p>可以關閉這個分頁，回到「知識網」。</p></body>`;
async function signIn() {
  if (!configured()) throw new Error('這個安裝版沒有設定 Google 連線');
  const verifier = b64url(crypto.randomBytes(32)), challenge = b64url(crypto.createHash('sha256').update(verifier).digest()), state = b64url(crypto.randomBytes(16));
  const got = await new Promise((resolve, reject) => {
    let redirect = '';
    const server = http.createServer((req, res) => {
      const u = new URL(req.url || '/', 'http://127.0.0.1');
      if (u.pathname !== '/') { res.writeHead(404).end(); return; }
      const err = u.searchParams.get('error'), c = u.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (err || !c || u.searchParams.get('state') !== state) { res.end(page('沒有完成登入')); done(); reject(new Error(err === 'access_denied' ? '已取消 Google 登入' : `Google 登入失敗（${err || '回傳資料不正確'}）`)); return; }
      res.end(page('登入完成')); done(); resolve({ code: c, redirect });
    });
    const timer = setTimeout(() => { done(); reject(new Error('登入逾時（5 分鐘內沒有完成），請再試一次')); }, 5 * 60000);
    const done = () => { clearTimeout(timer); server.close(); };
    server.listen(0, '127.0.0.1', () => {
      redirect = `http://127.0.0.1:${server.address().port}`;
      shell.openExternal('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: GOOGLE.clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPE,
        code_challenge: challenge, code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent',
      }).toString());
    });
  });
  const t = await tokenRequest({ code: got.code, client_id: GOOGLE.clientId, client_secret: GOOGLE.clientSecret, redirect_uri: got.redirect, grant_type: 'authorization_code', code_verifier: verifier });
  if (!t.ok || !t.access_token) throw new Error(`Google 登入失敗（${t.error_description || t.error || '無法取得權杖'}）`);
  if (t.refresh_token) saveRefresh(t.refresh_token);
  else if (!readRefresh()) throw new Error('Google 沒有提供長期授權，請到 Google 帳戶移除「知識網」的存取權後再登入一次');
  access = { token: t.access_token, exp: Date.now() + (t.expires_in || 3600) * 1000 };
  const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
}
async function token(force) {
  if (!force && access && access.exp > Date.now() + 60000) return access.token;
  const refresh = readRefresh(); if (!refresh) throw new Error('需要登入 Google（同步與備份 → 連接）');
  let t; try { t = await tokenRequest({ refresh_token: refresh, client_id: GOOGLE.clientId, client_secret: GOOGLE.clientSecret, grant_type: 'refresh_token' }); }
  catch (e) { throw new Error('無法連線到 Google，請確認網路'); }
  if (!t.ok || !t.access_token) {
    if (t.error === 'invalid_grant') { fs.rmSync(tokenFile(), { force: true }); access = null; throw new Error('Google 授權已失效，請到「同步與備份」重新連接'); }
    throw new Error(`Google 權杖更新失敗（${t.error_description || t.error || '未知原因'}）`);
  }
  access = { token: t.access_token, exp: Date.now() + (t.expires_in || 3600) * 1000 };
  return access.token;
}
async function signOut() {
  const refresh = readRefresh();
  if (refresh) { try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }); } catch (e) { /* 離線時只刪本機權杖 */ } }
  fs.rmSync(tokenFile(), { force: true }); access = null;
}
const ALLOWED = /^https:\/\/(www\.googleapis\.com|oauth2\.googleapis\.com)\//;
ipcMain.handle('google:configured', () => configured());
ipcMain.handle('google:signIn', () => signIn());
ipcMain.handle('google:token', (_e, force) => token(!!force));
ipcMain.handle('google:signOut', () => signOut());
ipcMain.handle('google:request', async (_e, req) => {
  if (!ALLOWED.test(req.url)) throw new Error('不允許的網址');
  const r = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body ? Buffer.from(req.body) : undefined });
  return { status: r.status, body: new Uint8Array(await r.arrayBuffer()) };
});

// ---------- 視窗 ----------
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    const w = new BrowserWindow({
      width: 1280, height: 820, show: false, title: '知識網', backgroundColor: '#000000', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
    });
    w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
    w.webContents.on('will-navigate', (ev, url) => { if (!url.startsWith('file://')) { ev.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); } });
    w.webContents.on('before-input-event', (_ev, input) => { if (input.type === 'keyDown' && input.key === 'F12' && input.control && input.shift) w.webContents.openDevTools(); });
    w.once('ready-to-show', () => { w.maximize(); w.show(); });
    w.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
    if (process.env.KN_TEST_DIR && process.env.KN_TEST_JS) w.webContents.once('did-finish-load', async () => {
      try { console.log('KNTEST ' + JSON.stringify(await w.webContents.executeJavaScript(fs.readFileSync(process.env.KN_TEST_JS, 'utf8')))); }
      catch (e) { console.log('KNTEST-FAIL ' + e.message); }
      app.exit(0);
    });
  });
  app.on('window-all-closed', () => app.quit());
}
