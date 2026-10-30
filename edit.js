// 自由編輯（第二、三批，06 第 21 輪）：編輯台＝自訂區＋知識內容區
// 自訂：檢視（存成檢視、復原、重做、恢復預設）、篩選、點旁文字、卡片內容、線樣式、關聯類型、拆點粗細與 AI 指示、
//       打開時先看到什麼、介面與字大小、動態強弱、快捷鍵。知識內容：刪改歷史、一鍵復原、卡片裡編輯／刪除知識點。
(() => {
const KN = window.KN, { h, toast, qtip, openPane, pbody } = KN;
const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const BASE_TYPES = KN.RTYPES.slice();
const TCOL = ['#9AA3AE', '#FFB020', '#FF8FB1', '#5FE0C1', '#6EA8FF', '#C9A2FF', '#F7A072', '#B5E36B'];
const KEYS = { home: '全貌', add: '丟東西進去', new: '＋ 知識點', qa: '問答', recent: '最近消化', ed: '編輯台', mode: '切換星空／簡約', close: '關閉面板和卡片' };
const EDDEF = {
  filter: { tops: [], src: '', days: 0, priv: 'all', q: '' }, label: 'name',
  card: { tabs: { desc: true, src: true, rel: true, mine: true }, first: 'desc', why: true, meta: true },
  line: { w: 1, a: 1, dash: 'solid', byType: false }, types: [], tcol: {}, thide: {},
  grain: 'mid', aiNote: '', open: 'home', ui: 1, fs: 1, dyn: 'mid',
  keys: { home: 'h', add: 'a', new: 'n', qa: 'q', recent: 'r', ed: 'e', mode: 'm', close: 'escape' } };
const ED = {};
function setED(o) {
  Object.keys(ED).forEach(k => delete ED[k]); Object.assign(ED, clone(EDDEF), o || {});
  ['filter', 'card', 'line', 'keys'].forEach(k => ED[k] = Object.assign(clone(EDDEF[k]), ED[k]));
  ED.card.tabs = Object.assign(clone(EDDEF.card.tabs), ED.card.tabs);
}
setED(store.get('ed', {}));
const saveED = () => store.set('ed', ED);

// ---------- 套用設定 ----------
const uiStyle = h('style'); document.head.append(uiStyle);
const tcolOf = t => ED.tcol[t] || TCOL[Math.max(0, KN.RTYPES.indexOf(t)) % TCOL.length];
function applyED() {
  KN.RTYPES.splice(0, KN.RTYPES.length, ...BASE_TYPES, ...ED.types.filter(t => !BASE_TYPES.includes(t)));
  KNX.label = { none: () => '', sub: p => p.name + '・' + ((TP[p.t].subs[p.sub] || {}).name || ''), desc: p => (p.desc || p.name).slice(0, 14) }[ED.label] || (p => p.name);
  KNX.fs = ED.fs; KNX.lw = ED.line.w; KNX.la = ED.line.a; KNX.dash = { dash: [6, 4], dot: [1.5, 3] }[ED.line.dash] || [];
  KNX.lineCol = ED.line.byType ? r => `rgba(${rgbOf(tcolOf(r.type || '有關'))},.75)` : null;
  [KNX.dmp, KNX.ms] = { weak: [.45, 1400], strong: [.72, 700] }[ED.dyn] || [.6, 1000];
  uiStyle.textContent = ED.ui !== 1 ? `#ui,#zoom,#card,#tip,#linePanel,#pane,#toast{zoom:${ED.ui}}` : '';
  dirty = true;
}

// ---------- 篩選＋關聯類型（包住 build）----------
const filterOn = () => { const f = ED.filter; return f.tops.length || f.src || f.days || f.priv !== 'all' || f.q; };
function okPoint(p, tmap) {
  const f = ED.filter, t = tmap[p.topic], top = t ? (t.parent || t.id) : '';
  if (f.tops.length && !f.tops.includes(top)) return false;
  if (f.src && !(p.src || []).includes(f.src)) return false;
  if ((f.priv === 'hide' && p.priv) || (f.priv === 'only' && !p.priv)) return false;
  if (f.days) { const s = K.sources.find(x => x.id === (p.src || [])[0]); if (!s || Date.now() - Date.parse(s.date) > f.days * 864e5) return false; }
  if (f.q && !(p.name + ' ' + (p.desc || '')).toLowerCase().includes(f.q.toLowerCase())) return false;
  return true;
}
const _build = build;
build = function () {
  let keep = null;
  if (filterOn()) {
    const tmap = {}; K.topics.forEach(t => tmap[t.id] = t);
    const pts = K.points.filter(p => okPoint(p, tmap));
    if (pts.length) {
      keep = [K.points, K.topics]; const used = new Set(pts.map(p => p.topic)), tops = new Set([...used].map(id => tmap[id] && tmap[id].parent).filter(Boolean));
      K.points = pts; K.topics = K.topics.filter(t => t.parent ? used.has(t.id) : tops.has(t.id));
    } else toast('篩選後沒有知識點，先顯示全部');
  }
  try { _build(); } finally { if (keep) [K.points, K.topics] = keep; }
  const tm = {}; K.links.forEach(l => tm[l.a + '~' + l.b] = tm[l.b + '~' + l.a] = l.type || '有關');
  for (const id in adj) adj[id] = adj[id].filter(r => { r.type = tm[id + '~' + r.p.id] || '有關'; return !ED.thide[r.type]; });
};
function rebuild() { view.sel = null; hover = null; tip.style.display = 'none'; card.hidden = true; build(); ui(); enterMode(); }

// ---------- 卡片：顯示哪些分頁和內容、編輯／刪除知識點 ----------
const _oc = window.openCard;
window.openCard = openCard = function (p, tab) {
  const C = ED.card, vis = ['desc', 'src', 'rel', 'mine'].filter(t => C.tabs[t]);
  if (!vis.length) vis.push('desc');
  if (!tab || !vis.includes(tab)) tab = vis.includes(C.first) ? C.first : vis[0];
  _oc(p, tab);
  document.querySelectorAll('#ctabs button').forEach(b => b.hidden = !vis.includes(b.dataset.t));
  if (tab !== 'desc') return;
  const B = document.getElementById('cbody');
  if (!C.why) { const h4 = B.querySelector('h4'); if (h4) { const nx = h4.nextElementSibling; h4.remove(); if (nx && nx.tagName === 'P') nx.remove(); } }
  if (!C.meta) B.querySelectorAll('.meta').forEach(e => e.remove());
  if (!p.demo && p._path && KN.root) { const b = h('button', { className: 'c', textContent: '✎ 編輯' }); b.style.marginTop = '8px'; b.onclick = () => editForm(p); B.append(b); }
};
const readF = async (dh, fn) => (await (await dh.getFileHandle(fn)).getFile()).text();
function editForm(p) {
  const B = document.getElementById('cbody'), sub = K.topics.find(t => t.id === p.topic) || {};
  B.innerHTML = `<div class="frm"><label>名稱<input type="text" id="en" value="${E(p.name)}"></label>
   <div class="two"><label>主題<input type="text" id="et" value="${E(sub.parent || '')}"></label><label>子主題<input type="text" id="es" value="${E(sub.name || '')}"></label></div>
   <label>說明<textarea id="edd" rows="4">${E(p.desc)}</textarea></label><label>為什麼拆成這個點<textarea id="ew" rows="2">${E(p.why)}</textarea></label>
   <label><input type="checkbox" id="ep"${p.priv ? ' checked' : ''}> 私人</label></div>
   <div class="row"><button class="go" id="eok">存</button><button class="go sub" id="eno">取消</button><button class="go sub" id="edel">刪除這個點</button></div>`;
  const [dn, fn] = p._path.split('/'), dir = async () => (await KN.root.getDirectoryHandle('02-知識')).getDirectoryHandle(dn), g = id => B.querySelector(id).value.trim();
  B.querySelector('#eno').onclick = () => openCard(p, 'desc');
  B.querySelector('#eok').onclick = async () => {
    if (!g('#en')) { toast('請填名稱'); return; }
    const dh = await dir(); let t = (await readF(dh, fn)).replace(/\r\n/g, '\n');
    const m = t.match(/^---\n[\s\S]*?\n---\n?/); let head = m ? m[0] : '---\n---\n', body = m ? t.slice(m[0].length) : t;
    const setF = (k, v) => { const re = new RegExp('^' + k + ':.*$', 'm'), line = k + ': ' + JSON.stringify(v); head = re.test(head) ? head.replace(re, () => line) : head.replace(/\n---\n?$/, () => '\n' + line + '\n---\n'); };
    setF('主題', g('#et') || '未分類'); setF('子主題', g('#es') || '其他'); setF('私人', B.querySelector('#ep').checked);
    const nm = body.match(/^#\s+.*$/m);
    if (nm) { const rest = body.slice(nm.index + nm[0].length), j = rest.search(/\n##\s/); body = body.slice(0, nm.index) + '# ' + g('#en') + '\n\n' + g('#edd') + '\n' + (j >= 0 ? rest.slice(j) : '\n'); }
    else body = '# ' + g('#en') + '\n\n' + g('#edd') + '\n' + body;
    const why = g('#ew');
    if (/\n## 為什麼拆成這個點\n/.test(body)) body = body.replace(/(\n## 為什麼拆成這個點\n)[\s\S]*?(?=\n## |$)/, (x, a) => a + why + '\n');
    else if (why) body = body.replace(/\s*$/, '\n') + '\n## 為什麼拆成這個點\n' + why + '\n';
    await KN.writeFile(dh, fn, head + body);
    const id = p.id; await KN.load(true); if (byId[id]) openCard(byId[id], 'desc'); toast('已存好');
  };
  const del = B.querySelector('#edel');
  del.onclick = async () => {
    if (!del.dataset.sure) { del.dataset.sure = 1; del.textContent = '確定刪除？再按一次'; return; }
    const dh = await dir(); await hist(['02-知識', dn], fn, await readF(dh, fn), null); await dh.removeEntry(fn);
    card.hidden = true; await KN.load(true); toast('已刪除，可以在編輯台「知識內容」復原', 5000);
  };
}

// ---------- 知識內容：刪改歷史（存在瀏覽器）----------
const hdb = new Promise((res, rej) => { const o = indexedDB.open('kn-hist', 1); o.onupgradeneeded = () => o.result.createObjectStore('h', { autoIncrement: true }); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
const hst = (mode, fn) => hdb.then(d => new Promise((res, rej) => { const t = d.transaction('h', mode), r = fn(t.objectStore('h')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
async function hist(path, name, old, now) {
  await hst('readwrite', s => s.add({ t: Date.now(), path, name, old, now }));
  const keys = await hst('readonly', s => s.getAllKeys()); if (keys.length > 400) await hst('readwrite', s => s.delete(IDBKeyRange.upperBound(keys[keys.length - 401])));
}
window.knHist = async (dir, name, text) => {   // folder.js 的 writeFile 每次寫檔前呼叫
  try {
    const r = KN.root; if (!r) return; const path = await r.resolve(dir); if (!path || path[0] !== '02-知識') return;
    let old = null; try { old = await readF(dir, name); } catch (e) {}
    if (old !== text) await hist(path, name, old, text);
  } catch (e) { console.warn(e); }
};
async function groups() {
  const all = await hst('readonly', s => s.getAll()), G = [];
  for (let i = all.length - 1; i >= 0; i--) { const r = all[i], g = G[G.length - 1];
    if (g && g.path.join('/') === r.path.join('/') && g.t - r.t < 5000) { g.list.push(r); g.t = r.t; } else G.push({ t: r.t, path: r.path, list: [r] }); }
  return G.slice(0, 80);
}
async function restore(g) {
  let d = KN.root; for (const seg of g.path) d = await d.getDirectoryHandle(seg, { create: true });
  for (const r of g.list) {   // 由新到舊，一個一個倒回去
    if (r.old == null) { try { await hist(r.path, r.name, await readF(d, r.name), null); await d.removeEntry(r.name); } catch (e) {} }
    else await KN.writeFile(d, r.name, r.old);
  }
  let empty = true; for await (const x of d.keys()) { empty = false; break; }
  if (empty && g.path.length > 1) { let par = KN.root; for (const seg of g.path.slice(0, -1)) par = await par.getDirectoryHandle(seg); try { await par.removeEntry(g.path[g.path.length - 1]); } catch (e) {} }
  await KN.load(true); toast('已復原');
}
const tstr = t => { const d = new Date(t), z = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${z(d.getHours())}:${z(d.getMinutes())}`; };
const actOf = l => l.every(r => r.old == null) ? '新增' : l.every(r => r.now == null) ? '刪除' : '修改';

// ---------- 復原／重做（自訂設定）、檢視 ----------
const UNDO = [], REDO = []; let last = '', applying = false, tmr = 0;
const snap = () => JSON.stringify({ st, ed: ED });
const _set = store.set.bind(store);
store.set = (k, v) => { _set(k, v); if ((k === 'settings' || k === 'ed') && !applying) { clearTimeout(tmr); tmr = setTimeout(pushUndo, 300); } };
function pushUndo() { const s = snap(); if (s === last) return; if (last) { UNDO.push(last); if (UNDO.length > 100) UNDO.shift(); } REDO.length = 0; last = s; }
function applyState(s) {
  applying = true; const o = JSON.parse(s);
  Object.keys(st).forEach(k => delete st[k]); Object.assign(st, o.st); setED(o.ed); save(); saveED();
  applying = false; last = snap(); applyED(); rebuild(); if (isEd()) edPane();
}
const isEd = () => !document.getElementById('pane').hidden && document.getElementById('ptitle').textContent === '編輯台';

// ---------- 快捷鍵 ----------
const clickFbar = t => { const b = [...document.querySelectorAll('#fbar .c')].find(b => b.textContent === t); if (b) b.click(); };
const ACT = { home: () => document.getElementById('home').click(), add: () => document.getElementById('addBtn').click(), new: () => document.getElementById('newBtn').click(),
  qa: () => clickFbar('問答'), recent: () => clickFbar('最近消化'), ed: () => edPane(), mode: () => { const b = document.querySelector('#gMode .c:not(.on)'); if (b) b.click(); },
  close: () => { KN.closePane(); card.hidden = true; linePanel.hidden = true; } };
const keyName = k => ({ escape: 'Esc', ' ': '空白鍵', '': '（沒有）' }[k] || k.toUpperCase());
let capture = null;
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (capture) { e.preventDefault(); const a = capture; capture = null; const v = k === 'backspace' ? '' : k;
    Object.keys(ED.keys).forEach(x => { if (x !== a && ED.keys[x] === v) ED.keys[x] = ''; }); ED.keys[a] = v; saveED(); if (isEd()) edPane(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]') && k !== 'escape') return;
  const a = Object.keys(ED.keys).find(x => ED.keys[x] && ED.keys[x] === k); if (!a) return;
  e.preventDefault(); ACT[a]();
});

// ---------- 打開時先看到什麼 ----------
addEventListener('pagehide', () => _set('lastView', { mode: st.mode, z: view.z, cx: view.cx, cy: view.cy }));
(() => { const t0 = Date.now(); const go = () => {
  if (!KN.root && Date.now() - t0 < 4000) return setTimeout(go, 300);
  setTimeout(() => { const o = ED.open;
    if (o === 'last') { const v = store.get('lastView', null); if (v && v.mode === st.mode) anim(v.z, v.cx, v.cy); }
    else if (o === 'qa' || o === 'recent') ACT[o]();
    else if (o.startsWith('topic:')) { const T = TP.find(T => T.id === o.slice(6)); if (T) flyTopic(T); } }, 900); };
  go(); })();

// ---------- 給 AI 的拆點指示（folder.js step2 呼叫）----------
window.knPromptExtra = p => {
  const add = [{ coarse: '拆得粗一點：只拆最重要的大重點，數量少。', fine: '拆得細一點：小重點也拆出來，數量多。' }[ED.grain], ED.aiNote.trim()].filter(Boolean).join('\n');
  return add ? p.replace('\n\nJSON 格式：', `\n6. 另外要求：${add}\n\nJSON 格式：`) : p;
};

// ---------- 編輯台 ----------
const edBtn = h('button', { className: 'c', textContent: '編輯台' }); document.getElementById('fbar').append(edBtn); edBtn.onclick = () => edPane();
document.head.append(h('style', {}, `.edp details{border:1px solid #8885;border-radius:8px;margin:8px 0;padding:4px 10px}.edp summary{cursor:pointer;font-weight:bold;padding:2px 0}
.edp label{display:inline-flex;align-items:center;gap:4px;margin:4px 10px 4px 0}.edp .tr{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:3px 0}.edp .tr>b{min-width:5em;font-weight:normal;opacity:.8}
.edp textarea,.edp input[type=text]{background:transparent;color:inherit;border:1px solid #8886;border-radius:6px;padding:3px 6px;font:inherit}.edp textarea{width:100%;box-sizing:border-box}
.edp select{font:inherit}.hrow{display:flex;gap:8px;align-items:center;border-bottom:1px solid #8883;padding:5px 0}.hrow .l{flex:1;overflow-wrap:anywhere}`));
let edTab = 'custom'; const openSec = new Set(['view']);
const sel = (k, cur, opts) => `<select data-e="${k}">${opts.map(([v, t]) => `<option value="${E(v)}"${String(v) === String(cur) ? ' selected' : ''}>${E(t)}</option>`).join('')}</select>`;
const rng = (k, cur, a, b, s) => `<input type="range" data-e="${k}" min="${a}" max="${b}" step="${s}" value="${cur}"><span class="note">${Math.round(cur * 100)}%</span>`;
const ck = (k, on, t) => `<label><input type="checkbox" data-e="${k}"${on ? ' checked' : ''}>${t}</label>`;
const sec = (id, title, html) => `<details data-sec="${id}"${openSec.has(id) ? ' open' : ''}><summary>${title}</summary>${html}</details>`;
async function edPane() {
  const tabs = `<div class="row"><button class="c${edTab === 'custom' ? ' on' : ''}" data-et="custom">自訂</button><button class="c${edTab === 'hist' ? ' on' : ''}" data-et="hist">知識內容</button></div>`;
  if (edTab === 'hist') {
    const G = KN.root ? await groups() : [];
    openPane('編輯台', `<div class="edp">${tabs}${!KN.root ? '<p>還沒連上資料夾。</p>' : !G.length ? '<p>還沒有改過知識內容。</p>' :
      '<div class="row"><button class="go" data-r="0">復原最近一次</button></div>' + G.map((g, i) => `<div class="hrow"><span class="note">${tstr(g.t)}</span><span>${actOf(g.list)}</span><span class="l">${E(g.path.slice(1).join('/') || g.path[0])}${g.list.length > 1 ? `（${g.list.length} 個檔）` : '／' + E(g.list[0].name.replace(/\.md$/, ''))}</span><button class="c" data-r="${i}">復原</button></div>`).join('')}</div>`);
    pbody.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => { b.disabled = true; await restore(G[+b.dataset.r]); edPane(); });
  } else {
    const f = ED.filter, tops = K.topics.filter(t => !t.parent), srcs = K.sources.filter(s => !s.demo), views = store.get('views', []);
    openPane('編輯台', `<div class="edp">${tabs}
    <div class="row"><button class="c" id="eun">↶ 復原</button><button class="c" id="ere">↷ 重做</button><button class="c" id="edef">恢復預設</button></div>
    ${sec('view', '檢視', `<div class="tr"><input type="text" id="vname" placeholder="名稱" style="flex:1;min-width:0"><button class="c" id="vsave">存成檢視</button>${qtip('把現在的顯示、篩選、卡片、線的設定存起來，之後一鍵切換。')}</div>` +
      views.map((v, i) => `<div class="tr"><span style="flex:1">${E(v.name)}</span><button class="c" data-va="${i}">套用</button><button class="c" data-vx="${i}">×</button></div>`).join(''))}
    ${sec('filter', '篩選', `<div class="tr"><b>主題</b>${tops.map(t => `<label><input type="checkbox" data-top="${E(t.id)}"${f.tops.includes(t.id) ? ' checked' : ''}>${E(t.name)}</label>`).join('')}</div>
      <div class="tr"><b>來源</b>${sel('filter.src', f.src, [['', '全部'], ...srcs.map(s => [s.id, s.date + ' ' + s.title])])}</div>
      <div class="tr"><b>時間</b>${sel('filter.days', f.days, [[0, '全部'], [7, '最近 7 天'], [30, '最近 30 天'], [90, '最近 90 天']])}<b>私人</b>${sel('filter.priv', f.priv, [['all', '都顯示'], ['hide', '不顯示私人'], ['only', '只看私人']])}</div>
      <div class="tr"><b>關鍵字</b><input type="text" data-e="filter.q" value="${E(f.q)}" style="flex:1;min-width:0"><button class="c" id="fclr">清除篩選</button></div>`)}
    ${sec('net', '知識網', `<div class="tr"><b>點旁邊的字</b>${sel('label', ED.label, [['name', '名稱'], ['sub', '名稱＋子主題'], ['desc', '說明開頭'], ['none', '不顯示']])}${qtip('簡約模式放大後，點旁邊顯示的字。')}</div>
      <div class="tr"><b>字的大小</b>${rng('fs', ED.fs, .8, 2, .1)}</div>
      <div class="tr"><b>動態</b>${sel('dyn', ED.dyn, [['weak', '弱'], ['mid', '中'], ['strong', '強']])}${qtip('拖曳、飛過去時的彈性和速度。')}</div>
      <div class="tr"><b>打開時先看</b>${sel('open', ED.open, [['home', '全貌'], ['last', '上次看的位置'], ['qa', '問答'], ['recent', '最近消化'], ...tops.map(t => ['topic:' + t.id, '主題：' + t.name])])}</div>`)}
    ${sec('card', '卡片', `<div class="tr"><b>分頁</b>${ck('card.tabs.desc', ED.card.tabs.desc, '說明')}${ck('card.tabs.src', ED.card.tabs.src, '來源')}${ck('card.tabs.rel', ED.card.tabs.rel, '關聯')}${ck('card.tabs.mine', ED.card.tabs.mine, '我的想法')}</div>
      <div class="tr"><b>先打開</b>${sel('card.first', ED.card.first, [['desc', '說明'], ['src', '來源'], ['rel', '關聯'], ['mine', '我的想法']])}</div>
      <div class="tr"><b>說明分頁</b>${ck('card.why', ED.card.why, '為什麼拆成這個點')}${ck('card.meta', ED.card.meta, '來源數和拆點方式')}</div>`)}
    ${sec('line', '線和關聯類型', `<div class="tr"><b>粗細</b>${rng('line.w', ED.line.w, .5, 3, .1)}</div><div class="tr"><b>濃淡</b>${rng('line.a', ED.line.a, .3, 2, .1)}</div>
      <div class="tr"><b>樣式</b>${sel('line.dash', ED.line.dash, [['solid', '實線'], ['dash', '虛線'], ['dot', '點線']])}${ck('line.byType', ED.line.byType, '依類型上色')}</div>
      ${KN.RTYPES.map(t => `<div class="tr"><input type="color" data-tc="${E(t)}" value="${tcolOf(t)}"><span style="flex:1">${E(t)}</span><label><input type="checkbox" data-th="${E(t)}"${ED.thide[t] ? '' : ' checked'}>顯示</label>${BASE_TYPES.includes(t) ? '' : `<button class="c" data-tx="${E(t)}">×</button>`}</div>`).join('')}
      <div class="tr"><input type="text" id="tnew" placeholder="新的關聯類型" style="flex:1;min-width:0"><button class="c" id="tadd">加</button></div>`)}
    ${sec('ai', '拆點', `<div class="tr"><b>粗細</b>${sel('grain', ED.grain, [['coarse', '粗（點少）'], ['mid', '中'], ['fine', '細（點多）']])}${qtip('交給 AI 拆的時候，要拆得多細。')}</div>
      <div class="tr" style="display:block"><b>給 AI 的補充指示</b><textarea data-e="aiNote" rows="3">${E(ED.aiNote)}</textarea></div>`)}
    ${sec('ui', '介面', `<div class="tr"><b>介面大小</b>${rng('ui', ED.ui, .8, 1.4, .05)}</div>` +
      Object.keys(KEYS).map(a => `<div class="tr"><b>${KEYS[a]}</b><button class="c" data-key="${a}">${capture === a ? '按一個鍵…' : keyName(ED.keys[a] || '')}</button></div>`).join('') + `<p class="note">快捷鍵：按右邊的鈕，再按想用的鍵；Backspace 清除。</p>`)}
    </div>`);
    const P = pbody;
    P.querySelectorAll('details').forEach(d => d.ontoggle = () => d.open ? openSec.add(d.dataset.sec) : openSec.delete(d.dataset.sec));
    P.querySelector('#eun').onclick = () => { clearTimeout(tmr); pushUndo(); if (!UNDO.length) return toast('沒有可以復原的'); REDO.push(snap()); applyState(UNDO.pop()); };
    P.querySelector('#ere').onclick = () => { if (!REDO.length) return toast('沒有可以重做的'); UNDO.push(snap()); applyState(REDO.pop()); };
    P.querySelector('#edef').onclick = () => { pushUndo(); UNDO.push(snap()); REDO.length = 0; applyState(JSON.stringify({ st: clone(DEF), ed: clone(EDDEF) })); toast('已恢復預設（可以按「復原」回去）'); };
    P.querySelector('#vsave').onclick = () => { const n = P.querySelector('#vname').value.trim() || '檢視 ' + (views.length + 1); views.push({ name: n, st: clone(st), ed: clone(ED) }); _set('views', views); edPane(); toast('已存成檢視：' + n); };
    P.querySelectorAll('[data-va]').forEach(b => b.onclick = () => { const v = views[+b.dataset.va]; pushUndo(); UNDO.push(snap()); REDO.length = 0; applyState(JSON.stringify({ st: v.st, ed: v.ed })); toast('已套用：' + v.name); });
    P.querySelectorAll('[data-vx]').forEach(b => b.onclick = () => { views.splice(+b.dataset.vx, 1); _set('views', views); edPane(); });
    const after = k => { saveED(); applyED(); if (/^(filter|thide)/.test(k)) rebuild(); else if (/^card/.test(k) && !card.hidden && curP) openCard(curP); };
    P.querySelectorAll('[data-e]').forEach(el => {
      const k = el.dataset.e, set = () => { const ks = k.split('.'); let o = ED; ks.slice(0, -1).forEach(x => o = o[x]);
        o[ks[ks.length - 1]] = el.type === 'checkbox' ? el.checked : el.type === 'range' || k === 'filter.days' ? parseFloat(el.value) : el.value.trim();
        if (el.type === 'range') el.nextElementSibling.textContent = Math.round(el.value * 100) + '%'; after(k); };
      if (el.type === 'range') el.oninput = set; else el.onchange = set;
    });
    P.querySelectorAll('[data-top]').forEach(el => el.onchange = () => { ED.filter.tops = [...P.querySelectorAll('[data-top]:checked')].map(x => x.dataset.top); after('filter'); });
    P.querySelector('#fclr').onclick = () => { ED.filter = clone(EDDEF.filter); after('filter'); edPane(); };
    P.querySelectorAll('[data-tc]').forEach(el => el.oninput = () => { ED.tcol[el.dataset.tc] = el.value; after('tcol'); });
    P.querySelectorAll('[data-th]').forEach(el => el.onchange = () => { if (el.checked) delete ED.thide[el.dataset.th]; else ED.thide[el.dataset.th] = true; after('thide'); });
    P.querySelectorAll('[data-tx]').forEach(el => el.onclick = () => { const t = el.dataset.tx; ED.types = ED.types.filter(x => x !== t); delete ED.thide[t]; delete ED.tcol[t]; after('thide'); edPane(); });
    P.querySelector('#tadd').onclick = () => { const t = P.querySelector('#tnew').value.trim(); if (!t || KN.RTYPES.includes(t)) return; ED.types.push(t); after('types'); edPane(); };
    P.querySelectorAll('[data-key]').forEach(b => b.onclick = () => { capture = b.dataset.key; b.textContent = '按一個鍵…'; });
  }
  pbody.querySelectorAll('[data-et]').forEach(b => b.onclick = () => { edTab = b.dataset.et; edPane(); });
}

applyED(); build(); ui(); last = snap();
})();
