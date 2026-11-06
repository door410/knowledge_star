// 上方分組選單（06 第 31 輪）：5 組小圓角塊、只有字、可直接拖曳整理、自己選哪些露出；外觀面板；介面深／淺；知識網的字（大小、顏色、字體、匯入字體）
(() => {
const KN = window.KN, { h, toast } = KN;
const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clk = id => { const b = document.getElementById(id); if (b) b.click(); };
const fb = t => { const b = [...document.querySelectorAll('#fbar .c')].find(b => b.textContent === t); if (b) b.click(); };
const aiBtn = () => document.querySelector('#aiBar button');
const lasso = () => [...document.querySelectorAll('#zoom .c')].find(b => b.textContent === '圈選');
const ITEMS = {
  add: ['丟東西進去', () => clk('addBtn')], new: ['＋ 知識點', () => clk('newBtn')],
  look: ['外觀', () => lookPop()], filter: ['篩選', () => window.knEd && knEd('custom', 'filter')], home: ['全貌', () => clk('home')],
  qa: ['問答', () => fb('問答')], recent: ['最近消化', () => fb('最近消化')], grow: ['每月成長', () => window.knReview && knReview('grow')], tour: ['導覽', () => window.knReview && knReview('tour')], tm: ['時光機', () => window.knReview && knReview('tm')],
  lasso: ['圈選', () => { const b = lasso(); if (b) b.click(); }], ed: ['編輯台', () => window.knEd && knEd('custom')], hist: ['知識內容復原', () => window.knEd && knEd('hist')], eval: ['評估成績表', () => window.knEd && knEd('eval')],
  ai: ['AI 設定', () => { const b = aiBtn(); if (b) b.click(); }], folder: ['連上資料夾', () => clk('folderBtn')], keys: ['介面與快捷鍵', () => window.knEd && knEd('custom', 'ui')], menu: ['整理選單', () => editMode()] };
const DEFM = { groups: [{ name: '收進來', items: ['add', 'new'] }, { name: '看', items: ['look', 'filter', 'home'] }, { name: '回顧', items: ['qa', 'recent', 'grow', 'tour', 'tm'] },
  { name: '整理', items: ['lasso', 'ed', 'hist', 'eval'] }, { name: '設定', items: ['ai', 'folder', 'keys', 'menu'] }], pins: ['add', 'qa'] };
const clone = o => JSON.parse(JSON.stringify(o));
let M = store.get('menu', null) || clone(DEFM);
const fix = () => { const seen = new Set(M.groups.flatMap(g => g.items)); M.groups.forEach(g => g.items = g.items.filter(i => ITEMS[i]));
  Object.keys(ITEMS).forEach(i => { if (!seen.has(i)) M.groups[M.groups.length - 1].items.push(i); }); M.pins = M.pins.filter(i => ITEMS[i]); };
fix();
const saveM = () => store.set('menu', M);

// ---------- 樣式 ----------
document.head.append(h('style', {}, `
html.uil body{--fg:#2b2d31;--sub:#777;--panel:#ffffffee;--line:#0000001f;--chip:#fffa;--chipOn:#45484E;--chipOnFg:#fff}
html.uid body{--fg:#ddd;--sub:#888;--panel:#0d0e10ee;--line:#ffffff22;--chip:#111a;--chipOn:#eee;--chipOnFg:#000}
html.uil #pane{background:#fff;color:#2b2d31;border-color:#0002}html.uid #pane{background:#111316;color:#ddd;border-color:#ffffff22}
html.uil .c{border-color:#bbb}html.uid .c{border-color:#444}
#ui{display:none}#hint,#demoBtn,#fbar,#aiBar{display:none!important}#linePanel{z-index:40}
#menubar{position:fixed;left:12px;right:12px;top:10px;z-index:30;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;pointer-events:none}
#menubar>*{pointer-events:auto}
.mb{border:1px solid var(--line);background:var(--panel);color:var(--fg);border-radius:10px;padding:6px 12px;font:inherit;cursor:pointer;backdrop-filter:blur(8px)}
.mb.on{background:var(--chipOn);color:var(--chipOnFg)}.msep{width:10px}
.mpop{position:fixed;z-index:35;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:12px;padding:6px;display:flex;flex-direction:column;min-width:150px;backdrop-filter:blur(10px);font-size:13px}
.mpop>button{background:none;border:0;color:inherit;text-align:left;padding:7px 10px;border-radius:8px;font:inherit;cursor:pointer}.mpop>button:hover{background:var(--line)}
#lookPop{padding:12px 14px;gap:10px;max-width:min(420px,calc(100vw - 24px));max-height:calc(100vh - 80px);overflow:auto}
#lookPop #ui{display:flex;position:static;flex-direction:column;align-items:flex-start;gap:10px;background:none;padding:0;font-size:13px}
#lookPop .lr{display:flex;align-items:center;gap:8px;flex-wrap:wrap}#lookPop .lr>b{min-width:5.5em;font-weight:normal;opacity:.75}
#menuEd{position:fixed;left:12px;right:12px;top:52px;z-index:34;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:14px;padding:12px;display:flex;gap:10px;align-items:flex-start;overflow-x:auto;font-size:13px;backdrop-filter:blur(10px)}
#menuEd .col{min-width:130px;border:1px dashed var(--line);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px;min-height:80px}
#menuEd .col input{background:transparent;color:inherit;border:0;border-bottom:1px solid var(--line);font:inherit;font-weight:bold;width:100%}
#menuEd .chip{border:1px solid var(--line);border-radius:8px;padding:5px 9px;cursor:grab;background:var(--chip);user-select:none}
#menuEd .col.pins{border-style:solid}#menuEd .col.over{outline:2px solid #9B7BFF}#menuEd .tools{display:flex;flex-direction:column;gap:6px}
#menuEd .x{float:right;cursor:pointer;opacity:.6;margin-left:6px}`));

// ---------- 介面深／淺、知識網的字 ----------
const LK = Object.assign({ ui: 'dark', fs: null, fc: '', ff: 'system-ui' }, store.get('look2', {}));
const applyLK = () => { document.documentElement.classList.toggle('uil', LK.ui === 'light'); document.documentElement.classList.toggle('uid', LK.ui !== 'light');
  KNX.fc = LK.fc; KNX.ff = LK.ff; dirty = true; };
const saveLK = () => { store.set('look2', LK); applyLK(); };
const fdb = new Promise((res, rej) => { const o = indexedDB.open('kn-fonts', 1); o.onupgradeneeded = () => o.result.createObjectStore('f'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
const fst = (mode, fn) => fdb.then(d => new Promise((res, rej) => { const t = d.transaction('f', mode), r = fn(t.objectStore('f')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
const FONTS = [['system-ui', '系統預設'], ['"Microsoft JhengHei"', '微軟正黑體'], ['"PingFang TC","Noto Sans TC"', '蘋方／思源黑體'], ['"PMingLiU","MingLiU"', '新細明體'], ['"DFKai-SB","BiauKai"', '標楷體']];
const custom = [];
(async () => { try { const keys = await fst('readonly', s => s.getAllKeys());
  for (const k of keys) { const buf = await fst('readonly', s => s.get(k)); const f = new FontFace('kn-' + k, buf); await f.load(); document.fonts.add(f); custom.push(k); }
  dirty = true; } catch (e) {} })();

// ---------- 選單列 ----------
const bar = h('div', { id: 'menubar' }); document.body.append(bar);
let pop = null;
const closePop = () => { if (pop) { pop.remove(); pop = null; bar.querySelectorAll('.mb.on').forEach(b => b.classList.remove('on')); } };
function drawBar() {
  bar.innerHTML = M.groups.map((g, i) => `<button class="mb" data-g="${i}">${E(g.name)} ▾</button>`).join('') + (M.pins.length ? '<span class="msep"></span>' + M.pins.map(i => `<button class="mb" data-p="${i}">${ITEMS[i][0]}</button>`).join('') : '');
  bar.querySelectorAll('[data-g]').forEach(b => b.onclick = e => { e.stopPropagation(); const open = b.classList.contains('on'); closePop(); if (open) return;
    b.classList.add('on'); const r = b.getBoundingClientRect(); pop = h('div', { className: 'mpop' }); pop.style.left = r.left + 'px'; pop.style.top = (r.bottom + 6) + 'px';
    pop.innerHTML = M.groups[+b.dataset.g].items.map(i => `<button data-i="${i}">${ITEMS[i][0]}</button>`).join('') || '<span class="note" style="padding:6px">（空的）</span>';
    pop.querySelectorAll('[data-i]').forEach(x => x.onclick = () => { closePop(); ITEMS[x.dataset.i][1](); }); document.body.append(pop); });
  bar.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { closePop(); ITEMS[b.dataset.p][1](); });
}
document.addEventListener('pointerdown', e => { if (pop && !pop.contains(e.target) && !bar.contains(e.target) && !(document.getElementById('linePanel') || {}).contains?.(e.target) && e.target.type !== 'color') closePop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

// ---------- 外觀面板（把原本上方的看的設定搬進來）----------
const uiEl = document.getElementById('ui');
function lookPop() {
  closePop(); const b = bar.querySelector('[data-g]'); pop = h('div', { className: 'mpop', id: 'lookPop' });
  const btn = [...bar.children].find(x => x.dataset.p === 'look') || bar.querySelector(`[data-g="${M.groups.findIndex(g => g.items.includes('look'))}"]`) || b, r = btn.getBoundingClientRect();
  pop.style.left = Math.min(r.left, innerWidth - 440) + 'px'; pop.style.top = (r.bottom + 6) + 'px';
  pop.innerHTML = `<div class="lr"><b>介面</b><button class="c${LK.ui !== 'light' ? ' on' : ''}" data-u="dark">深</button><button class="c${LK.ui === 'light' ? ' on' : ''}" data-u="light">淺</button></div><div id="lkui"></div>
   <div class="lr"><b>知識網的字</b><input type="range" id="lkfs" min=".8" max="2" step=".1" value="${KNX.fs}"><span class="note" id="lkfsv">${Math.round(KNX.fs * 100)}%</span></div>
   <div class="lr"><b>字的顏色</b><label><input type="checkbox" id="lkfca"${LK.fc ? '' : ' checked'}>自動</label><input type="color" id="lkfc" value="${LK.fc || '#dddddd'}"></div>
   <div class="lr"><b>字體</b><select id="lkff">${[...FONTS, ...custom.map(k => [`"kn-${k}"`, k + '（匯入）'])].map(([v, t]) => `<option value='${E(v)}'${v === LK.ff ? ' selected' : ''}>${E(t)}</option>`).join('')}</select>
    <label class="c" style="cursor:pointer">匯入字體<input type="file" id="lkimp" accept=".ttf,.otf,.woff,.woff2" hidden></label></div>`;
  pop.querySelector('#lkui').append(uiEl); document.body.append(pop);
  pop.querySelectorAll('[data-u]').forEach(x => x.onclick = () => { LK.ui = x.dataset.u; saveLK(); pop.querySelectorAll('[data-u]').forEach(y => y.classList.toggle('on', y === x)); });
  const fs = pop.querySelector('#lkfs'); fs.oninput = () => { KNX.fs = +fs.value; pop.querySelector('#lkfsv').textContent = Math.round(fs.value * 100) + '%'; dirty = true;
    if (window.knSetED) knSetED('fs', +fs.value); };
  const fca = pop.querySelector('#lkfca'), fc = pop.querySelector('#lkfc');
  fca.onchange = () => { LK.fc = fca.checked ? '' : fc.value; saveLK(); }; fc.oninput = () => { fca.checked = false; LK.fc = fc.value; saveLK(); };
  pop.querySelector('#lkff').onchange = e => { LK.ff = e.target.value; saveLK(); };
  pop.querySelector('#lkimp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try {
    const k = f.name.replace(/\.[^.]+$/, '').replace(/["'<>]/g, ''), buf = await f.arrayBuffer(), ff = new FontFace('kn-' + k, buf); await ff.load(); document.fonts.add(ff);
    await fst('readwrite', s => s.put(buf, k)); if (!custom.includes(k)) custom.push(k); LK.ff = `"kn-${k}"`; saveLK(); toast('已匯入字體：' + k); lookPop(); } catch (er) { toast('這個字體檔讀不了：' + er.message, 6000); } };
}
// 關掉外觀面板時，把設定元件放回去（藏著）
new MutationObserver(() => { if (!document.getElementById('lookPop') && uiEl.parentElement !== document.body) document.body.append(uiEl); }).observe(document.body, { childList: true });

// ---------- 整理選單：直接拖曳 ----------
function editMode() {
  closePop(); let ed = document.getElementById('menuEd'); if (ed) ed.remove(); ed = h('div', { id: 'menuEd' }); document.body.append(ed);
  const draw = () => {
    ed.innerHTML = M.groups.map((g, gi) => `<div class="col" data-gi="${gi}"><div><input value="${E(g.name)}" data-n="${gi}">${g.items.length ? '' : `<span class="x" data-dg="${gi}" title="刪除這組">×</span>`}</div>${g.items.map(i => `<div class="chip" draggable="true" data-i="${i}" data-from="${gi}">${ITEMS[i][0]}</div>`).join('')}</div>`).join('') +
      `<div class="col pins" data-pins="1"><b>露出在上方</b>${M.pins.map(i => `<div class="chip" draggable="true" data-i="${i}" data-from="pins">${ITEMS[i][0]}<span class="x" data-up="${i}">×</span></div>`).join('')}<span class="note">把功能拖進來</span></div>
       <div class="tools"><button class="go" id="meok">好了</button><button class="go sub" id="meadd">＋ 新的組</button><button class="go sub" id="medef">恢復預設</button></div>`;
    ed.querySelectorAll('[data-n]').forEach(x => x.onchange = () => { M.groups[+x.dataset.n].name = x.value.trim() || '未命名'; saveM(); drawBar(); });
    ed.querySelectorAll('[data-dg]').forEach(x => x.onclick = () => { M.groups.splice(+x.dataset.dg, 1); saveM(); drawBar(); draw(); });
    ed.querySelectorAll('[data-up]').forEach(x => x.onclick = () => { M.pins = M.pins.filter(i => i !== x.dataset.up); saveM(); drawBar(); draw(); });
    ed.querySelectorAll('.chip').forEach(c => c.ondragstart = e => e.dataTransfer.setData('text/plain', c.dataset.i + '|' + c.dataset.from));
    ed.querySelectorAll('.col').forEach(col => {
      col.ondragover = e => { e.preventDefault(); col.classList.add('over'); }; col.ondragleave = () => col.classList.remove('over');
      col.ondrop = e => { e.preventDefault(); col.classList.remove('over'); const [id, from] = e.dataTransfer.getData('text/plain').split('|'); if (!ITEMS[id]) return;
        const before = e.target.closest('.chip') ? e.target.closest('.chip').dataset.i : null;
        if (col.dataset.pins) { M.pins = M.pins.filter(i => i !== id); const k = before ? M.pins.indexOf(before) : -1; k >= 0 ? M.pins.splice(k, 0, id) : M.pins.push(id); }
        else { const g = M.groups[+col.dataset.gi]; if (from === 'pins') { M.pins = M.pins.filter(i => i !== id); }
          else { M.groups.forEach(x => x.items = x.items.filter(i => i !== id)); const k = before ? g.items.indexOf(before) : -1; k >= 0 ? g.items.splice(k, 0, id) : g.items.push(id); } }
        saveM(); drawBar(); draw(); };
    });
    ed.querySelector('#meok').onclick = () => ed.remove();
    ed.querySelector('#meadd').onclick = () => { M.groups.push({ name: '新的組', items: [] }); saveM(); drawBar(); draw(); };
    ed.querySelector('#medef').onclick = () => { M = clone(DEFM); fix(); saveM(); drawBar(); draw(); };
  };
  draw();
}

// ---------- 其他整理：圈選鈕收進選單、示範點關掉 ----------
const lb = lasso(); if (lb) lb.style.display = 'none';
if (st.demo) { st.demo = false; save(); build(); ui(); enterMode(); }
applyLK(); drawBar();
})();
