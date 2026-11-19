// 按鈕排列、畫面上直接編輯、手機底部列、純粹瀏覽、面板分段收合、各區塊字大小（11/13，參考 love-record 後 Door 選的）
// 資料：
//   bar   ＝上方列 { L:[項目], R:[項目], tray:[收起來的功能], names:{功能:改過的名字}, zoom:縮放列要不要顯示 }
//          項目＝{ f:功能 }（單獨一個鈕）或 { g:組名, items:[功能…] }（下拉選單；只有一個功能時直接按）
//   bottom＝手機底部列 { on, desk:電腦也顯示, slots:[{ f, short:底部列上的短名字 }] }
//   fsz   ＝字大小 { all:整個介面, menu:選單和按鈕, pane:面板, card:卡片, bot:底部（縮放列、底部列） }
//   fold  ＝面板裡收起來的段落 { '面板|段落標題': true }
(() => {
const KN = window.KN, { h, toast } = KN, MN = KN.menu, ITEMS = MN.ITEMS, E = MN.E;
const clone = o => JSON.parse(JSON.stringify(o));
const NARROW = 700;
const isNarrow = () => innerWidth < NARROW;

// ---------- 預設＋讀進來時整理（未知的功能拿掉、少的補上，舊的「整理選單」設定搬過來）----------
const DEFBAR = { L: [{ f: 'add' }, { f: 'qa' }],
  R: [{ g: '回顧', items: ['recent', 'grow', 'tour', 'tm'] }, { g: '整理', items: ['lasso', 'hist', 'topics'] }, { f: 'look' }, { g: '設定', items: ['ed', 'ai', 'folder', 'menu', 'pure'] }],
  tray: ['new', 'home', 'mode', 'more'], names: {}, zoom: true };
const DEFBOT = { on: true, desk: false, slots: [{ f: 'add', short: '丟東西' }, { f: 'qa' }, { f: 'recent' }, { f: 'more' }] };
function fromOld(m) {   // 11/7 版的 menu2 { groups:[{name,items}], pins:[] }
  const b = { L: m.pins.map(f => ({ f })), R: [], tray: [], names: {}, zoom: true };
  m.groups.forEach(g => { if (g.items.length === 1) { b.R.push({ f: g.items[0] }); if (g.name !== ITEMS[g.items[0]]?.[0]) b.names[g.items[0]] = g.name; } else b.R.push({ g: g.name, items: g.items.slice() }); });
  return b;
}
function normBar(raw) {
  const b = Object.assign(clone(DEFBAR), raw || {}), seen = new Set();
  const ok = f => ITEMS[f] && !seen.has(f) && seen.add(f);
  ['L', 'R'].forEach(s => { b[s] = (b[s] || []).filter(e => e && (e.g != null ? Array.isArray(e.items) : true)).map(e => e.g != null ? { g: String(e.g || '未命名'), items: e.items.filter(ok) } : e).filter(e => e.g != null || ok(e.f)); });
  b.tray = (b.tray || []).filter(ok);
  b.names = Object.fromEntries(Object.entries(b.names || {}).filter(([k, v]) => ITEMS[k] && v));
  Object.keys(ITEMS).forEach(f => { if (seen.has(f)) return;   // 新加的功能：純粹瀏覽放進有「編輯版面」的那組，其他先收起來
    const g = f === 'pure' && [...b.L, ...b.R].find(e => e.items && e.items.includes('menu'));
    if (g) g.items.push(f); else b.tray.push(f); seen.add(f); });
  if (b.tray.includes('menu')) { b.tray = b.tray.filter(f => f !== 'menu'); b.R.push({ f: 'menu' }); }   // 「編輯版面」不能收起來，不然回不來
  return b;
}
function normBot(raw) {
  const b = Object.assign(clone(DEFBOT), raw || {});
  b.slots = (b.slots || []).filter(s => s && ITEMS[s.f]).slice(0, 6).map(s => ({ f: s.f, ...(s.short ? { short: String(s.short).slice(0, 8) } : {}) }));
  return b;
}
let BAR = normBar(store.get('bar', null) || (store.get('menu2', null) ? fromOld(store.get('menu2')) : null));
let BOT = normBot(store.get('bottom', null));
const saveBar = () => store.set('bar', BAR), saveBot = () => store.set('bottom', BOT);
const label = f => BAR.names[f] || ITEMS[f][0];
const PANE_T = { new: '新增知識點' };   // 按鈕名和面板標題不一樣的
KN.paneTitle = t => { const nm = Object.assign({}, ...(BOT.slots || []).filter(x => x.short).map(x => ({ [x.f]: x.short })), BAR.names);   // 上方改的名字優先，其次是底部列改的
  for (const f in nm) { const d = PANE_T[f] || (ITEMS[f] && ITEMS[f][0]), c = nm[f]; if (!d || !c) continue; if (t === d) return c; if (t.startsWith(d + '：')) return c + t.slice(d.length); } return t; };
MN.setNameOf(label);
const run = f => { MN.closePop(); hideMore(); ITEMS[f][2](); };

// ---------- 樣式 ----------
document.head.append(h('style', {}, `
#menubar .lf,#menubar .rt{min-height:1px}
#kbot{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:28;display:flex;gap:6px;padding:6px;border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) + 4px);background:var(--k-ui);font-size:13px}
#kbot .mb{flex:1 1 0;min-width:0;padding:9px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-color:transparent;background:none}
#kbot .mb.on{background:var(--k-tx);color:var(--k-ui)}
html.kbot-on #zoom{bottom:calc(var(--kbot-h,58px) + 10px)}
html.kbot-on #toast{bottom:calc(var(--kbot-h,58px) + 56px)!important}
@media(max-width:640px){html.kbot-on #card{bottom:calc(var(--kbot-h,58px) + 10px)}html.kbot-on #pane.side{bottom:calc(var(--kbot-h,58px) + 10px)}}
html.kzoom-off #zoom{display:none}
html.kpure #menubar,html.kpure #kbot,html.kpure #zoom{display:none!important}
#kpx{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:80;border:var(--k-bw) solid var(--k-bd);background:var(--k-ui);color:var(--k-tx);border-radius:999px;padding:7px 16px;font:inherit;font-size:13px;cursor:pointer;transition:opacity .4s}
#kpx.fade{opacity:0;pointer-events:none}
.kmore{max-height:min(70vh,520px);overflow:auto;min-width:200px}
.kmore .hd{font-size:12px;opacity:.6;padding:8px 10px 2px}
/* ===== 編輯版面 ===== */
html.kedit #zoom,html.kedit #kbot{display:none!important}
html.kedit #menubar{pointer-events:auto;align-items:flex-start;max-height:calc(100vh - min(48vh,460px) - 40px);overflow-y:auto;overscroll-behavior:contain}
.kz{display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start;min-height:36px;min-width:110px;padding:5px;border:1.5px dashed color-mix(in srgb,var(--k-tx) 30%,transparent);border-radius:calc(var(--k-r) + 2px);background:color-mix(in srgb,var(--k-ui) 80%,transparent)}
.kz:empty::before{content:attr(data-empty);opacity:.5;font-size:12px;padding:6px 4px}
.kz.over{border-color:var(--k-sel);border-style:solid}
.kch{position:relative;display:inline-flex;align-items:center;gap:4px;border:var(--k-bw) solid var(--k-bd);background:var(--k-btn);color:var(--k-tx);border-radius:var(--k-r);padding:6px 10px;cursor:grab;user-select:none;touch-action:none;font-size:13px;line-height:1.3}
.kch.fixed{cursor:default}
.kch .kx,.kgh .kx{display:inline-grid;place-items:center;width:18px;height:18px;margin:-2px -4px -2px 2px;border-radius:50%;opacity:.55;cursor:pointer;font-style:normal;font-size:14px;line-height:1}
.kch .kx:hover,.kgh .kx:hover{opacity:1;background:color-mix(in srgb,var(--k-tx) 15%,transparent)}
.kch input,.kgh input{font:inherit;color:inherit;background:transparent;border:0;border-bottom:1px solid var(--k-sel);outline:none;width:7em;padding:0}
.kgr{display:flex;flex-direction:column;gap:4px;border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) + 2px);padding:5px;background:var(--k-ui);touch-action:pan-y}
.kgr>.kz{flex-direction:column;align-items:stretch;min-width:120px;border-style:dotted}
.kgh{display:flex;align-items:center;gap:4px;font-weight:600;padding:2px 2px 0}
.kgh .kgrip{cursor:grab;opacity:.5;padding:0 3px;touch-action:none;user-select:none}.kgh input{flex:1;width:6em;font-weight:600}
.kdrag{opacity:.3}
.kghost{position:fixed;z-index:200;pointer-events:none;opacity:.9;box-shadow:0 6px 20px #0006;transform:rotate(-2deg)}
.kins{box-shadow:-3px 0 0 var(--k-sel)}.kgr>.kz>.kins,.kgr>.kz>.kch.kins{box-shadow:0 -3px 0 var(--k-sel)}
.kz.kend{box-shadow:inset -3px 0 0 var(--k-sel)}
#kedit{position:fixed;left:12px;right:12px;bottom:12px;z-index:40;max-height:48vh;overflow:auto;background:var(--k-ui);color:var(--k-tx);border:var(--k-bw) solid var(--k-bd);border-radius:calc(var(--k-r) + 4px);padding:12px 14px;font-size:13px;box-shadow:0 -6px 30px #0005}
#kedit .hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}#kedit .hd b{font-size:15px;margin-right:auto}
#kedit .sub{font-size:12px;opacity:.65;margin:10px 0 5px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#kedit .sub label{display:inline-flex;gap:4px;align-items:center;opacity:1}
#kedit button.c{padding:5px 12px}
#kedit .note{font-size:12px;opacity:.6;margin:4px 0 0}
#kedit .kz[data-z="B"]{flex-wrap:wrap}
#kedit .kz[data-z="B"] .kch{flex:0 0 auto}
.kfold{cursor:pointer;user-select:none}
.kfold::before{content:'';display:inline-block;width:0;height:0;border-left:4.5px solid transparent;border-right:4.5px solid transparent;border-top:6px solid currentColor;margin-right:7px;vertical-align:2px;opacity:.6;transition:transform .15s}
.kfold.shut::before{transform:rotate(-90deg)}
.kfh{display:none!important}
fieldset.kfs-shut{padding-bottom:4px!important}
.lk .fz{display:flex;align-items:center;gap:4px}.lk .fz button{min-width:30px;padding:2px 8px}.lk .fz .v{min-width:3.2em;text-align:center}
`));

// ---------- 上方列＋底部列（平常的樣子）----------
const bar = MN.bar, lf = bar.querySelector('.lf'), rt = bar.querySelector('.rt');
const botEl = h('nav', { id: 'kbot', hidden: true }); document.body.append(botEl);
const entryBtn = (e, side, i) => {
  if (e.g == null) return `<button class="mb${side === 'L' ? ' pri' : ''}"${e.f === 'folder' ? ' data-hasf="1"' : ''} data-f="${e.f}">${E(label(e.f))}</button>`;
  if (!e.items.length) return '';
  const hf = e.items.includes('folder') ? ' data-hasf="1"' : '';
  if (e.items.length === 1) return `<button class="mb${side === 'L' ? ' pri' : ''}"${hf} data-f="${e.items[0]}">${E(e.g)}</button>`;
  return `<button class="mb"${hf} data-g="${side}:${i}">${E(e.g)} ▾</button>`;
};
function drawBar() {
  if (editing) return drawEdit();
  lf.innerHTML = BAR.L.map((e, i) => entryBtn(e, 'L', i)).join('');
  rt.innerHTML = BAR.R.map((e, i) => entryBtn(e, 'R', i)).join('');
  bindBtns(bar);
  document.documentElement.classList.toggle('kzoom-off', !BAR.zoom);
  drawBot(); MN.setTop();
}
function bindBtns(root) {
  root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => run(b.dataset.f));
  root.querySelectorAll('[data-g]').forEach(b => b.onclick = e => { e.stopPropagation(); const open = b.classList.contains('on'); MN.closePop(); hideMore();
    if (!open) { const [s, i] = b.dataset.g.split(':'); MN.openPop(b, { items: BAR[s][+i].items }); } });
}
function drawBot() {
  const show = BOT.on && BOT.slots.length && (isNarrow() || BOT.desk) && !editing;
  botEl.hidden = !show; document.documentElement.classList.toggle('kbot-on', !!show);
  if (!show) return;
  botEl.innerHTML = BOT.slots.map(s => `<button class="mb" data-b="${s.f}">${E(s.short || label(s.f))}</button>`).join('');
  botEl.querySelectorAll('[data-b]').forEach(b => b.onclick = e => { e.stopPropagation(); const f = b.dataset.b;
    if (f === 'more') { const open = b.classList.contains('on'); MN.closePop(); hideMore(); if (!open) more(b); return; }
    run(f); });
  document.documentElement.style.setProperty('--kbot-h', botEl.offsetHeight + 'px');
}
addEventListener('resize', () => { if (!editing) drawBot(); });

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
  } else { moreEl.style.top = 'calc(var(--ktop,56px))'; moreEl.style.right = '12px'; }
}
document.addEventListener('pointerdown', e => { if (moreEl && !moreEl.contains(e.target) && !e.target.closest('#kbot,#menubar')) hideMore(); });
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
let editing = false, edEl = null;
const LOCK = new Set(['menu']);   // 不能收起來的
function edit() {
  if (editing) return;
  editing = true; MN.closePop(); hideMore(); KN.closePane(); pure(false);
  document.documentElement.classList.add('kedit');
  edEl = h('div', { id: 'kedit' }); document.body.append(edEl);
  drawEdit();
}
function done() { editing = false; document.documentElement.classList.remove('kedit'); if (edEl) edEl.remove(); edEl = null; drawBar(); }
const chip = (f, from, opt = {}) => `<span class="kch${opt.fixed ? ' fixed' : ''}" data-cf="${f}" data-from="${from}">${E(opt.text || label(f))}${opt.noX ? '' : '<i class="kx" title="' + (opt.xt || '收起來') + '">×</i>'}</span>`;
const zoneHtml = (side) => BAR[side].map((e, i) => e.g == null ? chip(e.f, side, { noX: LOCK.has(e.f) }) :
  `<div class="kgr" data-gi="${side}:${i}"><div class="kgh"><span class="kgrip" title="拖這裡移動整組">⋮⋮</span><input value="${E(e.g)}" data-gn="${side}:${i}" title="組名（點一下改）"><i class="kx" data-gx="${side}:${i}" title="拆掉這組（裡面的功能收起來）">×</i></div>
   <div class="kz" data-z="${side}:${i}" data-empty="拖功能進來">${e.items.map(f => chip(f, side + ':' + i, { noX: LOCK.has(f) })).join('')}</div></div>`).join('');
