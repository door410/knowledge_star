// ===== 同步與備份（App 版，06 第 40 輪）=====
// Google 雲端硬碟：資料夾「知識網同步（請勿手動修改）」裡，每台裝置一個檔（.knsync，壓縮過的完整資料＋版本）。
// 每台只改寫自己的檔、讀別台的檔來合併（規則見 sync-core.js），所以兩台同時同步也不會互相蓋掉；
// 每台的檔都是一份完整資料，雲端硬碟也會自動保留舊版本。
// 備份：完整備份＝一個 .zip（裡面就是 Markdown 資料夾）；每週自動備份一次，留最近 8 份。
// 回收桶：刪掉的檔案留 60 天（vfs.js）。
(() => {
const V = window.KNVFS; if (!V) return;
const KN = window.KN, C = window.KNSyncCore, Z = window.KNZip, { h, toast, openPane, pbody } = KN;
const N = V.native, GD = window.KNAPP === 'android' ? Capacitor.Plugins.GoogleDrive : null;
const FS = window.KNAPP === 'android' ? Capacitor.Plugins.Filesystem : null;
const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const enc = new TextEncoder(), dec = new TextDecoder();
const b64e = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const b64d = s => { const b = atob(s || ''), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const z2 = n => String(n).padStart(2, '0');
const stamp = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())} ${z2(d.getHours())}${z2(d.getMinutes())}`; };
const ago = t => { if (!t) return '還沒有'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '剛剛' : m < 60 ? m + ' 分鐘前' : m < 1440 ? Math.round(m / 60) + ' 小時前' : Math.round(m / 1440) + ' 天前'; };
const msg = e => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');   // Windows 版的錯誤訊息去掉技術前綴
const syncable = p => !p.startsWith('04-知識網/時光機/');

// ---------- 各平台：Google 登入、連線、存檔 ----------
const P = {
  can: !!(N || GD),
  connect: async () => { if (N) await N.google.signIn(); else { await GD.chooseAccount(); await GD.authorize({ interactive: true }); } },
  token: async force => N ? N.google.token(!!force) : (await GD.authorize({ interactive: false })).accessToken,
  signOut: async () => { if (N) await N.google.signOut(); else await GD.forget(); },
  async http(method, url, headers, body) {
    if (N) { const r = await N.google.request({ method, url, headers, body }); return { status: r.status, body: new Uint8Array(r.body) }; }
    const r = await GD.request({ method, url, headers, ...(body ? { body: b64e(body) } : {}) }); return { status: r.status, body: b64d(r.body) };
  },
};
const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3', FOLDER = '知識網同步（請勿手動修改）';
async function call(method, url, o = {}) {
  for (let i = 0; i < 2; i++) {
    const headers = { Authorization: 'Bearer ' + await P.token(i > 0) }; let body;
    if (o.json) { headers['Content-Type'] = 'application/json; charset=UTF-8'; body = enc.encode(JSON.stringify(o.json)); }
    if (o.bytes) { headers['Content-Type'] = 'application/octet-stream'; body = o.bytes; }
    const r = await P.http(method, url, headers, body);
    if (r.status === 401 && i === 0) continue;
    if (r.status >= 400) { const e = new Error(`雲端硬碟回應 ${r.status}：${dec.decode(r.body).slice(0, 160)}`); e.status = r.status; throw e; }
    return r;
  }
}
const J = r => JSON.parse(dec.decode(r.body) || '{}');
const gz = async (u, d) => new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(d ? new DecompressionStream('gzip') : new CompressionStream('gzip'))).arrayBuffer());

// ---------- 本機的同步紀錄（.sync/meta.json）----------
const MF = '.sync/meta.json';
let M = null, clk = null, saveT = 0;
const saveM = (now) => { clearTimeout(saveT); const go = () => V.raw.put(MF, JSON.stringify(M)).catch(e => console.warn(e)); if (now) return go(); saveT = setTimeout(go, 1500); };
const bumpLocal = (p, text) => { M.ver[p] = C.bump(M.ver[p], M.dev, clk, text == null ? '' : C.hash(text), text == null); M.gen++; M.dirty = true; };

// ---------- 套用別台來的修改（會進「紀錄與復原」和回收桶，救得回來）----------
async function dirOf(p) { let d = V.root; const seg = p.split('/'); for (const s of seg.slice(0, -1)) d = await d.getDirectoryHandle(s, { create: true }); return [d, seg[seg.length - 1]]; }
async function writeRemote(p, text) { if (window.knHist && p.startsWith('02-知識/')) { const [d, n] = await dirOf(p); await knHist(d, n, text); } await V.put(p, text, true); }
async function delRemote(p) { if (V.get(p) == null) return; if (window.knHist && p.startsWith('02-知識/')) { const [d, n] = await dirOf(p); await knHist(d, n, null); } await V.del(p, true); }
async function applyRemote(files) {
  const { acts, next } = C.merge(M.ver, p => V.get(p), files, clk, M.dev);
  for (const a of acts) {
    if (a.op === 'write') await writeRemote(a.path, a.text ?? '');
    else if (a.op === 'delete') await delRemote(a.path);
    else if (a.op === 'conflict') { if (V.get(a.path) !== a.text) await V.put(a.path, a.text ?? ''); if (!M.conflicts.some(c => c.path === a.path)) M.conflicts.push({ path: a.path, from: a.from, at: Date.now() }); }
  }
  Object.assign(M.ver, next);
  return acts.length;
}

// ---------- 同步一次：讀別台的檔 → 合併 → 上傳這台的檔 ----------
let running = null, timer = 0, fails = 0;
async function folderId() {
  if (M.folder) return M.folder;
  const q = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const f = J(await call('GET', `${API}/files?q=${q}&fields=files(id)&spaces=drive`)).files || [];
  M.folder = f.length ? f[0].id : J(await call('POST', `${API}/files?fields=id`, { json: { name: FOLDER, mimeType: 'application/vnd.google-apps.folder' } })).id;
  saveM(); return M.folder;
}
async function push(folder) {
  const gen = M.gen, files = {};
  for (const [p, x] of Object.entries(M.ver)) { if (!syncable(p)) continue; if (x.del) files[p] = x; else { const t = V.get(p); if (t != null) files[p] = { ...x, t }; } }
  const bytes = await gz(enc.encode(JSON.stringify({ format: 1, device: M.dev, label: M.label, at: Date.now(), files })));
  if (M.mine) { try { await call('PATCH', `${UP}/files/${M.mine}?uploadType=media`, { bytes }); } catch (e) { if (e.status === 404) M.mine = null; else throw e; } }
  if (!M.mine) { M.mine = J(await call('POST', `${API}/files?fields=id`, { json: { name: `${M.label} ${M.dev}.knsync`, parents: [folder], mimeType: 'application/octet-stream' } })).id; await call('PATCH', `${UP}/files/${M.mine}?uploadType=media`, { bytes }); }
  if (M.gen === gen) M.dirty = false;
}
function syncNow(manual) {
  if (!M || !M.on || !P.can) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    setDot('run');
    try {
      let folder = await folderId(), list;
      const q = id => encodeURIComponent(`'${id}' in parents and trashed=false`);
      try { list = J(await call('GET', `${API}/files?q=${q(folder)}&fields=files(id,name,modifiedTime)&pageSize=1000&spaces=drive`)).files || []; }
      catch (e) { if (e.status !== 404) throw e; M.folder = null; M.mine = null; M.seen = {}; folder = await folderId(); list = []; }
      let changed = 0;
      for (const f of list) {
        if (f.id === M.mine || !/\.knsync$/.test(f.name) || M.seen[f.id] === f.modifiedTime) continue;
        const st = JSON.parse(dec.decode(await gz((await call('GET', `${API}/files/${f.id}?alt=media`)).body, true)));
        if (st.device !== M.dev && st.files) changed += await applyRemote(st.files);
        M.seen[f.id] = f.modifiedTime; M.devices[f.id] = { label: st.label, at: st.at };
      }
      if (M.dirty || !M.mine) await push(folder);
      M.last = Date.now(); M.err = ''; fails = 0; await saveM(true);
      if (changed) refresh(changed);
      if (manual) toast(changed ? `同步完成：從其他裝置收到 ${changed} 個修改` : '同步完成');
      setDot('ok');
    } catch (e) {
      console.warn(e); M.err = msg(e); fails++; saveM(); setDot('err');
      if (manual || fails === 3) toast('同步沒成功：' + msg(e) + '（資料都還在這台，之後會自動再試）', 8000);
    } finally { running = null; }
  })();
  return running;
}
const later = (ms = 15000) => { clearTimeout(timer); timer = setTimeout(() => syncNow(), ms); };
function refresh(n) { if (KN.paneOpen) return setTimeout(() => refresh(n), 2000); KN.load(true); }

// 右下角的小圓點：同步狀態（灰＝沒連、綠＝好、轉圈＝同步中、紅＝出錯）
const dot = h('button', { id: 'syncDot', title: '同步與備份' });
dot.onclick = () => knSyncPane();
document.head.append(h('style', {}, `
#syncDot{position:fixed;right:12px;bottom:12px;width:14px;height:14px;border-radius:50%;border:2px solid #8888;background:transparent;z-index:6;padding:0;cursor:pointer}
#syncDot.ok{background:#3fbf7f;border-color:#3fbf7f}#syncDot.err{background:#e05a5a;border-color:#e05a5a}#syncDot.run{border-color:#9B7BFF;border-top-color:transparent;animation:knspin 1s linear infinite}
@keyframes knspin{to{transform:rotate(360deg)}}
.sy h4{margin:18px 0 6px;font-size:15px}.sy .li{display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #8882}.sy .li span{flex:1;min-width:0;overflow-wrap:anywhere}
.sy .li small{display:block;color:#888}.sy button.s{border:1px solid #8886;background:none;color:inherit;font:inherit;border-radius:999px;padding:4px 12px;cursor:pointer;white-space:nowrap}
.sy .bad{color:#e05a5a}
html.app-android #pane{inset:0;border-radius:0;border:none;max-width:none}
html.app-android #pane header{padding:10px 12px}
html.app-android #pbody{padding:12px}
`));
document.body.append(dot);
function setDot(s) { dot.className = s || (M && M.on ? (M.err ? 'err' : 'ok') : ''); }

// ---------- 備份 ----------
const BK = '知識網備份';
async function makeZip() { await V.ready; return Z.zip(V.list().sort().map(p => ({ path: '知識網資料/' + p, text: V.get(p) }))); }
async function saveZip(name, bytes, auto) {
  if (N) return auto ? N.io.autoBackup(name, bytes) : N.io.saveAs(name, bytes);
  await FS.writeFile({ path: `${BK}/${name}`, directory: 'DOCUMENTS', data: b64e(bytes), recursive: true });
  if (auto) { try { const r = await FS.readdir({ path: BK, directory: 'DOCUMENTS' }); const old = r.files.map(f => f.name).filter(n => n.startsWith('自動備份 ')).sort().reverse().slice(8); for (const n of old) await FS.deleteFile({ path: `${BK}/${n}`, directory: 'DOCUMENTS' }); } catch (e) {} }
  return `內部儲存空間／Documents／${BK}／${name}`;
}
async function autoBackup() {
  if (!M || !(N || FS) || Date.now() - (M.autoAt || 0) < 7 * 864e5 || !V.list().length) return;
  try { M.autoAt = Date.now(); saveM(); await saveZip(`自動備份 ${stamp()}.zip`, await makeZip(), true); } catch (e) { console.warn(e); M.autoErr = msg(e); M.autoAt = Date.now() - 6 * 864e5; saveM(); }
}
async function restoreZip(buf) {
  const all = await Z.unzip(new Uint8Array(buf)), top = /^(00-收件匣|02-知識|03-我的|04-知識網|05-衝突)\//;
  let n = 0, skip = 0;
  for (const f of all) {
    const p = f.path.replace(/^.*?(?=(00-收件匣|02-知識|03-我的|04-知識網|05-衝突)\/)/, '');
    if (!top.test(p) || p.split('/').some(s => s.startsWith('.') || s === '..')) { skip++; continue; }
    if (V.get(p) === f.text) continue;
    if (window.knHist && p.startsWith('02-知識/')) { const [d, nm] = await dirOf(p); await knHist(d, nm, f.text); }
    await V.put(p, f.text); n++;
  }
  return { n, skip, total: all.length };
}

// ---------- 畫面：同步與備份 ----------
window.knSyncPane = async function () {
  await V.ready;
  const trash = V.trash().slice(0, 40), cf = (M.conflicts || []).filter(c => V.get(c.path) != null);
  const devs = Object.values(M.devices || {});
  openPane('同步與備份', `<div class="sy">
   <h4>Google 雲端硬碟同步</h4>
   ${!P.can ? '<p class="note">這個預覽不能同步（要用 App）。</p>' : M.on ? `
    <p>已連接${M.email ? '：' + E(M.email) : ''}<br><span class="note">上次同步：${ago(M.last)}${M.err ? `　<span class="bad">上次沒成功：${E(M.err)}</span>` : ''}</span>
    ${devs.length ? `<br><span class="note">其他裝置：${devs.map(d => E(d.label) + '（' + ago(d.at) + '）').join('、')}</span>` : ''}</p>
    <div class="row"><button class="go" id="snow">現在同步</button><button class="go sub" id="soff">中斷連接</button></div>`
   : `<p>連接後，手機和電腦的知識網會自動同步。只能看到知識網自己建立的檔案，看不到你雲端硬碟裡的其他東西。</p>
    <div class="row"><button class="go" id="son">連接 Google 雲端硬碟</button></div>`}
   ${cf.length ? `<h4>兩台同時改過的（${cf.length}）</h4><p class="note">兩台裝置同時改了同一個檔、內容不一樣。時間新的那版已經放在原處，另一版在這裡，兩版都沒丟。</p>
    ${cf.map((c, i) => `<div class="li"><span>${E(c.path.split('/').pop())}<small>原本位置：${E(c.from)}</small></span><button class="s" data-cv="${i}">看</button><button class="s" data-cu="${i}">改用這版</button><button class="s" data-cd="${i}">不要了</button></div>`).join('')}` : ''}
   <h4>備份</h4>
   <p class="note">完整備份是一個 .zip，裡面就是 Markdown 資料夾，任何電腦解壓縮就能看，也能用 Obsidian 打開。每週會自動備份一次（留最近 8 份）${N ? '，放在「文件＼知識網備份」' : '，放在「內部儲存空間／Documents／知識網備份」'}。上次自動備份：${ago(M.autoAt)}${M.autoErr ? `　<span class="bad">${E(M.autoErr)}</span>` : ''}</p>
   <div class="row"><button class="go sub" id="bexp">匯出完整備份</button><button class="go sub" id="bimp">從備份還原</button>${N ? '<button class="go sub" id="bold">匯入舊的知識網資料夾</button><button class="go sub" id="bdir">打開資料所在的資料夾</button>' : ''}</div>
   <p class="note">還原＝把備份裡的檔案放回來；現在有的不會被刪掉，被蓋掉的內容在「紀錄與復原」救得回來。</p>
   <h4>回收桶（${trash.length}）</h4>
   ${trash.length ? trash.map((t, i) => `<div class="li"><span>${E(t.path.split('/').pop())}<small>${E(t.path)}・${ago(t.at)}${t.remote ? '・別台刪的' : ''}</small></span><button class="s" data-tr="${i}">救回</button></div>`).join('') : '<p class="note">沒有東西。刪掉的檔案會在這裡留 60 天。</p>'}
  </div>`);
  const $ = s => pbody.querySelector(s), again = () => window.knSyncPane();
  const busy = (b, fn) => async () => { b.disabled = true; const t = b.textContent; b.textContent = '處理中…'; try { await fn(); } catch (e) { toast('沒成功：' + msg(e), 8000); } b.disabled = false; b.textContent = t; };
  if ($('#son')) $('#son').onclick = busy($('#son'), async () => {
    await P.connect();
    const who = J(await call('GET', `${API}/about?fields=user(emailAddress)`));
    if (M.email && M.email !== who.user.emailAddress) { M.folder = null; M.mine = null; M.seen = {}; M.devices = {}; }
    M.on = true; M.email = who.user.emailAddress; M.err = ''; await saveM(true);
    await syncNow(true); again();
  });
  if ($('#snow')) $('#snow').onclick = busy($('#snow'), async () => { await syncNow(true); again(); });
  if ($('#soff')) $('#soff').onclick = busy($('#soff'), async () => { if (!confirm('中斷連接後就不會再同步（這台的資料不會刪除）。確定嗎？')) return; await P.signOut().catch(() => {}); M.on = false; await saveM(true); setDot(); again(); });
  pbody.querySelectorAll('[data-cv]').forEach(b => b.onclick = () => { const c = cf[+b.dataset.cv]; openPane('另一個版本', `<div class="row"><button class="go sub" id="cback">← 回同步與備份</button></div><div class="src full">${KN.mdHtml(V.get(c.path) || '')}</div>`); pbody.querySelector('#cback').onclick = again; });
  pbody.querySelectorAll('[data-cu]').forEach(b => b.onclick = busy(b, async () => { const c = cf[+b.dataset.cu]; const t = V.get(c.path); if (c.from.startsWith('02-知識/') && window.knHist) { const [d, n] = await dirOf(c.from); await knHist(d, n, t); } await V.put(c.from, t); await V.del(c.path); M.conflicts = M.conflicts.filter(x => x !== c); saveM(); await KN.load(true); toast('已改用這個版本'); again(); }));
  pbody.querySelectorAll('[data-cd]').forEach(b => b.onclick = busy(b, async () => { const c = cf[+b.dataset.cd]; await V.del(c.path); M.conflicts = M.conflicts.filter(x => x !== c); saveM(); toast('已移到回收桶'); again(); }));
  pbody.querySelectorAll('[data-tr]').forEach(b => b.onclick = busy(b, async () => {
    const t = trash[+b.dataset.tr]; if (V.get(t.path) != null && !confirm('原本的位置已經有同名的檔案，要用回收桶裡的版本蓋過去嗎？（現在的版本會進回收桶）')) return;
    if (window.knHist && t.path.startsWith('02-知識/')) { const [d, n] = await dirOf(t.path); await knHist(d, n, t.text); }
    await V.put(t.path, t.text); await V.raw.del(t.key); await KN.load(true); toast('已救回：' + t.path.split('/').pop()); again();
  }));
  $('#bexp').onclick = busy($('#bexp'), async () => { const where = await saveZip(`知識網備份 ${stamp()}.zip`, await makeZip(), false); if (where) toast('已存好備份：' + where, 8000); });
  $('#bimp').onclick = () => {
    const inp = h('input', { type: 'file', accept: '.zip,application/zip' });
    inp.onchange = busy($('#bimp'), async () => { const f = inp.files[0]; if (!f) return; const r = await restoreZip(await f.arrayBuffer()); await KN.load(true); toast(`還原完成：放回 ${r.n} 個檔案（備份裡共 ${r.total} 個）`, 8000); again(); });
    inp.click();
  };
  if ($('#bold')) $('#bold').onclick = busy($('#bold'), async () => {
    const L = await N.io.importFolder(); if (!L) return;
    let n = 0; for (const f of L) { if (V.get(f.path) === f.text) continue; await V.put(f.path, f.text); n++; }
    await KN.load(true); toast(n ? `已匯入 ${n} 個檔案` : '沒有新的東西要匯入（這個資料夾裡的東西都已經在了）', 8000); again();
  });
  if ($('#bdir')) $('#bdir').onclick = () => N.io.openDataDir();
};

// ---------- 開始 ----------
(async () => {
  await V.ready;
  let m = null; try { m = JSON.parse(V.raw.get(MF) || 'null'); } catch (e) {}
  M = Object.assign({ dev: Math.random().toString(36).slice(2, 8), label: window.KNAPP === 'win' ? 'Windows' : window.KNAPP === 'android' ? 'Android' : '預覽', clk: { ms: 0, c: 0 }, ver: {}, seen: {}, devices: {}, conflicts: [], gen: 0, on: false }, m || {});
  clk = C.clock(M.dev, M.clk);
  // 對帳：上次關掉後在別的程式改過、或還沒有版本的檔案，當成這台的修改
  for (const p of V.list()) { if (!syncable(p)) continue; const t = V.get(p), L = M.ver[p]; if (!L || L.del || L.k !== C.hash(t)) bumpLocal(p, t); }
  for (const [p, L] of Object.entries(M.ver)) if (!L.del && V.get(p) == null && syncable(p)) bumpLocal(p, null);
  await saveM(true);
  V.onChange((op, p, text, remote) => { if (remote || !syncable(p)) return; bumpLocal(p, op === 'del' ? null : text); saveM(); if (M.on) later(); });
  setDot();
  if (M.on) setTimeout(() => syncNow(), 1500);
  setTimeout(autoBackup, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (M.on && M.dirty) syncNow(); saveM(true); }
    else if (M.on && Date.now() - (M.last || 0) > 60000) syncNow();
  });
  setInterval(() => { if (!document.hidden && M.on) syncNow(); }, 5 * 60000);
  // Windows：回到知識網時，讀進在別的程式（例如 Obsidian）做的修改
  if (N) window.addEventListener('focus', async () => { try { const ch = await V.rescan(); if (ch.length) refresh(ch.length); } catch (e) { console.warn(e); } });
  // Android：返回鍵先關面板、卡片，最後才縮小 App
  const A = window.KNAPP === 'android' && Capacitor.Plugins.App;
  if (A) A.addListener('backButton', () => {
    const card = document.getElementById('card');
    if (!KN.pane.hidden) KN.closePane(); else if (card && !card.hidden) card.hidden = true; else A.minimizeApp();
  });
})();
})();
