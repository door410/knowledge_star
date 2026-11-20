// 按鈕排列、畫面上直接編輯、手機底部列、純粹瀏覽、面板分段收合、各區塊字大小（11/13，參考 love-record 後 Door 選的）
// 11/20：每個按鈕可以設字大小、按鈕大小；按鈕可以拖到畫面任何位置（自由擺放）；功能框和知識點卡片的上下位置、高度（手機、電腦分開記）
// 資料：
//   bar   ＝上方列 { L:[項目], R:[項目], tray:[收起來的功能], names:{功能:改過的名字}, zoom:縮放列要不要顯示,
//                    sty:{功能:{fs:字大小%, sz:按鈕大小%}}, free:{功能:{n:手機的位置, w:電腦的位置}} }
//          項目＝{ f:功能 }（單獨一個鈕）或 { g:組名, items:[功能…], sty }（下拉選單；只有一個功能時直接按）
//          自由擺放的位置＝{ ax:'l'|'r', ay:'t'|'b', dx, dy }：離最近的那個角多遠（畫面變大變小也不會跑出去）
//   bottom＝手機底部列 { on, desk:電腦也顯示, slots:[{ f, short:底部列上的短名字, fs, sz }] }
//   fsz   ＝字大小 { all:整個介面, menu:選單和按鈕, pane:面板, card:卡片, bot:底部（縮放列、底部列） }
//   fold  ＝面板裡收起來的段落 { '面板|段落標題': true }
//   panepos＝功能框（p）和知識點卡片（c）的上緣、下緣 { n:{ p:{t,b}, c:{t,b} }, w:{…} }（n＝手機、w＝電腦）
(() => {
const KN = window.KN, { h, toast } = KN, MN = KN.menu, ITEMS = MN.ITEMS, E = MN.E;
const clone = o => JSON.parse(JSON.stringify(o));
const NARROW = 700;
const isNarrow = () => innerWidth < NARROW;
const DEV = () => isNarrow() ? 'n' : 'w';
const DEVNAME = () => isNarrow() ? '手機' : '電腦';

// ---------- 預設＋讀進來時整理（未知的功能拿掉、少的補上，舊的「整理選單」設定搬過來）----------
const DEFBAR = { L: [{ f: 'add' }, { f: 'qa' }],
  R: [{ g: '回顧', items: ['recent', 'grow', 'tour', 'tm'] }, { g: '整理', items: ['lasso', 'hist', 'topics'] }, { f: 'look' }, { g: '設定', items: ['ed', 'ai', 'folder', 'menu', 'pure'] }],
  tray: ['new', 'home', 'mode', 'more'], names: {}, zoom: true, sty: {}, free: {} };
const DEFBOT = { on: true, desk: false, slots: [{ f: 'add', short: '丟東西' }, { f: 'qa' }, { f: 'recent' }, { f: 'more' }] };
function fromOld(m) {   // 11/7 版的 menu2 { groups:[{name,items}], pins:[] }
  const b = { L: m.pins.map(f => ({ f })), R: [], tray: [], names: {}, zoom: true };
  m.groups.forEach(g => { if (g.items.length === 1) { b.R.push({ f: g.items[0] }); if (g.name !== ITEMS[g.items[0]]?.[0]) b.names[g.items[0]] = g.name; } else b.R.push({ g: g.name, items: g.items.slice() }); });
  return b;
}
const okSty = s => s && typeof s === 'object' && (s.fs || s.sz) ? { ...(s.fs ? { fs: +s.fs } : {}), ...(s.sz ? { sz: +s.sz } : {}) } : null;
const okPos = p => p && /^[lr]$/.test(p.ax) && /^[tb]$/.test(p.ay) && isFinite(p.dx) && isFinite(p.dy);
function normBar(raw) {
  const b = Object.assign(clone(DEFBAR), raw || {}), seen = new Set();
  const ok = f => ITEMS[f] && !seen.has(f) && seen.add(f);
  ['L', 'R'].forEach(s => { b[s] = (b[s] || []).filter(e => e && (e.g != null ? Array.isArray(e.items) : true)).map(e => e.g != null ? { g: String(e.g || '未命名'), items: e.items.filter(ok), ...(okSty(e.sty) ? { sty: okSty(e.sty) } : {}) } : e).filter(e => e.g != null || ok(e.f)); });
  b.tray = (b.tray || []).filter(ok);
  b.names = Object.fromEntries(Object.entries(b.names || {}).filter(([k, v]) => ITEMS[k] && v));
  b.sty = Object.fromEntries(Object.entries(b.sty || {}).filter(([k, v]) => ITEMS[k] && okSty(v)).map(([k, v]) => [k, okSty(v)]));
  b.free = Object.fromEntries(Object.entries(b.free || {}).filter(([k, v]) => ITEMS[k] && v && typeof v === 'object').map(([k, v]) => [k, Object.fromEntries(['n', 'w'].filter(d => okPos(v[d])).map(d => [d, v[d]]))]).filter(([, v]) => Object.keys(v).length));
  Object.keys(ITEMS).forEach(f => { if (seen.has(f)) return;   // 新加的功能：純粹瀏覽放進有「編輯版面」的那組，其他先收起來
    const g = f === 'pure' && [...b.L, ...b.R].find(e => e.items && e.items.includes('menu'));
    if (g) g.items.push(f); else b.tray.push(f); seen.add(f); });
  if (b.tray.includes('menu')) { b.tray = b.tray.filter(f => f !== 'menu'); b.R.push({ f: 'menu' }); }   // 「編輯版面」不能收起來，不然回不來
  return b;
}
function normBot(raw) {
  const b = Object.assign(clone(DEFBOT), raw || {});
  b.slots = (b.slots || []).filter(s => s && ITEMS[s.f]).slice(0, 6).map(s => ({ f: s.f, ...(s.short ? { short: String(s.short).slice(0, 8) } : {}), ...(okSty(s) || {}) }));
  return b;
}
let BAR = normBar(store.get('bar', null) || (store.get('menu2', null) ? fromOld(store.get('menu2')) : null));
let BOT = normBot(store.get('bottom', null));
const saveBar = () => store.set('bar', BAR), saveBot = () => store.set('bottom', BOT);
const label = f => BAR.names[f] || ITEMS[f][0];
const freeOf = f => BAR.free[f] && BAR.free[f][DEV()];
const PANE_T = { new: '新增知識點' };   // 按鈕名和面板標題不一樣的
KN.paneTitle = t => { const nm = Object.assign({}, ...(BOT.slots || []).filter(x => x.short).map(x => ({ [x.f]: x.short })), BAR.names);   // 上方改的名字優先，其次是底部列改的
  for (const f in nm) { const d = PANE_T[f] || (ITEMS[f] && ITEMS[f][0]), c = nm[f]; if (!d || !c) continue; if (t === d) return c; if (t.startsWith(d + '：')) return c + t.slice(d.length); } return t; };
MN.setNameOf(label);
const run = f => { MN.closePop(); hideMore(); ITEMS[f][2](); };
// 按鈕自己的字大小、大小 → 寫在按鈕上（字用 em，跟著介面字大小一起縮放；大小＝內距）
const styOf = s => { if (!s) return ''; let o = ''; if (s.fs && s.fs !== 100) o += `font-size:${s.fs / 100}em;`; if (s.sz && s.sz !== 100) o += `--bsz:${s.sz / 100};`; return o ? ` style="${o}"` : ''; };

// ---------- 樣式 ----------
document.head.append(h('style', {}, `
#menubar .lf,#menubar .rt{min-height:1px}
#kbot{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:28;display:flex;gap:6px;padding:6px;border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) + 4px);background:var(--k-ui);font-size:13px}
#kbot .mb{flex:1 1 0;min-width:0;padding:9px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-color:transparent;background:none}
#kbot .mb.on{background:var(--k-tx);color:var(--k-ui)}
.mb[style*="--bsz"]{padding:calc(6px * var(--bsz)) calc(12px * var(--bsz))}
#kbot .mb[style*="--bsz"]{padding:calc(9px * var(--bsz)) 4px}
.kch[style*="--bsz"]{padding:calc(6px * var(--bsz)) calc(10px * var(--bsz))}
#kfree{position:fixed;left:0;top:0;width:0;height:0;z-index:12;font-size:13px}
#kfree>*{position:fixed;white-space:nowrap;box-shadow:0 2px 10px #0004}
html.kedit #kfree{z-index:31}
html.kpure #kfree{display:none}
html.kt body #card{z-index:14}
html.kbot-on #zoom{bottom:calc(var(--kbot-h,58px) + 10px)}
html.kbot-on #toast{bottom:calc(var(--kbot-h,58px) + 56px)!important}
@media(max-width:699px){html.kt.kbot-on body #card{bottom:calc(var(--kbot-h,58px) + 10px)}html.kt.kbot-on body #pane{bottom:calc(var(--kbot-h,58px) + 10px)}}
html.kpp body #pane:not(.moved){top:var(--kp-t)!important;bottom:var(--kp-b)!important;height:auto!important}
html.kcp body #card:not(.moved){top:var(--kc-t)!important;bottom:var(--kc-b)!important;height:auto!important}
html.kzoom-off #zoom{display:none}
html.kpure #menubar,html.kpure #kbot,html.kpure #zoom{display:none!important}
#kpx{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:80;border:var(--k-bw) solid var(--k-bd);background:var(--k-ui);color:var(--k-tx);border-radius:999px;padding:7px 16px;font:inherit;font-size:13px;cursor:pointer;transition:opacity .4s}
#kpx.fade{opacity:0;pointer-events:none}
.kmore{max-height:min(70vh,520px);overflow:auto;min-width:200px}
.kmore .hd{font-size:12px;opacity:.6;padding:8px 10px 2px}
/* ===== 編輯版面 ===== */
html.kedit #zoom,html.kedit #kbot{display:none!important}
html.kedit #menubar{pointer-events:auto;align-items:flex-start;max-height:calc(100vh - min(48vh,460px) - 40px);overflow-y:auto;overscroll-behavior:contain}
html.kedit.kemini #menubar{max-height:calc(100vh - 110px)}
.kz{display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start;min-height:36px;min-width:110px;padding:5px;border:1.5px dashed color-mix(in srgb,var(--k-tx) 30%,transparent);border-radius:calc(var(--k-r) + 2px);background:color-mix(in srgb,var(--k-ui) 80%,transparent)}
.kz:empty::before{content:attr(data-empty);opacity:.5;font-size:12px;padding:6px 4px}
.kz.over{border-color:var(--k-sel);border-style:solid}
.kch{position:relative;display:inline-flex;align-items:center;gap:4px;border:var(--k-bw) solid var(--k-bd);background:var(--k-btn);color:var(--k-tx);border-radius:var(--k-r);padding:6px 10px;cursor:grab;user-select:none;touch-action:none;font-size:13px;line-height:1.3}
.kch.fixed{cursor:default}
.kch.kfl{outline:1.5px dashed var(--k-sel);outline-offset:2px}
.kch .kx,.kgh .kx,.kgh .kgs{display:inline-grid;place-items:center;width:18px;height:18px;margin:-2px -4px -2px 2px;border-radius:50%;opacity:.55;cursor:pointer;font-style:normal;font-size:14px;line-height:1}
.kch .kx:hover,.kgh .kx:hover,.kgh .kgs:hover{opacity:1;background:color-mix(in srgb,var(--k-tx) 15%,transparent)}
.kch input,.kgh input{font:inherit;color:inherit;background:transparent;border:0;border-bottom:1px solid var(--k-sel);outline:none;width:7em;padding:0}
.kgr{display:flex;flex-direction:column;gap:4px;border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) + 2px);padding:5px;background:var(--k-ui);touch-action:pan-y}
.kgr>.kz{flex-direction:column;align-items:stretch;min-width:120px;border-style:dotted}
.kgh{display:flex;align-items:center;gap:4px;font-weight:600;padding:2px 2px 0}
.kgh .kgrip{cursor:grab;opacity:.5;padding:0 3px;touch-action:none;user-select:none}.kgh input{flex:1;width:6em;font-weight:600}
.kdrag{opacity:.3}
.kghost{position:fixed;z-index:200;pointer-events:none;opacity:.9;box-shadow:0 6px 20px #0006;transform:rotate(-2deg)}
.kghost.kfreego{transform:none;outline:2px solid var(--k-sel)}
.kins{box-shadow:-3px 0 0 var(--k-sel)}.kgr>.kz>.kins,.kgr>.kz>.kch.kins{box-shadow:0 -3px 0 var(--k-sel)}
.kz.kend{box-shadow:inset -3px 0 0 var(--k-sel)}
#kedit{position:fixed;left:12px;right:12px;bottom:12px;z-index:40;max-height:48vh;overflow:auto;background:var(--k-ui);color:var(--k-tx);border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) + 4px);padding:12px 14px;font-size:13px;box-shadow:0 -6px 30px #0005}
#kedit.mini>:not(.hd){display:none!important}#kedit.mini .hd{margin:0}
#kedit .hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}#kedit .hd b{font-size:15px;margin-right:auto}
#kedit .sub{font-size:12px;opacity:.65;margin:10px 0 5px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#kedit .sub label{display:inline-flex;gap:4px;align-items:center;opacity:1}
#kedit button.c{padding:5px 12px}
#kedit .note{font-size:12px;opacity:.6;margin:4px 0 0}
#kedit .kz[data-z="B"]{flex-wrap:wrap}
#kedit .kz[data-z="B"] .kch{flex:0 0 auto}
#kedit .krow{display:flex;gap:6px;flex-wrap:wrap}
/* 按鈕設定小框：一定在畫面裡面 */
#kbset{position:fixed;z-index:220;width:min(300px,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow:auto;box-sizing:border-box;background:var(--k-ui);color:var(--k-tx);border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) + 4px);padding:10px 12px;font-size:13px;box-shadow:0 8px 30px #0007}
#kbset .hd{display:flex;align-items:center;gap:8px;margin-bottom:8px}#kbset .hd b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#kbset .tr{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0;flex-wrap:wrap}
#kbset input[type=text]{flex:1;min-width:0;width:auto;font:inherit;color:inherit;background:transparent;border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) * .6);padding:5px 8px}
#kbset input[type=number]{font:inherit;color:inherit;background:transparent;border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) * .6)}
#kbset .krow{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}#kbset .c{padding:5px 12px}
@media(max-width:700px){#kbset input{font-size:16px!important}}
/* 功能框位置調整 */
#kadj{position:fixed;inset:0;z-index:90;background:#0006}
#kadjf{position:fixed;display:flex;flex-direction:column;border:2px solid var(--k-sel);border-radius:var(--k-r);background:color-mix(in srgb,var(--k-ui) 92%,transparent);color:var(--k-tx);box-shadow:0 8px 40px #0008;touch-action:none;font-size:13px}
#kadjf .kah{flex:none;height:30px;display:grid;place-items:center;cursor:ns-resize;touch-action:none;user-select:none}
#kadjf .kah::before{content:'';width:56px;height:5px;border-radius:9px;background:var(--k-sel)}
#kadjf .kam{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:move;user-select:none;padding:4px 10px;overflow:auto}
#kadjf .kam>*{cursor:auto}
#kadjf .seg{display:flex;gap:4px}#kadjf .tr{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center}
#kadjf input[type=number]{font:inherit;color:inherit;background:transparent;border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) * .6)}
#kadjf .kdev{opacity:.6;font-size:12px}
@media(max-width:700px){#kadjf input{font-size:16px!important}}
.kfold{cursor:pointer;user-select:none}
.kfold::before{content:'';display:inline-block;width:0;height:0;border-left:4.5px solid transparent;border-right:4.5px solid transparent;border-top:6px solid currentColor;margin-right:7px;vertical-align:2px;opacity:.6;transition:transform .15s}
.kfold.shut::before{transform:rotate(-90deg)}
.kfh{display:none!important}
fieldset.kfs-shut{padding-bottom:4px!important}
`));

// ---------- 上方列＋底部列＋自由擺放的按鈕（平常的樣子）----------
const bar = MN.bar, lf = bar.querySelector('.lf'), rt = bar.querySelector('.rt');
const botEl = h('nav', { id: 'kbot', hidden: true }); document.body.append(botEl);
const freeEl = h('div', { id: 'kfree' }); document.body.append(freeEl);
const groupItems = e => e.items.filter(f => !freeOf(f));   // 自由擺放出去的，不在組裡顯示
const entryBtn = (e, side, i) => {
  if (e.g == null) return freeOf(e.f) ? '' : `<button class="mb${side === 'L' ? ' pri' : ''}"${e.f === 'folder' ? ' data-hasf="1"' : ''} data-f="${e.f}"${styOf(BAR.sty[e.f])}>${E(label(e.f))}</button>`;
  const its = groupItems(e); if (!its.length) return '';
  const hf = its.includes('folder') ? ' data-hasf="1"' : '';
  if (its.length === 1) return `<button class="mb${side === 'L' ? ' pri' : ''}"${hf} data-f="${its[0]}"${styOf(e.sty || BAR.sty[its[0]])}>${E(e.g)}</button>`;
  return `<button class="mb"${hf} data-g="${side}:${i}"${styOf(e.sty)}>${E(e.g)} ▾</button>`;
};
function drawBar() {
  if (editing) return drawEdit();
  lf.innerHTML = BAR.L.map((e, i) => entryBtn(e, 'L', i)).join('');
  rt.innerHTML = BAR.R.map((e, i) => entryBtn(e, 'R', i)).join('');
  bindBtns(bar);
  document.documentElement.classList.toggle('kzoom-off', !BAR.zoom);
  drawBot(); drawFree(); MN.setTop();
}
function bindBtns(root) {
  root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => run(b.dataset.f));
  root.querySelectorAll('[data-g]').forEach(b => b.onclick = e => { e.stopPropagation(); const open = b.classList.contains('on'); MN.closePop(); hideMore();
    if (!open) { const [s, i] = b.dataset.g.split(':'); MN.openPop(b, { items: groupItems(BAR[s][+i]) }); } });
}
function drawBot() {
  const show = BOT.on && BOT.slots.length && (isNarrow() || BOT.desk) && !editing;
  botEl.hidden = !show; document.documentElement.classList.toggle('kbot-on', !!show);
  if (!show) return;
  botEl.innerHTML = BOT.slots.map(s => `<button class="mb" data-b="${s.f}"${styOf(s)}>${E(s.short || label(s.f))}</button>`).join('');
  botEl.querySelectorAll('[data-b]').forEach(b => b.onclick = e => { e.stopPropagation(); const f = b.dataset.b;
    if (f === 'more') { const open = b.classList.contains('on'); MN.closePop(); hideMore(); if (!open) more(b); return; }
    run(f); });
  document.documentElement.style.setProperty('--kbot-h', botEl.offsetHeight + 'px');
}
// 自由擺放：照「離最近的角多遠」放；畫面變小時推回畫面裡，也不會蓋到底部列
function placeFree(el, p) {
  const W = innerWidth, H = innerHeight, w = el.offsetWidth, hh = el.offsetHeight;
  let x = p.ax === 'r' ? W - w - p.dx : p.dx, y = p.ay === 'b' ? H - hh - p.dy : p.dy;
  x = Math.max(4, Math.min(x, W - w - 4)); y = Math.max(4, Math.min(y, H - hh - 4));
  if (!editing && !botEl.hidden) { const kb = botEl.getBoundingClientRect().top; if (y + hh > kb - 4) y = Math.max(4, kb - hh - 6); }
  el.style.left = x + 'px'; el.style.top = y + 'px';
}
function drawFree() {
  const fs = Object.keys(BAR.free).filter(f => ITEMS[f] && freeOf(f));
  freeEl.innerHTML = fs.map(f => editing ? chip(f, 'F', { noX: LOCK.has(f), cls: 'kfl', sty: BAR.sty[f] }) : `<button class="mb" data-f="${f}"${styOf(BAR.sty[f])}>${E(label(f))}</button>`).join('');
  [...freeEl.children].forEach(el => placeFree(el, freeOf(el.dataset.f || el.dataset.cf)));
  if (!editing) bindBtns(freeEl);
}
addEventListener('resize', () => { if (!editing) drawBot(); drawFree(); applyPP(); });

// ---------- 「全部功能」清單（底部列的「全部功能」、或放在上方的也可以）----------
let moreEl = null;
function hideMore() { if (moreEl) { moreEl.remove(); moreEl = null; document.querySelectorAll('.mb.on').forEach(b => b.classList.remove('on')); } }
function more(anchor) {
  MN.closePop(); hideMore();
  const all = [...BAR.L, ...BAR.R], sec = [];
  const one = all.filter(e => e.g == null || e.items.length === 1).map(e => e.g == null ? e.f : e.items[0]).filter(f => f !== 'more');
  if (one.length) sec.push(['', one]);
  all.filter(e => e.g != null && e.items.length > 1).forEach(e => sec.push([e.g, e.items.filter(f => f !== 'more')]));
  const tr = BAR.tray.filter(f => f !== 'more'); if (tr.length) sec.push(['收起來的', tr]);
  moreEl = h('div', { className: 'mpop kmore' }, `<div class="lst">${sec.map(([n, fs]) => (n ? `<div class="hd">${E(n)}</div>` : '') + fs.map(f => `<button data-f="${f}"><span>${E(label(f))}</span></button>`).join('')).join('')}</div>`);
  document.body.append(moreEl);
  moreEl.querySelectorAll('[data-f]').forEach(b => b.onclick = () => run(b.dataset.f));
  const btn = anchor && anchor.getBoundingClientRect ? anchor : null;
  if (btn) { btn.classList.add('on'); const r = btn.getBoundingClientRect();
    if (btn.closest('#kbot')) { moreEl.style.bottom = (innerHeight - r.top + 6) + 'px'; moreEl.style.right = Math.max(8, innerWidth - r.right) + 'px'; }
    else { moreEl.style.top = (r.bottom + 6) + 'px'; moreEl.style.right = Math.max(8, innerWidth - r.right) + 'px'; }
    if (moreEl.getBoundingClientRect().left < 8) { moreEl.style.right = 'auto'; moreEl.style.left = '8px'; }
    const mr = moreEl.getBoundingClientRect(); if (mr.bottom > innerHeight - 8) { moreEl.style.top = 'auto'; moreEl.style.bottom = '8px'; }
  } else { moreEl.style.top = 'calc(var(--ktop,56px))'; moreEl.style.right = '12px'; }
}
document.addEventListener('pointerdown', e => { if (moreEl && !moreEl.contains(e.target) && !e.target.closest('#kbot,#menubar,#kfree')) hideMore(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideMore(); });

// ---------- 純粹瀏覽：按鈕都藏起來；點畫面出現「退出」，Esc 也能退出 ----------
const px = h('button', { id: 'kpx', className: 'fade', textContent: '退出純粹瀏覽' }); document.body.append(px);
let pxT = 0;
function pure(on) {
  document.documentElement.classList.toggle('kpure', on); MN.closePop(); hideMore();
  if (on) { KN.closePane(); flash(); toast('純粹瀏覽：點一下畫面會出現「退出」，或按 Esc'); } else px.classList.add('fade');
}
function flash() { px.classList.remove('fade'); clearTimeout(pxT); pxT = setTimeout(() => px.classList.add('fade'), 3000); }
const isPure = () => document.documentElement.classList.contains('kpure');
px.onclick = () => pure(false);
document.addEventListener('pointerdown', e => { if (isPure() && e.target !== px) flash(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && isPure()) { pure(false); } }, true);

// ---------- 編輯版面：直接在畫面上拖 ----------
let editing = false, edEl = null, edMini = false;
const LOCK = new Set(['menu']);   // 不能收起來的
function edit() {
  if (editing) return;
  editing = true; MN.closePop(); hideMore(); KN.closePane(); pure(false);
  document.documentElement.classList.add('kedit');
  edEl = h('div', { id: 'kedit' }); document.body.append(edEl);
  drawEdit();
}
function done() { closeSet(); editing = false; document.documentElement.classList.remove('kedit', 'kemini'); if (edEl) edEl.remove(); edEl = null; drawBar(); }
// data-ix＝在清單裡的真正位置（有些功能自由擺放出去、不在區塊裡顯示，位置才不會算錯）
const chip = (f, from, opt = {}) => `<span class="kch${opt.fixed ? ' fixed' : ''}${opt.cls ? ' ' + opt.cls : ''}" data-cf="${f}" data-from="${from}"${opt.ix != null ? ` data-ix="${opt.ix}"` : ''}${styOf(opt.sty)}>${E(opt.text || label(f))}${opt.noX ? '' : '<i class="kx" title="' + (opt.xt || '收起來') + '">×</i>'}</span>`;
const zoneHtml = (side) => BAR[side].map((e, i) => e.g == null ? (freeOf(e.f) ? '' : chip(e.f, side, { noX: LOCK.has(e.f), ix: i, sty: BAR.sty[e.f] })) :
  `<div class="kgr" data-gi="${side}:${i}" data-ix="${i}"><div class="kgh"><span class="kgrip" title="拖這裡移動整組">⋮⋮</span><input value="${E(e.g)}" data-gn="${side}:${i}" title="組名（點一下改）"><i class="kgs" data-gs="${side}:${i}" title="這組按鈕的字大小、大小">⚙</i><i class="kx" data-gx="${side}:${i}" title="拆掉這組（裡面的功能收起來）">×</i></div>
   <div class="kz" data-z="${side}:${i}" data-empty="拖功能進來">${e.items.map((f, j) => freeOf(f) ? '' : chip(f, side + ':' + i, { noX: LOCK.has(f), ix: j, sty: BAR.sty[f] })).join('')}</div></div>`).join('');
function drawEdit() {
  closeSet();
  lf.innerHTML = `<div class="kz" data-z="L" data-empty="左上：拖到這裡">${zoneHtml('L')}</div>`;
  rt.innerHTML = `<div class="kz" data-z="R" data-empty="右上：拖到這裡">${zoneHtml('R')}</div>`;
  edEl.classList.toggle('mini', edMini); document.documentElement.classList.toggle('kemini', edMini);
  edEl.innerHTML = `<div class="hd"><b>編輯版面</b><button class="c" id="kemin">${edMini ? '展開' : '收合'}</button><button class="c" id="kegrp">＋ 新的組</button><button class="c" id="kedef">恢復預設</button><button class="c on" id="keok">完成</button></div>
   <p class="note">拖按鈕到上方、組裡、下面，或拖到畫面任何地方（自由擺放）；點一下按鈕可以改名字、字大小、按鈕大小；× 收起來。</p>
   <div class="sub"><span>手機底部列（最多 6 個）</span><label><input type="checkbox" id="kbon"${BOT.on ? ' checked' : ''}>顯示</label><label><input type="checkbox" id="kbdesk"${BOT.desk ? ' checked' : ''}>電腦也顯示</label></div>
   <div class="kz" data-z="B" data-empty="拖功能進來">${BOT.slots.map((s, i) => chip(s.f, 'B:' + i, { text: s.short || label(s.f), xt: '從底部列拿掉', ix: i, sty: s })).join('')}</div>
   <div class="sub"><span>收起來的功能（底部列的「全部功能」裡找得到）</span></div>
   <div class="kz" data-z="T" data-empty="把不常用的拖到這裡">${BAR.tray.map((f, i) => freeOf(f) ? '' : chip(f, 'T', { noX: true, ix: i, sty: BAR.sty[f] })).join('')}</div>
   <div class="sub"><span>功能框位置（${DEVNAME()}）</span></div>
   <div class="krow"><button class="c" id="kadjp">調整功能框</button><button class="c" id="kadjc">調整知識點卡片</button></div>
   <div class="sub"><label><input type="checkbox" id="kzm"${BAR.zoom ? ' checked' : ''}>顯示下方的「全貌＋縮放」列</label></div>`;
  drawFree(); MN.setTop();
  const $ = s => edEl.querySelector(s);
  $('#keok').onclick = done;
  $('#kemin').onclick = () => { edMini = !edMini; drawEdit(); };
  $('#kegrp').onclick = () => { BAR.R.push({ g: '新的組', items: [] }); saveBar(); drawEdit(); };
  $('#kedef').onclick = () => { if (!confirm('上方按鈕排列、名字、大小、自由擺放、底部列都恢復成預設？')) return; BAR = normBar(null); BOT = normBot(null); saveBar(); saveBot(); drawEdit(); };
  $('#kbon').onchange = e => { BOT.on = e.target.checked; saveBot(); };
  $('#kbdesk').onchange = e => { BOT.desk = e.target.checked; saveBot(); };
  $('#kzm').onchange = e => { BAR.zoom = e.target.checked; saveBar(); document.documentElement.classList.toggle('kzoom-off', !BAR.zoom); };
  $('#kadjp').onclick = () => frameAdj('p');
  $('#kadjc').onclick = () => frameAdj('c');
  document.querySelectorAll('[data-gn]').forEach(x => { x.onchange = () => { const [s, i] = x.dataset.gn.split(':'); BAR[s][+i].g = x.value.trim() || '未命名'; saveBar(); };
    x.onkeydown = e => { if (e.key === 'Enter') x.blur(); }; });
  document.querySelectorAll('[data-gx]').forEach(x => x.onclick = () => { const [s, i] = x.dataset.gx.split(':'); const g = BAR[s].splice(+i, 1)[0];
    g.items.forEach(f => LOCK.has(f) ? BAR[s].push({ f }) : BAR.tray.push(f)); saveBar(); drawEdit(); });
  document.querySelectorAll('[data-gs]').forEach(x => x.onclick = e => { e.stopPropagation(); groupSet(x.dataset.gs, x); });
}
// 某個區的清單：'L' 'R'＝上方左右（項目）；'L:2'＝組裡的功能；'T'＝收起來；'B'＝底部列
const listOf = z => z === 'T' ? BAR.tray : z === 'B' ? BOT.slots : z.includes(':') ? BAR[z[0]][+z.split(':')[1]].items : BAR[z];
function takeTop(f) {   // 從上方或收起來的地方拿掉一個功能
  BAR.tray = BAR.tray.filter(x => x !== f);
  ['L', 'R'].forEach(s => { BAR[s] = BAR[s].filter(e => e.f !== f); BAR[s].forEach(e => { if (e.items) e.items = e.items.filter(x => x !== f); }); });
}
function putTop(z, idx, f) { const L = listOf(z); const v = (z === 'L' || z === 'R') ? { f } : f; idx < 0 || idx > L.length ? L.push(v) : L.splice(idx, 0, v); }
function unFree(f) { if (!BAR.free[f]) return; delete BAR.free[f][DEV()]; if (!Object.keys(BAR.free[f]).length) delete BAR.free[f]; }
function moveF(f, from, z, idx) {
  if (z === 'T' && LOCK.has(f)) return toast('「' + label(f) + '」不能收起來，不然就回不到編輯版面了');
  if (from === 'F') unFree(f);
  if (z === 'B') {
    if (from.startsWith('B:')) { const i = +from.slice(2), s = BOT.slots.splice(i, 1)[0]; if (idx > i) idx--; idx < 0 ? BOT.slots.push(s) : BOT.slots.splice(idx, 0, s); }
    else { if (BOT.slots.length >= 6) return toast('底部列最多 6 個'); const s = { f }; idx < 0 ? BOT.slots.push(s) : BOT.slots.splice(idx, 0, s); }
    saveBar(); return saveBot();
  }
  if (from.startsWith('B:')) { BOT.slots.splice(+from.slice(2), 1); saveBot(); }   // 從底部列拖回上方＝底部列拿掉，上方移到放開的地方
  // 同一個清單裡往後移：拿掉自己後位置少一格
  const L = listOf(z), cur = L.findIndex(x => (x && x.f) === f || x === f);
  if (cur >= 0 && idx > cur) idx--;
  takeTop(f); putTop(z, idx, f); saveBar();
}
// 放到畫面任何地方：記住離最近的角多遠（手機、電腦分開記）
function setFree(f, from, r) {
  const W = innerWidth, H = innerHeight, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const p = { ax: cx < W / 2 ? 'l' : 'r', ay: cy < H / 2 ? 't' : 'b' };
  p.dx = Math.max(4, Math.round(p.ax === 'l' ? r.left : W - r.right)); p.dy = Math.max(4, Math.round(p.ay === 't' ? r.top : H - r.bottom));
  if (from.startsWith('B:')) { BOT.slots.splice(+from.slice(2), 1); saveBot(); }
  (BAR.free[f] = BAR.free[f] || {})[DEV()] = p; saveBar();
}
function moveG(gi, z, idx) {
  const [s, i] = gi.split(':'), g = BAR[s][+i];
  if (s === z && idx > +i) idx--;
  BAR[s].splice(+i, 1); idx < 0 || idx > BAR[z].length ? BAR[z].push(g) : BAR[z].splice(idx, 0, g); saveBar();
}

// ---------- 按鈕設定小框（點一下按鈕）：名字、字大小、按鈕大小；自由擺放的可以放回上方 ----------
let setEl = null;
function closeSet() { if (setEl) { setEl.remove(); setEl = null; } }
function placeSet(anchor) {   // 放在按鈕下面（放不下就上面），左右推回畫面裡；手機就貼齊左右
  const r = anchor.getBoundingClientRect(), W = innerWidth, H = innerHeight, sw = setEl.offsetWidth, sh = setEl.offsetHeight;
  let x = Math.min(Math.max(8, r.left), W - sw - 8), y = r.bottom + 8;
  if (y + sh > H - 8) y = r.top - sh - 8;
  if (y < 8) y = Math.max(8, (H - sh) / 2);
  setEl.style.left = Math.max(8, x) + 'px'; setEl.style.top = y + 'px';
}
function openSet(title, html, anchor, bind) {
  closeSet();
  setEl = h('div', { id: 'kbset' }, `<div class="hd"><b>${E(title)}</b><button class="c on" data-k="ok">完成</button></div>${html}`);
  document.body.append(setEl);
  setEl.querySelector('[data-k=ok]').onclick = () => { const a = document.activeElement; if (a && setEl.contains(a)) a.blur(); closeSet(); drawEdit(); };
  bind(setEl); placeSet(anchor);
  const t = setEl.querySelector('input[type=text]'); if (t && !matchMedia('(pointer:coarse)').matches) { t.focus(); t.select(); }
}
const sizeRows = s => `<div class="tr"><span>字大小</span>${MN.nb('data-ks="fs"', s.fs || 100, 50, 300, 5, '%')}</div><div class="tr"><span>按鈕大小</span>${MN.nb('data-ks="sz"', s.sz || 100, 50, 300, 5, '%')}</div>`;
// 改完立刻看到：只改那個按鈕的樣子，不整個重畫（小框才不會跳走）
const restyle = (sel, s) => document.querySelectorAll(sel).forEach(el => { el.style.removeProperty('font-size'); el.style.removeProperty('--bsz'); if (s && s.fs && s.fs !== 100) el.style.fontSize = s.fs / 100 + 'em'; if (s && s.sz && s.sz !== 100) el.style.setProperty('--bsz', s.sz / 100); });
function btnSet(el) {
  const f = el.dataset.cf, from = el.dataset.from, isB = from.startsWith('B:'), slot = isB ? BOT.slots[+from.slice(2)] : null;
  const s = isB ? slot : (BAR.sty[f] || {}), fl = from === 'F';
  const cur = isB ? (slot.short || label(f)) : label(f);
  openSet(ITEMS[f][0] + (isB ? '（底部列）' : fl ? '（自由擺放）' : ''), `
   <div class="tr"><span>名字</span><input type="text" data-ks="name" value="${E(cur)}" maxlength="${isB ? 8 : 20}"></div>
   ${sizeRows(s)}
   <div class="krow"><button class="c" data-k="def">大小恢復預設</button>${fl ? '<button class="c" data-k="back">放回上方</button>' : ''}</div>`, el, P => {
    const sel = `[data-cf="${f}"][data-from="${from}"]`;
    const put = () => { if (isB) { saveBot(); } else { if (s.fs || s.sz) BAR.sty[f] = s; else delete BAR.sty[f]; saveBar(); } restyle(sel, s); };
    MN.bindNb(P, (x, v) => { const k = x.dataset.ks; if (v === 100) delete s[k]; else s[k] = v; put(); });
    const nm = P.querySelector('[data-ks=name]');
    nm.onchange = () => { const v = nm.value.trim();
      if (isB) { if (v && v !== label(f)) slot.short = v; else delete slot.short; saveBot(); }
      else { if (v && v !== ITEMS[f][0]) BAR.names[f] = v; else delete BAR.names[f]; saveBar(); }
      document.querySelectorAll(sel).forEach(c => { if (c.firstChild && c.firstChild.nodeType === 3) c.firstChild.data = isB ? (slot.short || label(f)) : label(f); }); };
    nm.onkeydown = e => { if (e.key === 'Enter') nm.blur(); };
    P.querySelector('[data-k=def]').onclick = () => { delete s.fs; delete s.sz; put(); P.querySelectorAll('[data-ks=fs],[data-ks=sz]').forEach(i => i.value = i.defaultValue = 100); };
    const bk = P.querySelector('[data-k=back]'); if (bk) bk.onclick = () => { unFree(f); saveBar(); closeSet(); drawEdit(); };
  });
}
function groupSet(gi, anchor) {
  const [sd, i] = gi.split(':'), g = BAR[sd][+i], s = Object.assign({}, g.sty || {});
  openSet('組：' + g.g, `<div class="tr"><span>組名</span><input type="text" data-ks="name" value="${E(g.g)}" maxlength="20"></div>${sizeRows(s)}
   <div class="krow"><button class="c" data-k="def">大小恢復預設</button></div>`, anchor, P => {
    const put = () => { if (s.fs || s.sz) g.sty = Object.assign({}, s); else delete g.sty; saveBar(); };
    MN.bindNb(P, (x, v) => { const k = x.dataset.ks; if (v === 100) delete s[k]; else s[k] = v; put(); });
    const nm = P.querySelector('[data-ks=name]'); nm.onchange = () => { g.g = nm.value.trim() || '未命名'; saveBar(); const gin = document.querySelector(`[data-gn="${gi}"]`); if (gin) gin.value = g.g; };
    nm.onkeydown = e => { if (e.key === 'Enter') nm.blur(); };
    P.querySelector('[data-k=def]').onclick = () => { delete s.fs; delete s.sz; put(); P.querySelectorAll('[data-ks=fs],[data-ks=sz]').forEach(x => x.value = x.defaultValue = 100); };
  });
}
document.addEventListener('pointerdown', e => { if (setEl && !setEl.contains(e.target) && !e.target.closest('.kch,.kgs')) { const a = document.activeElement; if (a && setEl.contains(a)) a.blur(); closeSet(); } }, true);

// 拖曳（滑鼠和手指都能用；不用 HTML5 拖放，手機上才拖得動）
let D = null;
const zonesFor = kind => [...document.querySelectorAll('#menubar .kz, #kedit .kz')].filter(z => kind === 'g' ? (z.dataset.z === 'L' || z.dataset.z === 'R') : true);
function clearMarks() { document.querySelectorAll('.kins').forEach(x => x.classList.remove('kins')); document.querySelectorAll('.kz.over,.kz.kend').forEach(x => x.classList.remove('over', 'kend')); }
function target(x, y) {
  const el = document.elementFromPoint(x, y); if (!el) return null;
  let z = el.closest('.kz');
  if (!z) return D.kind === 'f' && !el.closest('#kedit,#menubar,#kbset') ? { free: true } : null;   // 拖到畫面空的地方＝自由擺放
  if (D.kind === 'g') { while (z && !(z.dataset.z === 'L' || z.dataset.z === 'R')) z = z.parentElement.closest('.kz'); if (!z) return null; }
  if (!zonesFor(D.kind).includes(z)) return null;
  const kids = [...z.children].filter(c => (c.classList.contains('kch') || c.classList.contains('kgr')) && c !== D.el);
  const vert = z.parentElement.classList.contains('kgr');
  let idx = -1, before = null;
  for (let k = 0; k < kids.length; k++) { const r = kids[k].getBoundingClientRect();
    if (vert ? y < r.top + r.height / 2 : (y < r.top) || (y < r.bottom && x < r.left + r.width / 2)) { before = kids[k]; break; } }
  if (before) idx = +before.dataset.ix;
  return { z, idx, before };
}
document.addEventListener('pointerdown', e => {
  if (!editing || e.button > 0) return;
  if (e.target.closest('.kx,.kgs,input,#kbset')) return;
  const c = e.target.closest('.kch'), g = !c && e.target.closest('.kgrip');
  if (!c && !g) return;
  const el = c || g.closest('.kgr');
  D = { kind: c ? 'f' : 'g', el, sx: e.clientX, sy: e.clientY, id: e.pointerId, moved: false };
  e.preventDefault();
});
addEventListener('pointermove', e => {
  if (!D || e.pointerId !== D.id) return;
  if (!D.moved) { if (Math.abs(e.clientX - D.sx) + Math.abs(e.clientY - D.sy) < 6) return;
    D.moved = true; closeSet(); const r = D.el.getBoundingClientRect(); D.dx = D.sx - r.left; D.dy = D.sy - r.top;   // 手指按下的那一點，不是開始移動的那一點（放下時才不會偏）
    D.ghost = D.el.cloneNode(true); D.ghost.classList.add('kghost'); D.ghost.style.width = r.width + 'px'; D.ghost.style.left = D.ghost.style.top = ''; document.body.append(D.ghost); D.el.classList.add('kdrag');
    document.documentElement.classList.add('kdrag-move'); }
  D.ghost.style.left = (e.clientX - D.dx) + 'px'; D.ghost.style.top = (e.clientY - D.dy) + 'px';
  clearMarks(); const t = target(e.clientX, e.clientY); D.t = t;
  D.ghost.classList.toggle('kfreego', !!(t && t.free));
  if (t && !t.free) { t.z.classList.add('over'); if (t.before) t.before.classList.add('kins'); else t.z.classList.add('kend'); }
  // 拖到編輯框邊緣時自動捲
  { const mb = document.getElementById('menubar'), r = mb.getBoundingClientRect(); if (e.clientY < r.top + 30 && e.clientY > r.top) mb.scrollTop -= 8; else if (e.clientY > r.bottom - 30 && e.clientY < r.bottom) mb.scrollTop += 8; }   // 上方區塊也會自動捲
  if (edEl) { const r = edEl.getBoundingClientRect(); if (e.clientY > r.top && e.clientY < r.top + 30) edEl.scrollTop -= 8; else if (e.clientY > r.bottom - 30 && e.clientY < r.bottom) edEl.scrollTop += 8; }
});
addEventListener('pointerup', e => {
  if (!D || e.pointerId !== D.id) return;
  if (D.moved) D.t = target(e.clientX, e.clientY);   // 照放開的那一點算（不只看最後一次移動）
  const d = D; D = null; clearMarks(); document.documentElement.classList.remove('kdrag-move');
  const gr = d.ghost ? (r => ({ left: e.clientX - d.dx, top: e.clientY - d.dy, width: r.width, height: r.height, right: e.clientX - d.dx + r.width, bottom: e.clientY - d.dy + r.height }))(d.ghost.getBoundingClientRect()) : null;
  if (d.ghost) d.ghost.remove(); d.el.classList.remove('kdrag');
  if (!d.moved) { if (d.kind === 'f' && !d.el.classList.contains('fixed')) btnSet(d.el); return; }
  if (!d.t) return;
  if (d.t.free) { setFree(d.el.dataset.cf, d.el.dataset.from, gr); drawEdit(); return; }
  const z = d.t.z.dataset.z;
  if (d.kind === 'g') moveG(d.el.dataset.gi, z, d.t.idx);
  else moveF(d.el.dataset.cf, d.el.dataset.from, z, d.t.idx);
  drawEdit();
});
addEventListener('pointercancel', () => { if (D) { if (D.ghost) D.ghost.remove(); D.el.classList.remove('kdrag'); clearMarks(); D = null; } });
document.addEventListener('click', e => {   // × 收起來／從底部列拿掉
  if (!editing) return; const x = e.target.closest('.kch .kx'); if (!x) return;
  const c = x.closest('.kch'), f = c.dataset.cf, from = c.dataset.from;
  if (from.startsWith('B:')) { BOT.slots.splice(+from.slice(2), 1); saveBot(); }
  else { if (LOCK.has(f)) return; unFree(f); takeTop(f); BAR.tray.push(f); saveBar(); }
  drawEdit();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && setEl) { closeSet(); return; } if (editing && e.key === 'Escape' && !e.target.closest('input') && !document.getElementById('kadj')) done(); });

// ---------- 功能框／知識點卡片的位置：拖中間整個上下移，拖上緣、下緣改高度（手機、電腦分開記）----------
let PP = store.get('panepos', {});
const card = document.getElementById('card'), pane = KN.pane;
const zoomOf = el => parseFloat(getComputedStyle(el).zoom) || 1;
function fitTB(s, H) { const t = Math.max(0, Math.min(s.t, H - 140)), b = Math.max(0, Math.min(s.b, H - t - 140)); return { t, b }; }
function applyPP() {
  const r = document.documentElement, d = PP[DEV()] || {}, H = innerHeight;
  [['p', 'kpp', '--kp', pane], ['c', 'kcp', '--kc', card]].forEach(([k, cls, v, el]) => {
    const s = d[k]; r.classList.toggle(cls, !!s); if (!s) return;
    const { t, b } = fitTB(s, H), z = zoomOf(el);
    r.style.setProperty(v + '-t', t / z + 'px'); r.style.setProperty(v + '-b', b / z + 'px');
  });
}
// 沒調過時的位置：暫時打開一個空的框量一下
function measure(which) {
  const el = which === 'p' ? pane : card, cls = which === 'p' ? 'kpp' : 'kcp', r0 = document.documentElement, had = r0.classList.contains(cls);
  const keep = { hidden: el.hidden, cls: el.className, css: el.style.cssText };
  r0.classList.remove(cls); el.style.cssText = 'visibility:hidden'; if (which === 'p') el.className = ''; else el.classList.remove('moved'); el.hidden = false;
  const r = el.getBoundingClientRect();
  el.hidden = keep.hidden; el.className = keep.cls; el.style.cssText = keep.css; if (had) r0.classList.add(cls);
  return { l: r.left, w: r.width, t: Math.round(r.top), b: Math.round(innerHeight - r.bottom) };
}
function frameAdj(which) {
  const back = editing; if (editing) done();
  KN.closePane(); const cardWas = !card.hidden; card.hidden = true; MN.closePop(); hideMore();
  const ov = h('div', { id: 'kadj' }); document.body.append(ov);
  let cur = which, geo, tb;
  const fr = h('div', { id: 'kadjf' }); ov.append(fr);
  function load() { geo = measure(cur); const s = (PP[DEV()] || {})[cur]; tb = fitTB(s || { t: geo.t, b: geo.b }, innerHeight); }
  function draw() {
    fr.innerHTML = `<div class="kah" data-h="t" title="拖這裡改上緣"></div><div class="kam" data-h="m">
      <div class="seg"><button class="c${cur === 'p' ? ' on' : ''}" data-w="p">功能框</button><button class="c${cur === 'c' ? ' on' : ''}" data-w="c">知識點卡片</button></div>
      <div class="tr"><span>上緣</span>${MN.nb('data-e="t"', tb.t, 0, 2000, 1, 'px')}</div>
      <div class="tr"><span>下緣</span>${MN.nb('data-e="b"', tb.b, 0, 2000, 1, 'px')}</div>
      <div class="tr"><button class="c" data-k="def">恢復預設</button><button class="c on" data-k="ok">完成</button></div>
      <div class="kdev">${DEVNAME()}・拖上下邊改高度，拖中間整個移</div></div><div class="kah" data-h="b" title="拖這裡改下緣"></div>`;
    pos();
    fr.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { cur = b.dataset.w; load(); draw(); });
    MN.bindNb(fr, (x, v) => { tb[x.dataset.e] = v; tb = fitTB(tb, innerHeight); save(); pos(false); });
    fr.querySelector('[data-k=def]').onclick = () => { const d = PP[DEV()]; if (d) { delete d[cur]; if (!Object.keys(d).length) delete PP[DEV()]; } store.set('panepos', PP); applyPP(); load(); draw(); };
    fr.querySelector('[data-k=ok]').onclick = finish;
  }
  function pos(sync = true) {
    Object.assign(fr.style, { left: geo.l + 'px', width: geo.w + 'px', top: tb.t + 'px', bottom: tb.b + 'px' });
    if (sync) fr.querySelectorAll('[data-e]').forEach(i => { if (document.activeElement !== i) i.value = i.defaultValue = Math.round(tb[i.dataset.e]); });
  }
  function save() { (PP[DEV()] = PP[DEV()] || {})[cur] = { t: Math.round(tb.t), b: Math.round(tb.b) }; store.set('panepos', PP); applyPP();
    if (cur === 'c') { const W = store.get('winpos', {}); if (W.card) { delete W.card; store.set('winpos', W); MN.reloadWin(); } } }   // 卡片之前拖過的位置不要了，照這裡的
  let g = null;
  fr.addEventListener('pointerdown', e => {
    const hd = e.target.closest('[data-h]'); if (!hd || e.target.closest('button,input,.nb,.seg')) return;
    e.preventDefault(); try { fr.setPointerCapture(e.pointerId); } catch (er) {}
    g = { id: e.pointerId, h: hd.dataset.h, y: e.clientY, t: tb.t, b: tb.b };
  });
  fr.addEventListener('pointermove', e => { if (!g || e.pointerId !== g.id) return; const dy = e.clientY - g.y, H = innerHeight;
    if (g.h === 't') tb.t = Math.max(0, Math.min(g.t + dy, H - g.b - 140));
    else if (g.h === 'b') tb.b = Math.max(0, Math.min(g.b - dy, H - g.t - 140));
    else { const d2 = Math.max(-g.t, Math.min(dy, g.b)); tb.t = g.t + d2; tb.b = g.b - d2; }
    pos(); });
  const up = e => { if (!g || e.pointerId !== g.id) return; g = null; save(); };
  fr.addEventListener('pointerup', up); fr.addEventListener('pointercancel', up);
  const onRs = () => { load(); pos(); }; addEventListener('resize', onRs);
  const onKey = e => { if (e.key === 'Escape') finish(); }; document.addEventListener('keydown', onKey);
  function finish() { removeEventListener('resize', onRs); document.removeEventListener('keydown', onKey); ov.remove(); if (cardWas) card.hidden = false; toast('功能框位置已記住（' + DEVNAME() + '）'); if (back) edit(); }
  load(); draw();
}

