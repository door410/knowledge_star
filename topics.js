// 主題搬家（15 施工單段 10、06 第 37 輪）：改名／移到別的主題底下／和另一個主題合併／升成主題。
// 入口：知識網上點主題或子主題的名稱（右側小卡片）、整理 ▾ › 主題整理（右側面板列出主題樹）。
// 做法：批次改每個知識點 .md 開頭的「主題／子主題」；改之前寫歷史，整批算一次，可在「紀錄與復原」一鍵退回。
(() => {
const KN = window.KN, { toast, openPane, pbody } = KN;
const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const readF = async (dh, fn) => (await (await dh.getFileHandle(fn)).getFile()).text();
const real = () => K.points.filter(p => !p.demo && p._path);
const tops = () => K.topics.filter(t => !t.parent);
const subsOf = top => K.topics.filter(t => t.parent === top);
const tOf = id => K.topics.find(t => t.id === id) || { parent: String(id).split('/')[0], name: String(id).split('/').slice(1).join('/') };
const ptsOf = tg => real().filter(p => { const o = tOf(p.topic); return o.parent === tg.top && (!tg.sub || o.name === tg.sub); });
const label = tg => tg.sub ? `${tg.top} › ${tg.sub}` : tg.top;

// ---------- 四個動作 → 每個知識點要變成什麼 ----------
function plan(tg, act, val) {
  const pts = ptsOf(tg), out = [];
  for (const p of pts) {
    const o = tOf(p.topic), t0 = o.parent, s0 = o.name; let t = t0, s = s0;
    if (act === 'rename') { if (tg.sub) s = val; else t = val; }
    else if (act === 'move') { t = val; s = tg.sub ? tg.sub : tg.top; }           // 主題搬進去會變成一個子主題（原本的子主題併成一個）
    else if (act === 'merge') { if (tg.sub) { const v = tOf(val); t = v.parent; s = v.name; } else t = val; }   // 子主題合併到另一個子主題；主題合併時子主題跟著搬，同名的自動併在一起
    else if (act === 'promote') { t = tg.sub; s = '其他'; }
    if (t !== t0 || s !== s0) out.push({ p, t, s });
  }
  return out;
}
function describe(tg, act, val) {
  if (act === 'rename') return `「${label(tg)}」改名成「${val}」`;
  if (act === 'move') return tg.sub ? `「${label(tg)}」移到「${val}」底下` : `「${tg.top}」變成「${val}」的子主題` + (subsOf(tg.top).length > 1 ? `（它底下的 ${subsOf(tg.top).length} 個子主題會併成一個「${tg.top}」）` : '');
  if (act === 'merge') return `「${label(tg)}」併進「${tg.sub ? label({ top: tOf(val).parent, sub: tOf(val).name }) : val}」`;
  if (act === 'promote') return `「${label(tg)}」升成主題「${tg.sub}」（點放在它的「其他」子主題）`;
}
async function run(tg, act, val) {
  const list = plan(tg, act, val); if (!list.length) return toast('沒有要改的知識點');
  const kd = await KN.root.getDirectoryHandle('02-知識');
  window.knBatch = Date.now(); window.knBatchLabel = '主題整理：' + describe(tg, act, val);
  let n = 0;
  try {
    for (const { p, t, s } of list) {
      const [dn, fn] = p._path.split('/'), dh = await kd.getDirectoryHandle(dn);
      let txt = (await readF(dh, fn)).replace(/\r\n/g, '\n');
      const m = txt.match(/^---\n[\s\S]*?\n---\n?/); let head = m ? m[0] : '---\n---\n'; const body = m ? txt.slice(m[0].length) : txt;
      const setF = (k, v) => { const re = new RegExp('^' + k + ':.*$', 'm'), line = k + ': ' + JSON.stringify(v); head = re.test(head) ? head.replace(re, () => line) : head.replace(/\n---\n?$/, () => '\n' + line + '\n---\n'); };
      setF('主題', t); setF('子主題', s);
      await KN.writeFile(dh, fn, head + body); n++;
    }
  } finally { window.knBatch = null; window.knBatchLabel = null; }
  await follow(tg, act, val);
  await KN.load(true);
  toast(`已改好 ${n} 個知識點（可以在「整理 ▾ › 紀錄與復原」退回）`, 6000);
}
// ---------- 跟著主題名稱的東西：主題顏色、導覽快取、篩選和存成檢視（時光機的舊快照不改）----------
async function follow(tg, act, val) {
  const oldTop = tg.top, newTop = act === 'rename' && !tg.sub ? val : act === 'merge' && !tg.sub ? val : act === 'move' && !tg.sub ? val : null;
  if (!tg.sub && act === 'rename' && st.tcol[oldTop]) { st.tcol[val] = st.tcol[oldTop]; delete st.tcol[oldTop]; save(); }
  if (!tg.sub && act !== 'rename') { delete st.tcol[oldTop]; save(); }
  try {   // 導覽：改名就搬過去；內容變了的主題，快取刪掉，下次自動重做
    const td = await KN.root.getDirectoryHandle('04-知識網', { create: true }); let D = {};
    try { D = JSON.parse(await readF(td, '導覽.json')); } catch (e) {}
    const touched = new Set([oldTop, newTop, act === 'merge' && tg.sub ? tOf(val).parent : null, act === 'move' && tg.sub ? val : null, act === 'promote' ? tg.sub : null].filter(Boolean));
    if (!tg.sub && act === 'rename' && D[oldTop]) { D[val] = D[oldTop]; delete D[oldTop]; touched.delete(val); touched.delete(oldTop); }
    let ch = false; touched.forEach(k => { if (D[k]) { delete D[k]; ch = true; } });
    if (ch || (!tg.sub && act === 'rename')) await KN.writeFile(td, '導覽.json', JSON.stringify(D));
  } catch (e) { console.warn(e); }
  if (!tg.sub) {   // 篩選、打開時先看、存成檢視裡的主題
    const fixF = f => { if (!f || !f.tops) return f; f.tops = [...new Set(f.tops.map(x => x === oldTop ? (newTop || x) : x))]; if (!newTop) f.tops = f.tops.filter(x => x !== oldTop); return f; };
    const ed = store.get('ed', {});
    if (ed.filter) window.knSetED && knSetED('filter', fixF(ed.filter));
    if (ed.open === 'topic:' + oldTop) window.knSetED && knSetED('open', newTop ? 'topic:' + newTop : 'home');
    const views = store.get('views', []); views.forEach(v => { if (v.ed) { fixF(v.ed.filter); if (v.ed.open === 'topic:' + oldTop) v.ed.open = newTop ? 'topic:' + newTop : 'home'; } }); store.set('views', views);
  }
}

// ---------- 動作畫面（卡片和主題整理面板共用）----------
function actions(box, tg, back) {
  const n = ptsOf(tg).length, others = tops().map(t => t.name).filter(x => x !== tg.top);
  const allSubs = K.topics.filter(t => t.parent && t.id !== tg.top + '/' + tg.sub).map(t => t.id);
  box.innerHTML = `<p class="note" style="margin:0 0 8px">${n} 個知識點${tg.sub ? '' : `・${subsOf(tg.top).length} 個子主題`}</p>
   <div class="tacts" style="display:flex;flex-wrap:wrap;gap:6px">
    <button class="c" data-a="rename">改名</button>
    <button class="c" data-a="move"${others.length ? '' : ' disabled'}>移到別的主題底下</button>
    <button class="c" data-a="merge"${(tg.sub ? allSubs : others).length ? '' : ' disabled'}>和另一個${tg.sub ? '子主題' : '主題'}合併</button>
    ${tg.sub ? '<button class="c" data-a="promote">升成主題</button>' : ''}</div><div class="tform" style="margin-top:10px"></div>`;
  const F = box.querySelector('.tform');
  const confirmStep = (act, val) => {
    if (!val) return toast('還沒有填');
    const list = plan(tg, act, val); if (!list.length) return toast('名稱一樣，沒有要改的');
    F.innerHTML = `<p style="margin:4px 0">會改 <b>${list.length}</b> 個知識點：${E(describe(tg, act, val))}</p><div class="row" style="display:flex;gap:6px"><button class="c" id="tok">確認</button><button class="c" id="tno">取消</button></div>`;
    F.querySelector('#tno').onclick = () => F.innerHTML = '';
    F.querySelector('#tok').onclick = async e => { e.target.disabled = true; e.target.textContent = '改檔中…'; try { await run(tg, act, val); if (back) back(); } catch (er) { console.error(er); toast('沒改成功：' + er.message, 7000); } };
  };
  const sel = arr => `<select id="tv" style="max-width:100%">${arr.map(v => `<option value="${E(v)}">${E(K.topics.some(t => t.id === v && t.parent) ? label({ top: tOf(v).parent, sub: tOf(v).name }) : v)}</option>`).join('')}</select>`;
  box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a; box.querySelectorAll('[data-a]').forEach(x => x.classList.toggle('on', x === b));
    if (a === 'promote') return confirmStep('promote', tg.sub);
    if (a === 'rename') F.innerHTML = `<div style="display:flex;gap:6px"><input type="text" id="tv" value="${E(tg.sub || tg.top)}" style="flex:1;min-width:0"><button class="c" id="tgo">下一步</button></div>`;
    if (a === 'move') F.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap">移到 ${sel(others)} 底下 <button class="c" id="tgo">下一步</button></div>`;
    if (a === 'merge') F.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap">併進 ${sel(tg.sub ? allSubs : others)} <button class="c" id="tgo">下一步</button></div>`;
    const v = F.querySelector('#tv'); v.focus();
    F.querySelector('#tgo').onclick = () => { const x = v.value.trim().replace(/\//g, '／'); if (a === 'rename' && !tg.sub && others.includes(x)) return toast('已經有這個主題了，要用「和另一個主題合併」'); if (a === 'rename' && tg.sub && subsOf(tg.top).some(s => s.name === x && s.name !== tg.sub)) return toast('這個主題底下已經有同名的子主題，要用「合併」'); confirmStep(a, a === 'rename' ? x : v.value); };
    if (a === 'rename') v.onkeydown = e => { if (e.key === 'Enter') F.querySelector('#tgo').click(); };
  });
}

// ---------- 入口 1：知識網上點主題或子主題的名稱 → 右側小卡片 ----------
const cardEl = document.getElementById('card'), ctabs = document.getElementById('ctabs');
function topicCard(tg) {
  if (!KN.root) return;
  cardEl.hidden = false; ctabs.hidden = true;
  document.getElementById('cpath').textContent = tg.sub ? tg.top + ' ›' : '主題';
  document.getElementById('cname').textContent = tg.sub || tg.top;
  actions(document.getElementById('cbody'), tg, () => { cardEl.hidden = true; });
}
const _oc = window.openCard;
window.openCard = openCard = function (p, tab) { ctabs.hidden = false; return _oc(p, tab); };
cv.addEventListener('pointerup', e => {
  if (moved > 6 || !KN.root) return;
  let h = downHit;
  if (!h && st.mode === 'star') h = TP.find(T => { const [x, y] = toS(T.x, T.y); return Math.hypot(x - e.clientX, y - e.clientY) < Math.max(30, T.r0 * base * view.z * 1.2); });
  if (!h || !h.hub || h.demo || (h.T && h.T.demo)) return;
  if (h.subs) topicCard({ top: h.name }); else if (h.T) topicCard({ top: h.T.name, sub: h.name });
});

// ---------- 入口 2：整理 ▾ › 主題整理（右側面板：主題樹）----------
function treePane() {
  if (!KN.root) return toast('先連上資料夾');
  const cnt = tg => ptsOf(tg).length;
  openPane('主題整理', `<p class="note" style="margin-top:0">點一個主題或子主題，選要做什麼。改之前都會先問；改錯可以在「紀錄與復原」退回。</p>
   <div id="tbox" class="kc still" hidden><div class="t" id="tname"></div><div id="tact" style="margin-top:6px"></div></div>
   ${tops().length ? '<div class="kgrid">' + tops().map(t => `<div class="kc still kgrp"><div class="tt kti top" tabindex="0" data-t="${E(t.name)}"><span>${E(t.name)}</span><span class="n">${cnt({ top: t.name })}</span></div>${subsOf(t.name).map(s => `<div class="tt kti" tabindex="0" data-t="${E(t.name)}" data-s="${E(s.name)}"><span>${E(s.name)}</span><span class="n">${cnt({ top: t.name, sub: s.name })}</span></div>`).join('')}</div>`).join('') + '</div>' : '<p class="kempty">還沒有主題。</p>'}`);
  pbody.querySelectorAll('.tt').forEach(b => b.onclick = () => {
    const tg = { top: b.dataset.t, sub: b.dataset.s }; pbody.querySelectorAll('.tt').forEach(x => x.classList.toggle('on', x === b));
    const box = pbody.querySelector('#tbox'); box.hidden = false; pbody.querySelector('#tname').textContent = label(tg);
    actions(pbody.querySelector('#tact'), tg, treePane); pbody.scrollTop = 0;
  });
}
window.knTopics = treePane;
})();
