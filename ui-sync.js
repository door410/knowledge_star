// 介面設定同步（11/13）：手機和電腦調的介面，每台自己勾哪幾類要跟別台同步
// 做法：每台只寫自己的檔「04-知識網/介面設定/<裝置>.json」（跟著知識網資料一起同步到雲端硬碟，所以不會互相蓋掉、也不會出現「兩台同時改過」），
// 讀別台的檔，有勾的那幾類，誰改得比較晚就用誰的。沒勾的類別：不送出、也不收。
(() => {
const V = window.KNVFS, KN = window.KN; if (!V || !KN) return;
const { h, toast } = KN, E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DIR = '04-知識網/介面設定/';
const raw = k => { try { const v = localStorage.getItem('kn.' + k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } };
const put = (k, v) => { try { if (v == null) localStorage.removeItem('kn.' + k); else localStorage.setItem('kn.' + k, JSON.stringify(v)); } catch (e) {} };
const omit = (o, ks) => { if (!o) return o; const r = { ...o }; ks.forEach(k => delete r[k]); return r; };
const hash = s => { let x = 5381; for (let i = 0; i < s.length; i++) x = (x * 33 ^ s.charCodeAt(i)) >>> 0; return x.toString(36); };

// ---------- 可以同步的幾類 ----------
// get：這台現在的值；set：把別台的值放進這台（只寫 localStorage），apply：寫完後讓畫面跟著變
const G = {
  look: { name: '配色與外觀', note: '配色、顏色、星空／簡約、框線圓角、字體', on: true,
    get: () => ({ look3: raw('look3'), settings: raw('settings') }),
    set: v => { put('look3', v.look3); put('settings', v.settings); },
    apply: v => { KN.menu.reloadLook(); if (v.settings && window.knApplyState) knApplyState(Object.assign(JSON.parse(JSON.stringify(st)), v.settings), null); } },
  ed: { name: '編輯台設定', note: window.KN_PLAIN ? '篩選、點旁文字、卡片、線、關聯類型、快捷鍵、存的檢視' : '篩選、點旁文字、卡片、線、關聯類型、快捷鍵、AI 指示、存的檢視', on: true,
    get: () => ({ ed: omit(raw('ed'), ['ui', 'fs']), views: raw('views'), qa: raw('qa') }),
    set: v => { const cur = raw('ed') || {}; put('ed', Object.assign({}, v.ed || {}, { ui: cur.ui, fs: cur.fs })); put('views', v.views); if ('qa' in v) put('qa', v.qa); },
    apply: () => { if (window.knApplyState) knApplyState(null, raw('ed')); } },
  bar: { name: '上方按鈕排列和名字', note: '哪些按鈕在左上、右上、組、改過的名字、收起來的功能、每個按鈕的大小、自由擺放的位置', on: false,
    get: () => ({ bar: raw('bar') }), set: v => put('bar', v.bar), apply: () => KN.layout.reload() },
  bottom: { name: '手機底部列', note: '底部列放哪些功能、短名字、要不要顯示', on: false,
    get: () => ({ bottom: raw('bottom') }), set: v => put('bottom', v.bottom), apply: () => KN.layout.reload() },
  size: { name: '字大小和介面大小', note: '介面字大小、各區塊字大小、知識網字大小、介面整體大小', on: false,
    get: () => { const e = raw('ed') || {}; return { fsz: raw('fsz'), ui: e.ui ?? 1, fs: e.fs ?? 1 }; },
    set: v => { put('fsz', v.fsz); const e = raw('ed') || {}; e.ui = v.ui; e.fs = v.fs; put('ed', e); },
    apply: () => { KN.layout.reload(); if (window.knApplyState) knApplyState(null, raw('ed')); } },
  win: { name: '面板位置、大小和收合', note: '小框和卡片拖到哪裡、多大、大框小框、功能框和卡片的上下位置、哪些段落收起來', on: false,
    get: () => ({ winpos: raw('winpos'), psize: raw('psize'), fold: raw('fold'), rvLay: raw('rvLay'), rvSplit: raw('rvSplit'), panepos: raw('panepos') }),
    set: v => ['winpos', 'psize', 'fold', 'rvLay', 'rvSplit', 'panepos'].forEach(k => { if (k in v) put(k, v[k]); }),
    apply: () => { KN.menu.reloadWin(); KN.layout.reload(); } },
};
const ON = Object.assign(Object.fromEntries(Object.entries(G).map(([k, g]) => [k, g.on])), store.get('uisync', {}));   // 這台勾了哪幾類（不同步）
const META = store.get('uisyncMeta', {});   // 每類：{ at:這台的值是什麼時候的, h:那時的內容 }
let DEV = store.get('uidev', ''); if (!DEV) { DEV = (window.KNAPP || 'web') + '-' + Math.random().toString(36).slice(2, 7); store.set('uidev', DEV); }
const LABEL = window.KNAPP === 'win' ? 'Windows' : window.KNAPP === 'android' ? 'Android' : '預覽';
const MINE = DIR + DEV + '.json';
const saveMeta = () => store.set('uisyncMeta', META);

// ---------- 這台改了什麼：每幾秒比一次（設定散在好幾個檔案裡存，用比的最不會漏）----------
let wT = 0;
function writeMine() {
  clearTimeout(wT);
  wT = setTimeout(() => {
    const groups = {}; Object.keys(G).forEach(k => { if (ON[k] && META[k]) groups[k] = { at: META[k].at, v: G[k].get() }; });
    const text = JSON.stringify({ device: DEV, label: LABEL, groups }, null, 1);
    if (V.get(MINE) !== text) V.put(MINE, text).catch(e => console.warn(e));
  }, 800);
}
function check() {
  let ch = false;
  Object.keys(G).forEach(k => { if (!ON[k]) return; const hh = hash(JSON.stringify(G[k].get()));
    if (!META[k]) { META[k] = { at: 0, h: hh }; ch = true; }   // 第一次：當成很舊的，別台有就用別台的
    else if (META[k].h !== hh) { META[k] = { at: Date.now(), h: hh }; ch = true; } });
  if (ch) { saveMeta(); writeMine(); }
}

// ---------- 讀別台的檔，比較新的就用 ----------
function others() {
  return V.list().filter(p => p.startsWith(DIR) && p.endsWith('.json') && p !== MINE).map(p => { try { return JSON.parse(V.get(p)); } catch (e) { return null; } }).filter(o => o && o.groups && o.device !== DEV);
}
function newest(k) { let best = null; for (const o of others()) { const g = o.groups[k]; if (g && g.v && (!best || g.at > best.at)) best = { ...g, label: o.label }; } return best; }
function take(k, g) {
  G[k].set(g.v); META[k] = { at: g.at, h: hash(JSON.stringify(G[k].get())) };
  try { G[k].apply(g.v); } catch (e) { console.warn(e); }
}
function pull(quiet) {
  check();   // 這台還沒記下的修改先記下，才比得出誰比較新
  const got = [];
  Object.keys(G).forEach(k => { if (!ON[k]) return; const g = newest(k); if (g && (!META[k] || g.at > META[k].at)) { take(k, g); got.push(G[k].name); } });
  if (got.length) { saveMeta(); writeMine(); if (!quiet) toast('已套用另一台的介面設定：' + got.join('、')); }
}
let pT = 0;
V.onChange((op, p, text, remote) => { if (remote && p.startsWith(DIR) && p !== MINE) { clearTimeout(pT); pT = setTimeout(() => pull(false), 500); } });

// ---------- 同步與備份面板裡：每類一個勾 ----------
function section() {
  const devs = others();
  return `<h4>介面設定也同步</h4>
   <p class="note">勾起來的項目，會跟其他也有勾的裝置同步（哪台最後改就用哪台的）；沒勾的只留在這台。${devs.length ? '其他裝置：' + devs.map(o => E(o.label)).join('、') : '目前還沒收到其他裝置的介面設定。'}</p>
   ${Object.keys(G).map(k => `<label class="li" style="cursor:pointer"><input type="checkbox" data-us="${k}"${ON[k] ? ' checked' : ''}><span>${E(G[k].name)}<small>${E(G[k].note)}</small></span></label>`).join('')}`;
}
function bind(P) {
  P.querySelectorAll('[data-us]').forEach(x => x.onchange = () => {
    const k = x.dataset.us; ON[k] = x.checked; store.set('uisync', ON);
    if (x.checked) {
      const g = newest(k);
      if (g && confirm(`${g.label} 也有「${G[k].name}」。\n\n按「確定」＝改用 ${g.label} 的\n按「取消」＝用這台的（之後送到 ${g.label}）`)) { take(k, g); toast('已改用 ' + g.label + ' 的「' + G[k].name + '」'); }
      else META[k] = { at: Date.now(), h: hash(JSON.stringify(G[k].get())) };
      saveMeta();
    }
    writeMine();
  });
}
const _pane = window.knSyncPane;
if (_pane) window.knSyncPane = async function () {
  await _pane.apply(this, arguments);
  const sy = KN.pbody.querySelector('.sy'); if (!sy) return;
  const bk = [...sy.querySelectorAll('h4')].find(x => x.textContent.startsWith('備份'));
  const box = h('div', {}, section()); [...box.childNodes].forEach(n => sy.insertBefore(n, bk || null));
  bind(sy);
};

// ---------- 開始 ----------
(async () => { await V.ready; pull(true); writeMine(); setInterval(check, 4000); document.addEventListener('visibilitychange', () => { if (document.hidden) check(); }); })();
})();