// ---------- 面板裡的段落：點標題收合，記住（每個面板各自記）----------
const FOLD = store.get('fold', {});
const HEADS = '.lk .sec, .sy h4, .aiset fieldset>legend, #pbody .ksec, .edp .tr.blk>b, .edp>.ksec';
const pbody = KN.pbody;
const fkey = hd => (pane.dataset.k || '') + '|' + [...hd.childNodes].filter(n => !(n.classList && n.classList.contains('q'))).map(n => n.textContent).join('').replace(/[（(]\d+[）)]/g, '').trim();
function bodyOf(hd) {
  if (hd.tagName === 'LEGEND') return [...hd.parentElement.children].filter(c => c !== hd);
  if (hd.matches('.tr.blk>b')) return [...hd.parentElement.children].filter(c => c !== hd);
  const out = []; let n = hd.nextElementSibling; const sel = hd.matches('.sec') ? '.sec' : hd.matches('h4') ? 'h4' : '.ksec';
  while (n && !n.matches(sel)) { out.push(n); n = n.nextElementSibling; }
  return out;
}
function setFold(hd, shut) { hd.classList.toggle('shut', shut); bodyOf(hd).forEach(x => x.classList.toggle('kfh', shut)); if (hd.tagName === 'LEGEND') hd.parentElement.classList.toggle('kfs-shut', shut); }
function folds() {
  pbody.querySelectorAll(HEADS).forEach(hd => {
    if (!bodyOf(hd).length) return;
    if (!hd.classList.contains('kfold')) { hd.classList.add('kfold'); hd.title = '點一下收合／展開'; }
    setFold(hd, !!FOLD[fkey(hd)]);
  });
}
let fT = 0; new MutationObserver(() => { cancelAnimationFrame(fT); fT = requestAnimationFrame(folds); }).observe(pbody, { childList: true, subtree: true });
pbody.addEventListener('click', e => {
  const hd = e.target.closest('.kfold'); if (!hd || e.target.closest('.q,button,input,select,a')) return;
  const k = fkey(hd), shut = !hd.classList.contains('shut'); if (shut) FOLD[k] = true; else delete FOLD[k]; store.set('fold', FOLD); setFold(hd, shut);
});

