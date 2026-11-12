// 介面（11/7 改版，06 第 31～36 輪、15 施工單段 2～5）：
// 左上「丟東西進去」「問答」；右上「回顧 ▾」「整理 ▾」「外觀」「設定 ▾」（可拖曳整理）；
// 外觀面板（配色、單項顏色、新點、說明、框和字、介面深／淺）；說明＝固定大小的框，出現在功能右側（右側面板則在面板左側）。
(() => {
const KN = window.KN, { h, toast, openPane, pbody, pane } = KN;
const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const clk = id => { const b = document.getElementById(id); if (b) b.click(); };
const fb = t => { const b = [...document.querySelectorAll('#fbar .c')].find(b => b.textContent === t); if (b) b.click(); };
const lasso = () => [...document.querySelectorAll('#zoom .c')].find(b => b.textContent === '圈選');

// ---------- 功能清單（名稱、說明、做什麼）----------
const ITEMS = {
  add: ['丟東西進去', '', () => clk('addBtn')],
  qa: ['問答', '', () => fb('問答')],
  recent: ['最近消化', '最近放進知識網的來源，可以補看拆解和理由', () => fb('最近消化')],
  grow: ['每月成長', '', () => window.knReview && knReview('grow')],
  tour: ['導覽', '選一個主題，一站一站帶你看，最後告訴你還缺什麼', () => window.knReview && knReview('tour')],
  tm: ['時光機', '看以前某一天的知識網，也能跟現在比', () => window.knReview && knReview('tm')],
  lasso: ['圈選整理', '框住一群點，AI 建議合併、搬主題、加關聯，勾了才套用', () => { const b = lasso(); if (b) b.click(); }],
  hist: ['紀錄與復原', '刪掉、改掉、合併的知識點，都能從這裡救回', () => window.knHistPane && knHistPane()],
  look: ['外觀', '', () => lookPane()],
  ed: ['編輯台', '知識網顯示什麼、卡片顯示什麼、快捷鍵、AI 怎麼拆', () => window.knEd && knEd('custom')],
  ai: ['AI 設定', '', () => { const b = document.querySelector('#aiBar button'); if (b) b.click(); }],
  folder: [window.KNAPP ? '同步與備份' : '連上資料夾', window.KNAPP ? 'Google 雲端硬碟同步、備份與還原、回收桶' : '', () => clk('folderBtn')],
  menu: ['整理選單', '拖曳來排選單、選哪些露出在左上', () => editMode()] };
if (window.knTopics) ITEMS.topics = ['主題整理', '主題、子主題改名、搬到別的主題底下、合併', () => knTopics()];
const DEFM = { groups: [{ name: '回顧', items: ['recent', 'grow', 'tour', 'tm'] }, { name: '整理', items: ['lasso', 'hist', ...(ITEMS.topics ? ['topics'] : [])] },
  { name: '外觀', items: ['look'] }, { name: '設定', items: ['ed', 'ai', 'folder', 'menu'] }], pins: ['add', 'qa'] };
let M = store.get('menu2', null) || clone(DEFM);
const fix = () => { M.groups.forEach(g => g.items = g.items.filter(i => ITEMS[i])); M.pins = M.pins.filter(i => ITEMS[i]);
  const seen = new Set([...M.groups.flatMap(g => g.items), ...M.pins]);
  Object.keys(ITEMS).forEach(i => { if (!seen.has(i)) M.groups[M.groups.length - 1].items.push(i); }); };
fix();
const saveM = () => store.set('menu2', M);

// ---------- 配色 ----------
const DARK = { ui: '#14161b', tx: '#e6e8ec', btn: '#1f232b', bd: '#2e333d' }, LIGHT = { ui: '#ffffff', tx: '#23262b', btn: '#f2f3f5', bd: '#d9dce1' };
const PRE = {
  '深夜': { d: DARK, l: LIGHT, net: '#000000', dot: '#c9ccd1', line: '#ffffff', lab: '#dddddd', sel: '#9b7bff', newc: '#7cf0b8', ring: '#5fe0a0', ui: 'dark' },
  '白紙': { d: DARK, l: LIGHT, net: '#f7f8fa', dot: '#45484e', line: '#232830', lab: '#45484e', sel: '#5b5bd6', newc: '#1fae6a', ring: '#1fae6a', ui: 'light' },
  '霧藍': { d: { ui: '#1b2330', tx: '#dfe7f2', btn: '#243044', bd: '#34445e' }, l: { ui: '#f3f6fa', tx: '#1f2a3a', btn: '#e4ebf4', bd: '#c5d2e3' }, net: '#0f1622', dot: '#9fb7d9', line: '#9fb7d9', lab: '#cfdcef', sel: '#8fb8ff', newc: '#6ee7b7', ring: '#6ee7b7', ui: 'dark' },
  '石墨綠': { d: { ui: '#16201d', tx: '#e2ece7', btn: '#1e2b27', bd: '#2f433c' }, l: { ui: '#f3f7f5', tx: '#1d2a25', btn: '#e3ece8', bd: '#c4d6ce' }, net: '#0c1412', dot: '#a9cbbd', line: '#a9cbbd', lab: '#d6e6de', sel: '#f0c96b', newc: '#f0c96b', ring: '#f0c96b', ui: 'dark' } };
const UIC = { ui: '介面底色', tx: '介面文字', btn: '按鈕底色', bd: '框線顏色' };
const NETC = { net: ['知識網底色', '簡約模式的底色（壯麗星空固定是黑色）'], dot: ['點的顏色', '知識點的顏色（點色方式選「素色」時）'], line: ['線的顏色', ''], lab: ['知識網的字', '主題、子主題、知識點名稱的顏色'], sel: ['選到時的顏色', '滑過或點到一個知識點時，它和它的線的顏色'] };
const old2 = store.get('look2', {});
const LOOK = Object.assign({ name: '深夜', t: clone(PRE['深夜']), mine: null, ui: old2.ui || 'dark', ringOn: true, help: { size: 12, fg: '', bg: '', op: 92 }, bw: 1, r: 10, ff: old2.ff || 'system-ui' }, store.get('look3', {}));
const saveLook = () => { store.set('look3', LOOK); applyLook(); };
const lum = h => { const n = parseInt(h.slice(1, 7), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
const rgba = (h, o) => { const n = parseInt(h.slice(1, 7), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${o / 100})`; };
const U = () => LOOK.t[LOOK.ui === 'light' ? 'l' : 'd'];
function applyLook() {
  const T = LOOK.t, u = U(), r = document.documentElement, set = (k, v) => r.style.setProperty(k, v);
  r.classList.add('kt'); r.classList.toggle('uil', LOOK.ui === 'light');
  set('--k-ui', u.ui); set('--k-tx', u.tx); set('--k-btn', u.btn); set('--k-bd', u.bd); set('--k-sel', T.sel);
  set('--k-bw', LOOK.bw + 'px'); set('--k-r', LOOK.r + 'px'); set('--k-ff', LOOK.ff);
  set('--h-size', LOOK.help.size + 'px'); set('--h-fg', LOOK.help.fg || u.tx); set('--h-bg', rgba(LOOK.help.bg || u.btn, LOOK.help.op));
  r.style.colorScheme = lum(u.ui) > .5 ? 'light' : 'dark';
  KNX.net = T.net; st.bg = lum(T.net) > .5 ? 'light' : 'dark'; KNX.dot = T.dot; KNX.lc = T.line; KNX.sel = T.sel; KNX.fc = T.lab;
  KNX.newc = T.newc; KNX.ring = T.ring; KNX.ringOn = LOOK.ringOn; KNX.ff = LOOK.ff;
  const onNet = st.mode === 'star' || lum(T.net) <= .5 ? '#c9ccd1' : '#45484e'; set('--k-onnet', onNet);
  document.body.style.background = st.mode === 'star' ? '#000' : T.net; dirty = true;
}

// ---------- 字體（系統字體＋匯入的字體檔，存在瀏覽器）----------
const fdb = new Promise((res, rej) => { const o = indexedDB.open('kn-fonts', 1); o.onupgradeneeded = () => o.result.createObjectStore('f'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
const fst = (mode, fn) => fdb.then(d => new Promise((res, rej) => { const t = d.transaction('f', mode), r = fn(t.objectStore('f')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
const FONTS = [['system-ui', '系統預設'], ['"Microsoft JhengHei"', '微軟正黑體'], ['"PingFang TC","Noto Sans TC"', '蘋方／思源黑體'], ['"PMingLiU","MingLiU"', '新細明體'], ['"DFKai-SB","BiauKai"', '標楷體']];
const custom = [];
(async () => { try { const keys = await fst('readonly', s => s.getAllKeys());
  for (const k of keys) { const buf = await fst('readonly', s => s.get(k)); const f = new FontFace('kn-' + k, buf); await f.load(); document.fonts.add(f); custom.push(k); }
  dirty = true; } catch (e) {} })();

// ---------- 樣式（顏色全部吃外觀面板的設定）----------
document.head.append(h('style', {}, `
[hidden]{display:none!important}
#ui{display:none}#hint,#demoBtn,#fbar,#aiBar{display:none!important}#linePanel{display:none!important}
html.kt body,html.kt body.light{--fg:var(--k-tx);--sub:color-mix(in srgb,var(--k-tx) 60%,transparent);--panel:var(--k-ui);--line:var(--k-bd);--chip:var(--k-btn);--chipOn:var(--k-tx);--chipOnFg:var(--k-ui);color:var(--k-tx);font-family:var(--k-ff),"Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif}
html.kt body .c{background:var(--k-btn);color:var(--k-tx);border:var(--k-bw) solid var(--k-bd);border-radius:var(--k-r)}
html.kt body .c.on{background:var(--k-tx);color:var(--k-ui);border-color:var(--k-tx)}
html.kt body #pane{background:var(--k-ui);color:var(--k-tx);border:var(--k-bw) solid var(--k-bd);border-radius:var(--k-r);top:var(--ktop,56px)}
html.kt body #pane header{border-bottom:var(--k-bw) solid var(--k-bd)}
html.kt body #pane .go{background:var(--k-tx);color:var(--k-ui);border:var(--k-bw) solid var(--k-tx);border-radius:var(--k-r)}
html.kt body #pane .go.sub{background:var(--k-btn);color:var(--k-tx);border-color:var(--k-bd)}
html.kt body #pane input[type=text],html.kt body #pane input[type=password],html.kt body #pane input[type=number],html.kt body #pane input[type=date],html.kt body #pane textarea,html.kt body #pane select{background:transparent;color:inherit;border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) * .6)}
html.kt body #pane option,html.kt body .cadd option{background:var(--k-ui);color:var(--k-tx)}
html.kt body #pane.side{left:auto;right:12px;bottom:12px;width:min(400px,calc(100vw - 24px));max-width:none;margin:0}
@media(max-width:600px){html.kt body #pane.side{left:8px;right:8px;width:auto;top:auto;height:62vh;bottom:8px}}
html.kt body #card{background:var(--k-ui);color:var(--k-tx);border:var(--k-bw) solid var(--k-bd);border-radius:var(--k-r);top:var(--ktop,56px)}
html.kt body #zoom{color:var(--k-onnet)}
#tip{z-index:25}
html.kdrag-move,html.kdrag-move *{cursor:move!important}html.kdrag-size,html.kdrag-size *{cursor:nwse-resize!important}   /* 拖的時候滑鼠樣子不亂跳 */
#pane header{gap:4px}
#pane .psz{width:28px;height:28px;border:0;background:none;color:inherit;opacity:.6;border-radius:7px;cursor:pointer;display:grid;place-items:center;padding:0}
#pane .psz:hover{opacity:1;background:var(--k-btn)}#pane .psz svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8}
html.kt body #pane .x{width:28px;height:28px;border-radius:7px;line-height:1;opacity:.6}html.kt body #pane .x:hover{opacity:1;background:var(--k-btn)}
/* ===== 面板內容：卡片式（11/7 她選 B）===== */
.ktabs{display:flex;gap:2px;margin:-14px -16px 14px;padding:6px 12px 0;border-bottom:var(--k-bw) solid var(--k-bd);flex-wrap:wrap}
.ktabs button{background:none;border:0;border-bottom:2px solid transparent;color:inherit;opacity:.6;font:inherit;padding:7px 10px 8px;margin-bottom:-1px;cursor:pointer}
.ktabs button.on{opacity:1;border-color:currentColor;font-weight:600}.ktabs button:hover{opacity:1}
.ksec{font-size:12px;opacity:.65;letter-spacing:.04em;margin:16px 0 8px}.ksec:first-child,.ktabs+.ksec{margin-top:0}
.kgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.kc{display:flex;flex-direction:column;gap:3px;padding:10px 12px;border:var(--k-bw) solid var(--k-bd);border-radius:var(--k-r);background:var(--k-btn);color:var(--k-tx);cursor:pointer;min-width:0;text-align:left;font:inherit}
.kc:hover,.kc:focus-visible{border-color:color-mix(in srgb,var(--k-tx) 45%,transparent);outline:none}
.kc.still{cursor:default}.kc.still:hover{border-color:var(--k-bd)}
.kc .t{font-weight:600;line-height:1.45;overflow-wrap:anywhere}.kc .s{font-size:12px;opacity:.65}
.kc .kacts{display:flex;gap:6px;margin-top:6px}.kchip{align-self:flex-start;font-size:11px;border:1px solid var(--k-bd);border-radius:999px;padding:0 7px;opacity:.75}
.kno{display:inline-grid;place-items:center;min-width:18px;height:18px;border-radius:5px;border:1px solid var(--k-bd);font-size:11px;margin-right:6px;font-weight:400;vertical-align:1px}
.kstat{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:4px}
.kstat div{display:flex;flex-direction:column;padding:10px 12px;border:var(--k-bw) solid var(--k-bd);border-radius:var(--k-r);background:var(--k-btn)}
.kstat b{font-size:22px;font-variant-numeric:tabular-nums;line-height:1.2}.kstat span{font-size:12px;opacity:.65}
.kempty{opacity:.6;text-align:center;padding:24px 0}
.kc .gbar rect{fill:var(--k-sel)}.kc .gbar text{fill:currentColor;font-size:11px;opacity:.75}
.kgrp{padding:4px}.kti{display:flex;justify-content:space-between;gap:8px;padding:6px 8px 6px 18px;border-radius:calc(var(--k-r) * .6);cursor:pointer}
.kti.top{padding-left:8px;font-weight:600}.kti:hover,.kti.on{background:color-mix(in srgb,var(--k-tx) 10%,transparent)}.kti .n{opacity:.6;font-variant-numeric:tabular-nums;font-weight:400}
#tbox{margin-bottom:12px}
html.kt body #pane .qa-a{background:var(--k-btn);border:var(--k-bw) solid var(--k-bd);border-radius:var(--k-r);padding:10px 12px;margin:12px 0 4px;line-height:1.75}
html.kt body #pane .cite:not(.kc){border:1px solid var(--k-bd);border-radius:5px;padding:0 5px;font-size:11px;background:none;color:inherit;cursor:pointer}
html.kt body #pane .rcp{border:var(--k-bw) solid var(--k-bd);border-radius:var(--k-r);background:var(--k-btn);padding:10px 12px;margin:8px 0}
html.kt body #pane .aiset fieldset{border:var(--k-bw) solid var(--k-bd);border-radius:var(--k-r);background:var(--k-btn);margin:0 0 12px;padding:8px 12px 12px}
html.kt body #pane .aiset legend{font-weight:600;padding:0 6px;font-size:13px}
html.kt body #pane .kc input[type=text]{background:var(--k-ui)}
#pane:not(.side) #pbody>.kgrid,#pane:not(.side) #pbody>.edp{max-width:none}
html.kt body #toast{top:auto;bottom:56px;max-width:calc(100vw - 24px);text-align:center;z-index:70}
.q:hover::after,.q:focus::after{content:none!important;display:none!important}
.q{cursor:default!important}   /* 停在 ? 上時，滑鼠旁不要再出現問號 */
#menubar{position:fixed;left:12px;right:12px;top:10px;z-index:30;display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;align-items:flex-start;font-size:13px;pointer-events:none}
#menubar>div{display:flex;gap:6px;flex-wrap:wrap;pointer-events:auto}#menubar .rt{justify-content:flex-end}
.mb{border:var(--k-bw) solid var(--k-bd);background:var(--k-btn);color:var(--k-tx);border-radius:var(--k-r);padding:6px 12px;font:inherit;cursor:pointer}
.mb.pri{font-weight:600}.mb.on{background:var(--k-tx);color:var(--k-ui)}
.mpop{position:fixed;z-index:35;background:var(--k-ui);color:var(--k-tx);border:var(--k-bw) solid var(--k-bd);border-radius:var(--k-r);padding:5px;font-size:13px}
.mpop .lst{display:flex;flex-direction:column;min-width:130px}
.mpop .lst>button{background:none;border:0;color:inherit;text-align:left;padding:7px 10px;border-radius:calc(var(--k-r) * .6);font:inherit;cursor:pointer;white-space:nowrap}
.mpop .lst>button:hover,.mpop .lst>button:focus{background:var(--k-btn);outline:none}
#khelp{position:fixed;z-index:60;width:210px;box-sizing:border-box;padding:7px 10px;border-radius:8px;border:1px solid var(--k-bd);background:var(--h-bg);color:var(--h-fg);font-size:var(--h-size);line-height:1.5;pointer-events:none;overflow-wrap:anywhere}   /* 照 v3 的說明框 */
.mpop .lst>button{display:flex;justify-content:space-between;align-items:center;gap:10px}.mpop .q{margin:0}
.lk .sec{font-weight:600;margin:14px 0 4px;padding-top:8px;border-top:var(--k-bw) solid var(--k-bd)}.lk .sec:first-child{margin-top:0;border-top:0;padding-top:0}
.lk .tr{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:4px 0}.lk .tr>b{min-width:6.5em;font-weight:normal;opacity:.75}
.lk input[type=color]{width:30px;height:22px;border:var(--k-bw) solid var(--k-bd);border-radius:5px;padding:0;background:none;cursor:pointer}
.lk input[type=range]{flex:1;min-width:80px;max-width:170px}.lk .v{font-size:12px;opacity:.75;min-width:3.5em}
.lk .pre{display:flex;gap:6px;flex-wrap:wrap}
#menuEd{position:fixed;left:12px;right:12px;top:var(--ktop,56px);z-index:34;background:var(--k-ui);color:var(--k-tx);border:var(--k-bw) solid var(--k-bd);border-radius:var(--k-r);padding:12px;display:flex;gap:10px;align-items:flex-start;overflow-x:auto;font-size:13px}
#menuEd .col{min-width:130px;border:1px dashed var(--k-bd);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px;min-height:80px}
#menuEd .col input{background:transparent;color:inherit;border:0;border-bottom:1px solid var(--k-bd);font:inherit;font-weight:bold;width:100%}
#menuEd .chip{border:1px solid var(--k-bd);border-radius:8px;padding:5px 9px;cursor:grab;background:var(--k-btn);user-select:none}
#menuEd .col.pins{border-style:solid}#menuEd .col.over{outline:2px solid var(--k-sel)}#menuEd .tools{display:flex;flex-direction:column;gap:6px}
#menuEd .x{float:right;cursor:pointer;opacity:.6;margin-left:6px}#menuEd .note{opacity:.6;font-size:12px}
#menuEd button{font:inherit;border:var(--k-bw) solid var(--k-bd);background:var(--k-btn);color:var(--k-tx);border-radius:var(--k-r);padding:5px 12px;cursor:pointer}`));

// ---------- 選單列 ----------
const bar = h('div', { id: 'menubar' }, '<div class="lf"></div><div class="rt"></div>'); document.body.append(bar);
const setTop = () => document.documentElement.style.setProperty('--ktop', (bar.offsetHeight + 18) + 'px');
addEventListener('resize', setTop);
let pop = null;
const closePop = () => { if (pop) { pop.remove(); pop = null; bar.querySelectorAll('.mb.on').forEach(b => b.classList.remove('on')); } };
function drawBar() {
  bar.querySelector('.lf').innerHTML = M.pins.map(i => `<button class="mb pri" data-p="${i}">${E(ITEMS[i][0])}</button>`).join('');
  bar.querySelector('.rt').innerHTML = M.groups.map((g, i) => !g.items.length ? '' : g.items.length === 1 ? `<button class="mb" data-one="${g.items[0]}">${E(g.name)}</button>` : `<button class="mb" data-g="${i}">${E(g.name)} ▾</button>`).join('');
  bar.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { closePop(); ITEMS[b.dataset.p][2](); });
  bar.querySelectorAll('[data-one]').forEach(b => b.onclick = () => { closePop(); ITEMS[b.dataset.one][2](); });
  bar.querySelectorAll('[data-g]').forEach(b => b.onclick = e => { e.stopPropagation(); const open = b.classList.contains('on'); closePop(); if (!open) openPop(b, M.groups[+b.dataset.g]); });
  setTop();
}
// 下拉選單：清單在按鈕正下方（右邊對齊按鈕）；說明是單獨的小框，出現在清單左邊、對齊停住的那一項（11/7 她選 C）
function openPop(b, g) {
  b.classList.add('on'); hideHelp();
  pop = h('div', { className: 'mpop' });
  pop.innerHTML = `<div class="lst">${g.items.map(i => `<button data-i="${i}"><span>${E(ITEMS[i][0])}</span>${ITEMS[i][1] ? qm(ITEMS[i][1]) : ''}</button>`).join('')}</div>`;
  pop.querySelectorAll('[data-i]').forEach(x => x.onclick = e => { if (e.target.closest('.q')) return; closePop(); ITEMS[x.dataset.i][2](); });
  document.body.append(pop);
  const r = b.getBoundingClientRect();
  pop.style.top = (r.bottom + 6) + 'px';
  pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  if (pop.getBoundingClientRect().left < 8) { pop.style.right = 'auto'; pop.style.left = '8px'; }
}
document.addEventListener('pointerdown', e => { if (pop && !pop.contains(e.target) && !bar.contains(e.target)) closePop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

// ---------- 說明框：固定大小，出現在功能右側；右側面板的說明出現在面板左側、對齊那一行 ----------
const hb = h('div', { id: 'khelp', hidden: true }); document.body.append(hb);
let hEl = null, hT = 0;
function hideHelp() { clearTimeout(hT); hb.hidden = true; hEl = null; }
function showHelp(el) {
  const text = el.dataset.tip || el.dataset.help; if (!text) return;
  hEl = el; hb.textContent = text; hb.hidden = false;
  const a = el.getBoundingClientRect(), W = innerWidth, Hh = hb.offsetHeight, mp = el.closest('.mpop');
  let x, y = a.top - 4;
  if (mp) { const m = mp.getBoundingClientRect(), rw = el.closest('button').getBoundingClientRect(); x = m.left - 216; y = rw.top; if (x < 4) x = m.right + 6; }   // 選單：說明緊靠清單左邊、對齊那一項
  else { x = a.right + 6; if (x + 210 > W - 4) x = a.left - 216; if (x < 4) { x = Math.min(Math.max(4, a.left), W - 214); y = a.bottom + 6; } }   // 面板裡：緊貼在 ? 右邊（放不下貼左邊）
  hb.style.left = x + 'px'; hb.style.top = Math.max(4, Math.min(y, innerHeight - Hh - 4)) + 'px';
}
const helpOf = t => t && t.closest ? t.closest('.q[data-tip]') : null;   // 只有停在 ? 上才出現說明（11/7 她選）
document.addEventListener('mouseover', e => { const el = helpOf(e.target); if (el === hEl) return; clearTimeout(hT); if (!el) { hb.hidden = true; hEl = null; return; } showHelp(el); });
document.addEventListener('focusin', e => { const el = helpOf(e.target); if (el) showHelp(el); });
document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { const el = helpOf(e.target); if (el && el.classList.contains('q')) { e.preventDefault(); el === hEl && !hb.hidden ? hideHelp() : showHelp(el); return; } } if (!helpOf(e.target)) hideHelp(); }, true);
document.addEventListener('scroll', hideHelp, true);
// 面板關掉、換內容時，說明框跟著收起來；右側面板開著時，卡片排在它左邊
const PSZ = { big: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>', small: '<svg viewBox="0 0 24 24"><path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/></svg>' };
const pszBtn = document.getElementById('psz');
const setPsz = () => { const s = pane.classList.contains('side'); const k = s ? 'big' : 'small'; if (pszBtn.dataset.k !== k) { pszBtn.dataset.k = k; pszBtn.innerHTML = PSZ[k]; } pszBtn.title = s ? '放大成大框' : '縮回小框'; };
new MutationObserver(() => { hideHelp(); setPsz(); document.body.classList.toggle('sideopen', !pane.hidden && pane.classList.contains('side') && !pane.classList.contains('moved')); }).observe(pane, { attributes: true, attributeFilter: ['hidden', 'class'] });
new MutationObserver(hideHelp).observe(pbody, { childList: true });

// ---------- 外觀面板（只管「看起來怎樣」；顯示什麼、怎麼操作在編輯台）----------
const qm = t => `<span class="q" tabindex="0" data-tip="${E(t)}">?</span>`;
const row = (name, html, help) => `<div class="tr"><b>${name}${help ? qm(help) : ''}</b>${html}</div>`;
const col = (attr, v) => `<input type="color" ${attr} value="${E(String(v).slice(0, 7))}">`;
const rg = (attr, a, b, s, v, unit) => `<input type="range" ${attr} min="${a}" max="${b}" step="${s}" value="${v}"><span class="v">${unit(v)}</span>`;
const pct = v => Math.round(v * 100) + '%';
function lookPane() {
  closePop(); const keepTop = !pane.hidden && document.getElementById('ptitle').textContent === '外觀' ? pbody.scrollTop : 0;
  const T = LOOK.t, u = U(), star = st.mode === 'star', ED = store.get('ed', {});
  const fs = ED.fs || 1, zm = ED.ui || 1;
  const names = [...Object.keys(PRE), ...(LOOK.mine ? ['我的'] : [])];
  const pick = st.col === 'topic' ? TP.filter(T2 => !T2.demo).map(T2 => `<label>${E(T2.name)}${col(`data-tcol="${E(T2.id)}"`, T2.col)}</label>`).join(' ')
    : st.col === 'age' ? `新${col('data-age="0"', st.age[0])} 舊${col('data-age="1"', st.age[1])}` : st.col === 'fade' ? `最近看過${col('data-fade="0"', st.fade[0])} 快忘${col('data-fade="1"', st.fade[1])}` : '';
  openPane('外觀', `<div class="lk">
   <div class="sec">配色${qm('先選一套，再到下面單項微調；調好可以存成「我的」。')}</div>
   <div class="tr pre">${names.map(n => `<button class="c${n === LOOK.name ? ' on' : ''}" data-pre="${E(n)}">${E(n)}</button>`).join('')}</div>
   <div class="tr"><button class="c" id="lksave">存成「我的」配色</button></div>
   <div class="sec">單項顏色</div>
   ${Object.keys(UIC).map(k => row(UIC[k], col(`data-u="${k}"`, u[k]))).join('')}
   ${Object.keys(NETC).map(k => row(NETC[k][0], col(`data-t="${k}"`, T[k]), NETC[k][1] || '')).join('')}
   <div class="sec">知識網的樣子</div>
   ${row('樣子', `<button class="c${star ? ' on' : ''}" data-mode="star">壯麗星空</button><button class="c${star ? '' : ' on'}" data-mode="min">簡約</button>`, '壯麗星空：主題是由知識點組成的星球。簡約：主題名稱＋點，放大才出現下一層。快捷鍵 M。')}
   ${star ? row('星點顏色', col('data-st="starC"', st.starC)) + row('星空選取色', col('data-st="starHi"', st.starHi))
    : row('點色方式', `<select id="lkcol">${[['mono', '素色'], ['topic', '依主題'], ['age', '依新舊'], ['fade', '依快忘']].map(([v, t]) => `<option value="${v}"${st.col === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`, '素色＝都用「點的顏色」；依主題／新舊／快忘＝用下面的顏色漸變。') + (pick ? `<div class="tr">${pick}</div>` : '')}
   <div class="sec">新點（7 天內新加的）</div>
   ${row('新點', `點${col('data-t="newc"', T.newc)} 光圈${col('data-t="ring"', T.ring)}<label><input type="checkbox" id="lkring"${LOOK.ringOn ? ' checked' : ''}> 顯示光圈</label>`)}
   <div class="sec">說明</div>
   ${row('字大小', rg('data-h="size"', 11, 16, 1, LOOK.help.size, v => v + ' px'))}
   ${row('顏色', `字${col('data-h="fg"', LOOK.help.fg || u.tx)} 底${col('data-h="bg"', LOOK.help.bg || u.btn)}`)}
   ${row('底色透明度', rg('data-h="op"', 0, 100, 5, LOOK.help.op, v => v + '%'), '0 是完全透明，100 是不透明')}
   <div class="sec">框和字</div>
   ${row('框線粗細', rg('data-f="bw"', 0, 3, 1, LOOK.bw, v => +v ? v + ' px' : '不要'))}
   ${row('圓角', rg('data-f="r"', 0, 20, 1, LOOK.r, v => v + ' px'))}
   ${row('字體', `<select id="lkff">${[...FONTS, ...custom.map(k => [`"kn-${k}"`, k + '（匯入）'])].map(([v, t]) => `<option value='${E(v)}'${v === LOOK.ff ? ' selected' : ''}>${E(t)}</option>`).join('')}</select><label class="c" style="cursor:pointer;padding:3px 10px">匯入字體<input type="file" id="lkimp" accept=".ttf,.otf,.woff,.woff2" hidden></label>`, '介面和知識網的字體；可以匯入自己的字體檔（.ttf、.otf）')}
   ${row('知識網字大小', rg('data-ed="fs"', .8, 2, .1, fs, pct))}
   ${row('介面大小', rg('data-ed="ui"', .8, 1.4, .05, zm, pct), '面板、卡片、按鈕整體放大縮小')}
   <div class="sec">介面</div>
   ${row('深／淺', `<button class="c${LOOK.ui !== 'light' ? ' on' : ''}" data-ui="dark">深</button><button class="c${LOOK.ui === 'light' ? ' on' : ''}" data-ui="light">淺</button>`, '選單、面板、卡片用深色還是淺色（和知識網底色分開）')}
  </div>`);
  const P = pbody; P.scrollTop = keepTop;   // 改設定重畫時，停在原本捲到的地方
  const custom1 = () => { if (LOOK.name !== '我的') { LOOK.name = '（已微調）'; P.querySelectorAll('[data-pre]').forEach(b => b.classList.remove('on')); } };
  P.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { const n = b.dataset.pre, src = n === '我的' ? LOOK.mine : PRE[n]; LOOK.t = clone(src); LOOK.name = n; if (src.ui) LOOK.ui = src.ui; saveLook(); lookPane(); });
  P.querySelector('#lksave').onclick = () => { LOOK.mine = clone(Object.assign(LOOK.t, { ui: LOOK.ui })); LOOK.name = '我的'; saveLook(); lookPane(); toast('已存成「我的」配色'); };
  P.querySelectorAll('[data-u]').forEach(x => x.oninput = () => { U()[x.dataset.u] = x.value; custom1(); saveLook(); });
  P.querySelectorAll('[data-t]').forEach(x => x.oninput = () => { LOOK.t[x.dataset.t] = x.value; custom1(); saveLook(); });
  P.querySelectorAll('[data-mode]').forEach(x => x.onclick = () => { const b = document.querySelector(`#gMode [data-v="${x.dataset.mode}"]`); if (b) b.click(); applyLook(); lookPane(); });
  P.querySelectorAll('[data-st]').forEach(x => x.oninput = () => { st[x.dataset.st] = x.value; save(); dirty = true; });
  const lc = P.querySelector('#lkcol'); if (lc) lc.onchange = () => { const b = document.querySelector(`#gCol [data-v="${lc.value}"]`); if (b) b.click(); lookPane(); };
  P.querySelectorAll('[data-tcol]').forEach(x => x.oninput = () => { const T2 = TP.find(t => t.id === x.dataset.tcol); if (T2) { T2.col = x.value; st.tcol[T2.id] = x.value; save(); dirty = true; } });
  P.querySelectorAll('[data-age],[data-fade]').forEach(x => x.oninput = () => { const k = x.dataset.age != null ? 'age' : 'fade'; st[k][+x.dataset[k]] = x.value; save(); dirty = true; });
  P.querySelector('#lkring').onchange = e => { LOOK.ringOn = e.target.checked; saveLook(); };
  P.querySelectorAll('[data-h]').forEach(x => x.oninput = () => { const k = x.dataset.h; LOOK.help[k] = x.type === 'range' ? +x.value : x.value; if (x.type === 'range') x.nextElementSibling.textContent = k === 'size' ? x.value + ' px' : x.value + '%'; saveLook(); });
  P.querySelectorAll('[data-f]').forEach(x => x.oninput = () => { const k = x.dataset.f; LOOK[k] = +x.value; x.nextElementSibling.textContent = k === 'bw' ? (+x.value ? x.value + ' px' : '不要') : x.value + ' px'; saveLook(); setTop(); });
  P.querySelectorAll('[data-ed]').forEach(x => x.oninput = () => { x.nextElementSibling.textContent = pct(x.value); if (window.knSetED) knSetED(x.dataset.ed, +x.value); setTop(); });
  P.querySelectorAll('[data-ui]').forEach(x => x.onclick = () => { LOOK.ui = x.dataset.ui; saveLook(); lookPane(); });
  P.querySelector('#lkff').onchange = e => { LOOK.ff = e.target.value; saveLook(); };
  P.querySelector('#lkimp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try {
    const k = f.name.replace(/\.[^.]+$/, '').replace(/["'<>]/g, ''), buf = await f.arrayBuffer(), ff = new FontFace('kn-' + k, buf); await ff.load(); document.fonts.add(ff);
    await fst('readwrite', s => s.put(buf, k)); if (!custom.includes(k)) custom.push(k); LOOK.ff = `"kn-${k}"`; saveLook(); toast('已匯入字體：' + k); lookPane(); } catch (er) { toast('這個字體檔讀不了：' + er.message, 6000); } };
}
window.knLook = lookPane;

// ---------- 整理選單：直接拖曳 ----------
function editMode() {
  closePop(); KN.closePane(); let ed = document.getElementById('menuEd'); if (ed) ed.remove(); ed = h('div', { id: 'menuEd' }); document.body.append(ed);
  const draw = () => {
    ed.innerHTML = `<div class="col pins" data-pins="1"><b>露出在左上</b>${M.pins.map(i => `<div class="chip" draggable="true" data-i="${i}" data-from="pins">${E(ITEMS[i][0])}<span class="x" data-up="${i}" title="不要露出">×</span></div>`).join('')}<span class="note">把功能拖進來</span></div>` +
      M.groups.map((g, gi) => `<div class="col" data-gi="${gi}"><div><input value="${E(g.name)}" data-n="${gi}">${g.items.length ? '' : `<span class="x" data-dg="${gi}" title="刪除這組">×</span>`}</div>${g.items.map(i => `<div class="chip" draggable="true" data-i="${i}" data-from="${gi}">${E(ITEMS[i][0])}</div>`).join('')}${g.items.length === 1 ? '<span class="note">只有一個功能＝直接按</span>' : ''}</div>`).join('') +
      `<div class="tools"><button id="meok">好了</button><button id="meadd">＋ 新的組</button><button id="medef">恢復預設</button></div>`;
    ed.querySelectorAll('[data-n]').forEach(x => x.onchange = () => { M.groups[+x.dataset.n].name = x.value.trim() || '未命名'; saveM(); drawBar(); });
    ed.querySelectorAll('[data-dg]').forEach(x => x.onclick = () => { M.groups.splice(+x.dataset.dg, 1); saveM(); drawBar(); draw(); });
    ed.querySelectorAll('[data-up]').forEach(x => x.onclick = () => { M.pins = M.pins.filter(i => i !== x.dataset.up); fix(); saveM(); drawBar(); draw(); });
    ed.querySelectorAll('.chip').forEach(c => c.ondragstart = e => e.dataTransfer.setData('text/plain', c.dataset.i + '|' + c.dataset.from));
    ed.querySelectorAll('.col').forEach(cl => {
      cl.ondragover = e => { e.preventDefault(); cl.classList.add('over'); }; cl.ondragleave = () => cl.classList.remove('over');
      cl.ondrop = e => { e.preventDefault(); cl.classList.remove('over'); const [id] = e.dataTransfer.getData('text/plain').split('|'); if (!ITEMS[id]) return;
        const before = e.target.closest('.chip') ? e.target.closest('.chip').dataset.i : null;
        M.pins = M.pins.filter(i => i !== id); M.groups.forEach(x => x.items = x.items.filter(i => i !== id));
        const arr = cl.dataset.pins ? M.pins : M.groups[+cl.dataset.gi].items, k = before ? arr.indexOf(before) : -1; k >= 0 ? arr.splice(k, 0, id) : arr.push(id);
        saveM(); drawBar(); draw(); };
    });
    ed.querySelector('#meok').onclick = () => ed.remove();
    ed.querySelector('#meadd').onclick = () => { M.groups.push({ name: '新的組', items: [] }); saveM(); drawBar(); draw(); };
    ed.querySelector('#medef').onclick = () => { M = clone(DEFM); fix(); saveM(); drawBar(); draw(); };
  };
  draw();
}
window.knMenuEdit = editMode;

// ---------- 小框和卡片：拖標題移動、拖右下角改大小；各自記住位置和大小，雙擊標題放回原位（11/7 她選）----------
// 位置和大小都用「畫面上看到的」像素記；外觀「介面大小」不是 100% 時（CSS zoom），寫回去前換算，才不會越存越小。
const POS = store.get('winpos', {});
const cardEl = document.getElementById('card');
const keyOf = el => el === cardEl ? 'card' : pane.dataset.k || document.getElementById('ptitle').textContent;
const movable = el => el === cardEl ? !cardEl.hidden : !pane.hidden && pane.classList.contains('side');
const zOf = el => parseFloat(getComputedStyle(el).zoom) || 1;
const top0 = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ktop')) || 56;
function clearPos(el) { ['left', 'top', 'right', 'bottom', 'height', 'width'].forEach(k => el.style[k] = ''); if (el.classList.contains('moved')) el.classList.remove('moved'); }
function placeAt(el, p) {   // p＝{x,y,w,h}，畫面像素
  if (innerWidth < 640) return clearPos(el);   // 手機那種窄螢幕：照原本的位置
  const z = zOf(el), T = top0();
  const w = Math.max(260, Math.min(p.w, innerWidth - 8)), h = Math.max(160, Math.min(p.h, innerHeight - T - 8));
  const x = Math.max(4, Math.min(p.x, innerWidth - w - 4)), y = Math.max(T, Math.min(p.y, innerHeight - h - 4));
  Object.assign(el.style, { left: x / z + 'px', top: y / z + 'px', width: w / z + 'px', height: h / z + 'px', right: 'auto', bottom: 'auto' });
  if (!el.classList.contains('moved')) el.classList.add('moved');
}
const rectOf = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
let dragging = null;
function applyPos(el) { if (dragging === el || arranging) return; if (!movable(el)) { if (el === pane) clearPos(el); return; } const p = POS[keyOf(el)]; if (p && p.w) placeAt(el, p); else clearPos(el); setTimeout(arrange, 0); }
function savePos(el) { POS[keyOf(el)] = rectOf(el); store.set('winpos', POS); }
function makeWin(el, handleOf) {
  const grip = h('div', { className: 'kgrip', title: '拖這裡改大小' }); el.append(grip);
  let d = null;
  el.addEventListener('pointerdown', e => {
    if (!movable(el) || innerWidth < 640 || e.button !== 0) return;
    const mode = e.target === grip ? 'size' : handleOf(e.target) ? 'move' : null; if (!mode) return;
    e.preventDefault(); try { e.target.setPointerCapture(e.pointerId); } catch (er) {} d = { mode, sx: e.clientX, sy: e.clientY, r: rectOf(el), id: e.pointerId, moved: false };
  });
  addEventListener('pointermove', e => { if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!d.moved) { d.moved = true; dragging = el; hideHelp(); document.body.style.userSelect = 'none'; document.documentElement.classList.add(d.mode === 'move' ? 'kdrag-move' : 'kdrag-size'); }
    const r = d.r; placeAt(el, d.mode === 'move' ? { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h } : { x: r.x, y: r.y, w: r.w + dx, h: r.h + dy }); });
  addEventListener('pointerup', e => { if (!d || e.pointerId !== d.id) return; document.body.style.userSelect = ''; document.documentElement.classList.remove('kdrag-move', 'kdrag-size'); if (d.moved) savePos(el); d = null; dragging = null; arrange(); });
  el.addEventListener('dblclick', e => { if (!handleOf(e.target) || !movable(el)) return; delete POS[keyOf(el)]; store.set('winpos', POS); clearPos(el); toast('放回原位'); });
}
const notCtl = t => !t.closest('button,input,select,textarea,a,label');
makeWin(pane, t => notCtl(t) && t.closest('#pane header'));
makeWin(cardEl, t => notCtl(t) && t.closest('#cpath,#cname'));
document.head.append(h('style', {}, `#pane.side header{cursor:move;user-select:none}#card #cpath,#card #cname{cursor:move;user-select:none}
.kgrip{display:none;position:absolute;right:2px;bottom:2px;width:16px;height:16px;cursor:nwse-resize;z-index:5;touch-action:none;opacity:.55;
 background:linear-gradient(135deg,transparent 0 55%,currentColor 55% 62%,transparent 62% 72%,currentColor 72% 79%,transparent 79%)}
.kgrip:hover{opacity:1}
html.kt body #card{display:flex;flex-direction:column;overflow:hidden}html.kt body #card>*{flex:none}html.kt body #cbody{flex:1 1 auto;min-height:0;overflow:auto}
@media(min-width:640px){#pane.side>.kgrip,#card>.kgrip{display:block}}`));
// 小框和卡片同時開著、又疊在一起時：卡片自動排到小框旁邊（左邊放不下就放右邊），不記成卡片的位置（11/7 她選）
let arranging = false;
function arrange() {
  if (arranging || dragging || innerWidth < 640 || !movable(pane) || cardEl.hidden) return;
  const a = rectOf(pane), c = rectOf(cardEl), gap = 10;
  if (c.x >= a.x + a.w || c.x + c.w <= a.x || c.y >= a.y + a.h || c.y + c.h <= a.y) return;   // 沒疊到
  let x = a.x - c.w - gap; if (x < 4) x = a.x + a.w + gap;
  arranging = true; placeAt(cardEl, { x, y: c.y, w: c.w, h: c.h }); arranging = false;
}
new MutationObserver(() => applyPos(pane)).observe(pane, { attributes: true, attributeFilter: ['hidden', 'class'] });
new MutationObserver(() => applyPos(pane)).observe(document.getElementById('ptitle'), { childList: true, characterData: true, subtree: true });
new MutationObserver(() => applyPos(cardEl)).observe(cardEl, { attributes: true, attributeFilter: ['hidden'] });
addEventListener('resize', () => { applyPos(pane); applyPos(cardEl); arrange(); });

// ---------- 其他：圈選鈕收進選單、示範點關掉、模式切換時底色跟著換 ----------
const lb = lasso(); if (lb) lb.style.display = 'none';
if (st.demo) { st.demo = false; save(); build(); ui(); enterMode(); }
const _ui = ui; ui = function () { _ui(); applyLook(); };
applyLook(); drawBar();
})();