function drawEdit() {
  lf.innerHTML = `<div class="kz" data-z="L" data-empty="左上：拖到這裡">${zoneHtml('L')}</div>`;
  rt.innerHTML = `<div class="kz" data-z="R" data-empty="右上：拖到這裡">${zoneHtml('R')}</div>`;
  edEl.innerHTML = `<div class="hd"><b>編輯版面</b><button class="c" id="kegrp">＋ 新的組</button><button class="c" id="kedef">恢復預設</button><button class="c on" id="keok">完成</button></div>
   <p class="note">拖曳按鈕到上方左邊、右邊、組裡，或拖到下面；點一下按鈕可以改名；× 收起來。組名直接點來改，拖 ⋮⋮ 移動整組。</p>
   <div class="sub"><span>手機底部列（最多 6 個；從上面拖功能進來）</span><label><input type="checkbox" id="kbon"${BOT.on ? ' checked' : ''}>顯示</label><label><input type="checkbox" id="kbdesk"${BOT.desk ? ' checked' : ''}>電腦也顯示</label></div>
   <div class="kz" data-z="B" data-empty="拖功能進來">${BOT.slots.map((s, i) => chip(s.f, 'B:' + i, { text: s.short || label(s.f), xt: '從底部列拿掉' })).join('')}</div>
   <div class="sub"><span>收起來的功能（不會出現在上方；底部列的「全部功能」裡找得到）</span></div>
   <div class="kz" data-z="T" data-empty="把不常用的拖到這裡">${BAR.tray.map(f => chip(f, 'T', { noX: true })).join('')}</div>
   <div class="sub"><label><input type="checkbox" id="kzm"${BAR.zoom ? ' checked' : ''}>顯示下方的「全貌＋縮放」列</label></div>`;
  MN.setTop();
  const $ = s => edEl.querySelector(s);
  $('#keok').onclick = done;
  $('#kegrp').onclick = () => { BAR.R.push({ g: '新的組', items: [] }); saveBar(); drawEdit(); };
  $('#kedef').onclick = () => { if (!confirm('上方按鈕排列、名字、底部列都恢復成預設？')) return; BAR = normBar(null); BOT = normBot(null); saveBar(); saveBot(); drawEdit(); };
  $('#kbon').onchange = e => { BOT.on = e.target.checked; saveBot(); };
  $('#kbdesk').onchange = e => { BOT.desk = e.target.checked; saveBot(); };
  $('#kzm').onchange = e => { BAR.zoom = e.target.checked; saveBar(); document.documentElement.classList.toggle('kzoom-off', !BAR.zoom); };
  document.querySelectorAll('[data-gn]').forEach(x => { x.onchange = () => { const [s, i] = x.dataset.gn.split(':'); BAR[s][+i].g = x.value.trim() || '未命名'; saveBar(); };
    x.onkeydown = e => { if (e.key === 'Enter') x.blur(); }; });
  document.querySelectorAll('[data-gx]').forEach(x => x.onclick = () => { const [s, i] = x.dataset.gx.split(':'); const g = BAR[s].splice(+i, 1)[0];
    g.items.forEach(f => LOCK.has(f) ? BAR[s].push({ f }) : BAR.tray.push(f)); saveBar(); drawEdit(); });
}
// 某個區的清單：'L' 'R'＝上方左右（項目）；'L:2'＝組裡的功能；'T'＝收起來；'B'＝底部列
const listOf = z => z === 'T' ? BAR.tray : z === 'B' ? BOT.slots : z.includes(':') ? BAR[z[0]][+z.split(':')[1]].items : BAR[z];
function takeTop(f) {   // 從上方或收起來的地方拿掉一個功能
  BAR.tray = BAR.tray.filter(x => x !== f);
  ['L', 'R'].forEach(s => { BAR[s] = BAR[s].filter(e => e.f !== f); BAR[s].forEach(e => { if (e.items) e.items = e.items.filter(x => x !== f); }); });
}
function putTop(z, idx, f) { const L = listOf(z); const v = (z === 'L' || z === 'R') ? { f } : f; idx < 0 || idx > L.length ? L.push(v) : L.splice(idx, 0, v); }
function moveF(f, from, z, idx) {
  if (z === 'T' && LOCK.has(f)) return toast('「' + label(f) + '」不能收起來，不然就回不到編輯版面了');
  if (z === 'B') {
    if (from.startsWith('B:')) { const i = +from.slice(2), s = BOT.slots.splice(i, 1)[0]; if (idx > i) idx--; idx < 0 ? BOT.slots.push(s) : BOT.slots.splice(idx, 0, s); }
    else { if (BOT.slots.length >= 6) return toast('底部列最多 6 個'); const s = { f }; idx < 0 ? BOT.slots.push(s) : BOT.slots.splice(idx, 0, s); }
    return saveBot();
  }
  if (from.startsWith('B:')) { BOT.slots.splice(+from.slice(2), 1); saveBot(); }   // 從底部列拖回上方＝底部列拿掉，上方移到放開的地方
  // 同一個清單裡往後移：拿掉自己後位置少一格
  const L = listOf(z), cur = L.findIndex(x => (x && x.f) === f || x === f);
  if (cur >= 0 && idx > cur) idx--;
  takeTop(f); putTop(z, idx, f); saveBar();
}
function moveG(gi, z, idx) {
  const [s, i] = gi.split(':'), g = BAR[s][+i];
  if (s === z && idx > +i) idx--;
  BAR[s].splice(+i, 1); idx < 0 || idx > BAR[z].length ? BAR[z].push(g) : BAR[z].splice(idx, 0, g); saveBar();
}
function rename(el) {
  const f = el.dataset.cf, from = el.dataset.from, isB = from.startsWith('B:'), slot = isB ? BOT.slots[+from.slice(2)] : null;
  const cur = isB ? (slot.short || label(f)) : label(f);
  el.innerHTML = `<input value="${E(cur)}" maxlength="${isB ? 8 : 20}">`; const inp = el.querySelector('input'); inp.focus(); inp.select();
  let ok = false; const fin = () => { if (ok) return; ok = true; const v = inp.value.trim();
    if (isB) { if (v && v !== label(f)) slot.short = v; else delete slot.short; saveBot(); }
    else { if (v && v !== ITEMS[f][0]) BAR.names[f] = v; else delete BAR.names[f]; saveBar(); }
    drawEdit(); };
  inp.onblur = fin; inp.onkeydown = e => { if (e.key === 'Enter') fin(); if (e.key === 'Escape') { ok = true; drawEdit(); } };
}
// 拖曳（滑鼠和手指都能用；不用 HTML5 拖放，手機上才拖得動）
let D = null;
const zonesFor = kind => [...document.querySelectorAll('#menubar .kz, #kedit .kz')].filter(z => kind === 'g' ? (z.dataset.z === 'L' || z.dataset.z === 'R') : true);
function clearMarks() { document.querySelectorAll('.kins').forEach(x => x.classList.remove('kins')); document.querySelectorAll('.kz.over,.kz.kend').forEach(x => x.classList.remove('over', 'kend')); }
function target(x, y) {
  const el = document.elementFromPoint(x, y); if (!el) return null;
  let z = el.closest('.kz'); if (!z) return null;
  if (D.kind === 'g') { while (z && !(z.dataset.z === 'L' || z.dataset.z === 'R')) z = z.parentElement.closest('.kz'); if (!z) return null; }
  if (!zonesFor(D.kind).includes(z)) return null;
  const kids = [...z.children].filter(c => (c.classList.contains('kch') || c.classList.contains('kgr')) && c !== D.el);
  const vert = z.parentElement.classList.contains('kgr');
  let idx = -1, before = null;
  for (let k = 0; k < kids.length; k++) { const r = kids[k].getBoundingClientRect();
    if (vert ? y < r.top + r.height / 2 : (y < r.top) || (y < r.bottom && x < r.left + r.width / 2)) { before = kids[k]; break; } }
  if (before) { const all = [...z.children].filter(c => c.classList.contains('kch') || c.classList.contains('kgr')); idx = all.indexOf(before); }
  return { z, idx, before };
}
document.addEventListener('pointerdown', e => {
  if (!editing || e.button > 0) return;
  if (e.target.closest('.kx,input')) return;
  const c = e.target.closest('.kch'), g = !c && e.target.closest('.kgrip');
  if (!c && !g) return;
  const el = c || g.closest('.kgr');
  D = { kind: c ? 'f' : 'g', el, sx: e.clientX, sy: e.clientY, id: e.pointerId, moved: false };
  e.preventDefault();
});
addEventListener('pointermove', e => {
  if (!D || e.pointerId !== D.id) return;
  if (!D.moved) { if (Math.abs(e.clientX - D.sx) + Math.abs(e.clientY - D.sy) < 6) return;
    D.moved = true; const r = D.el.getBoundingClientRect(); D.dx = e.clientX - r.left; D.dy = e.clientY - r.top;
    D.ghost = D.el.cloneNode(true); D.ghost.classList.add('kghost'); D.ghost.style.width = r.width + 'px'; document.body.append(D.ghost); D.el.classList.add('kdrag');
    document.documentElement.classList.add('kdrag-move'); }
  D.ghost.style.left = (e.clientX - D.dx) + 'px'; D.ghost.style.top = (e.clientY - D.dy) + 'px';
  clearMarks(); const t = target(e.clientX, e.clientY); D.t = t;
  if (t) { t.z.classList.add('over'); if (t.before) t.before.classList.add('kins'); else t.z.classList.add('kend'); }
  // 拖到編輯框邊緣時自動捲
  { const mb = document.getElementById('menubar'), r = mb.getBoundingClientRect(); if (e.clientY < r.top + 30) mb.scrollTop -= 8; else if (e.clientY > r.bottom - 30 && e.clientY < r.bottom) mb.scrollTop += 8; }   // 上方區塊也會自動捲
  if (edEl) { const r = edEl.getBoundingClientRect(); if (e.clientY > r.top && e.clientY < r.top + 30) edEl.scrollTop -= 8; else if (e.clientY > r.bottom - 30 && e.clientY < r.bottom) edEl.scrollTop += 8; }
});
addEventListener('pointerup', e => {
  if (!D || e.pointerId !== D.id) return;
  const d = D; D = null; clearMarks(); document.documentElement.classList.remove('kdrag-move');
  if (d.ghost) d.ghost.remove(); d.el.classList.remove('kdrag');
  if (!d.moved) { if (d.kind === 'f' && !d.el.classList.contains('fixed')) rename(d.el); return; }
  if (!d.t) return;
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
  else { if (LOCK.has(f)) return; takeTop(f); BAR.tray.push(f); saveBar(); }
  drawEdit();
});
document.addEventListener('keydown', e => { if (editing && e.key === 'Escape' && !e.target.closest('input')) done(); });