// ---------- 字大小：整個介面＋各區塊（選單、面板、卡片、底部）----------
// 做法：所有樣式裡的 font-size: Npx 換成 calc(Npx * var(--kfs))，各區塊再設自己的 --kfs
const AREAS = { menu: ['選單和按鈕', '#menubar,.mpop,#kedit,#khelp,#kfree,#kbset'], pane: ['面板', '#pane'], card: ['知識點卡片', '#card,#tip'], bot: ['底部（縮放列、底部列）', '#zoom,#kbot,#toast,#kpx'] };
const FSZ0 = { all: 1, menu: 1, pane: 1, card: 1, bot: 1 };
let FSZ = Object.assign({}, FSZ0, store.get('fsz', {}));
const fszStyle = h('style'); document.head.append(fszStyle);
function scaleRules(rules) {
  for (const r of rules) {
    if (r.cssRules && !r.style) { scaleRules(r.cssRules); continue; }
    if (!r.style) continue;
    const v = r.style.getPropertyValue('font-size'), m = /^([\d.]+)px$/.exec(v.trim());
    if (m) r.style.setProperty('font-size', `calc(${m[1]}px * var(--kfs, 1))`, r.style.getPropertyPriority('font-size'));
  }
}
const scaled = new WeakMap();
function scaleSheets() {
  for (const el of document.querySelectorAll('style')) {
    if (el === fszStyle || !el.sheet) continue;
    if (scaled.get(el) === el.sheet) continue;   // 同一份樣式只換一次（內容改了會是新的 sheet）
    try { scaleRules(el.sheet.cssRules); } catch (e) {}
    scaled.set(el, el.sheet);
  }
}
function applyFsz() {
  const a = FSZ.all, r = document.documentElement;
  r.style.setProperty('--kfs', a);
  fszStyle.textContent = `body{font-size:calc(16px * var(--kfs,1))}` + Object.keys(AREAS).map(k => `${AREAS[k][1]}{--kfs:${+(a * FSZ[k]).toFixed(3)}}`).join('');
  scaleSheets(); MN.setTop(); if (!editing) drawBot(); drawFree();
}
new MutationObserver(() => scaleSheets()).observe(document.head, { childList: true, subtree: true, characterData: true });
const saveFsz = () => { store.set('fsz', FSZ); applyFsz(); };
KN.fsz = {
  // 直接打數字（30%～300%），或按 −／＋
  rows: (row, nb) => row('介面字大小', nb('data-fz="all"', Math.round(FSZ.all * 100), 30, 300, 5, '%'), '') +
    Object.keys(AREAS).map(k => row('　' + AREAS[k][0], nb(`data-fz="${k}"`, Math.round(FSZ[k] * 100), 30, 300, 5, '%'))).join('') +
    row('', '<button class="c" id="fzdef">字大小恢復預設</button>'),
  set(k, v) { if (!(k in FSZ)) return; FSZ[k] = v; saveFsz(); },
  bind(P) { const d = P.querySelector('#fzdef'); if (d) d.onclick = () => { FSZ = Object.assign({}, FSZ0); saveFsz(); MN.lookPane(); }; } };

// ---------- 給別的檔案用 ----------
KN.layout = { edit, done, pure, more: () => more(null), draw: drawBar, frameAdj,
  reload() { BAR = normBar(store.get('bar', null)); BOT = normBot(store.get('bottom', null)); FSZ = Object.assign({}, FSZ0, store.get('fsz', {})); PP = store.get('panepos', {});
    Object.keys(FOLD).forEach(k => delete FOLD[k]); Object.assign(FOLD, store.get('fold', {})); applyFsz(); applyPP(); drawBar(); folds(); },
  get pureOn() { return isPure(); } };
applyFsz(); applyPP(); drawBar();
// 外觀的「介面大小」改了以後（CSS zoom），框的位置要重算
new MutationObserver(applyPP).observe(document.head, { childList: true, subtree: true, characterData: true });
})();