// ---------- 面板裡的段落：點標題收合，記住（每個面板各自記）----------
const FOLD = store.get('fold', {});
const HEADS = '.lk .sec, .sy h4, .aiset fieldset>legend, #pbody .ksec, .edp .tr.blk>b, .edp>.ksec';
const pbody = KN.pbody, pane = KN.pane;
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
const AREAS = { menu: ['選單和按鈕', '#menubar,.mpop,#kedit,#khelp'], pane: ['面板', '#pane'], card: ['知識點卡片', '#card,#tip'], bot: ['底部（縮放列、底部列）', '#zoom,#kbot,#toast,#kpx'] };
let FSZ = Object.assign({ all: 1, menu: 1, pane: 1, card: 1, bot: 1 }, store.get('fsz', {}));
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
  scaleSheets(); MN.setTop(); if (!editing) drawBot();
}
new MutationObserver(() => scaleSheets()).observe(document.head, { childList: true, subtree: true, characterData: true });
const saveFsz = () => { store.set('fsz', FSZ); applyFsz(); };
const pctT = v => Math.round(v * 100) + '%';
KN.fsz = {
  rows: row => row('介面字大小', `<span class="fz"><button class="c" data-fz="all" data-d="-1">A−</button><span class="v">${pctT(FSZ.all)}</span><button class="c" data-fz="all" data-d="1">A+</button></span>`, '只放大縮小介面上的字（選單、面板、卡片），按鈕和框的大小不變；「介面大小」是整個一起縮放') +
    Object.keys(AREAS).map(k => row('　' + AREAS[k][0], `<span class="fz"><button class="c" data-fz="${k}" data-d="-1">A−</button><span class="v">${pctT(FSZ[k])}</span><button class="c" data-fz="${k}" data-d="1">A+</button></span>`)).join('') +
    row('', '<button class="c" id="fzdef">字大小恢復預設</button>'),
  bind(P) {
    P.querySelectorAll('[data-fz]').forEach(b => b.onclick = () => { const k = b.dataset.fz; FSZ[k] = Math.max(.7, Math.min(1.8, Math.round((FSZ[k] + .05 * +b.dataset.d) * 100) / 100)); saveFsz(); b.parentElement.querySelector('.v').textContent = pctT(FSZ[k]); });
    const d = P.querySelector('#fzdef'); if (d) d.onclick = () => { FSZ = { all: 1, menu: 1, pane: 1, card: 1, bot: 1 }; saveFsz(); MN.lookPane(); };
  } };

// ---------- 給別的檔案用 ----------
KN.layout = { edit, done, pure, more: () => more(null), draw: drawBar,
  reload() { BAR = normBar(store.get('bar', null)); BOT = normBot(store.get('bottom', null)); FSZ = Object.assign({ all: 1, menu: 1, pane: 1, card: 1, bot: 1 }, store.get('fsz', {}));
    Object.keys(FOLD).forEach(k => delete FOLD[k]); Object.assign(FOLD, store.get('fold', {})); applyFsz(); drawBar(); folds(); },
  get pureOn() { return isPure(); } };
applyFsz(); drawBar();
})();
