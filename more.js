// 其他功能（07 第五節「11/10 之後」，06 第 3～5 輪）：回想、問答時知識網亮起來、每月成長、導覽、圈選整理、時光機（網址、截圖 11/7 拿掉，06 第 36 輪）
(() => {
const KN = window.KN, { h, toast, qtip, openPane, pbody, pane } = KN, X = () => window.KN2;
const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const readF = async (dh, fn) => (await (await dh.getFileHandle(fn)).getFile()).text();
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const tmap = () => { const m = {}; K.topics.forEach(t => m[t.id] = t); return m; };
const topOf = p => { const t = tmap()[p.topic]; return t ? (t.parent || t.id) : ''; };
const srcDate = p => (K.sources.find(s => s.id === (p._path || '').split('/')[0] || s.id === (p.src || [])[0]) || {}).date || '';
const pj = t => X().pj(t);
const ptitle = document.getElementById('ptitle');
function goPoint(id) { const q = byId[id]; if (!q) return; view.sel = q; tip.style.display = 'none'; flyPoint(q); openCard(q); }
document.head.append(h('style', {}, `#tourBar,#tmBar{position:fixed;left:50%;transform:translateX(-50%);bottom:64px;z-index:25;background:var(--panel,#111316);color:inherit;border:1px solid #8886;border-radius:12px;padding:8px 12px;display:flex;gap:8px;align-items:center;max-width:calc(100vw - 24px);flex-wrap:wrap;font-size:14px}
#tmBar{top:56px;bottom:auto}#selBox{position:fixed;border:1px dashed #9B7BFF;background:#9B7BFF22;z-index:15;pointer-events:none}.gbar rect{fill:#9B7BFF}.gbar text{fill:currentColor;font-size:11px}
.rvtabs{display:flex;gap:4px;margin-bottom:8px}`));

// ---------- 回想：打開卡片＝看過（記在這台電腦）；「快忘」顏色依此變淡 ----------
const SEEN = store.get('seen', {});
const _oc = window.openCard;
window.openCard = openCard = function (p, tab) { _oc(p, tab); if (p && !p.demo && p.id && !TM) { SEEN[p.id] = Date.now(); store.set('seen', SEEN); } };
const _b = build;
build = function () {
  _b(); if (!S.length) return; const now = Date.now();
  S.forEach(p => { if (SEEN[p.id] > p.seenAt) p.seenAt = SEEN[p.id]; });
  const mx = Math.max(1, ...S.map(p => now - p.seenAt)); S.forEach(p => p.seen = (now - p.seenAt) / mx);
};

// ---------- 問答時知識網亮起來（layer2 設 KNX.glow；面板關掉就熄）----------
new MutationObserver(() => { if (KNX.glow && (pane.hidden || !['問答', '圈選整理'].includes(ptitle.textContent))) { KNX.glow = null; dirty = true; } })
  .observe(pane, { attributes: true, attributeFilter: ['hidden'] });
new MutationObserver(() => { if (KNX.glow && !['問答', '圈選整理'].includes(ptitle.textContent)) { KNX.glow = null; dirty = true; } }).observe(ptitle, { childList: true, characterData: true, subtree: true });

// ---------- 回顧面板：最近消化｜每月成長｜導覽｜時光機 ----------
const RV = { recent: '最近消化', grow: '每月成長', tour: '導覽', tm: '時光機' };
const tabsRow = cur => `<nav class="ktabs">${Object.keys(RV).map(k => `<button class="${k === cur ? 'on' : ''}" data-rv="${k}">${RV[k]}</button>`).join('')}</nav>`;
const bindTabs = () => pbody.querySelectorAll('[data-rv]').forEach(b => b.onclick = () => review(b.dataset.rv));
window.knRecentTabs = () => { pbody.insertAdjacentHTML('afterbegin', tabsRow('recent')); bindTabs(); };   // layer2 的最近消化畫好後呼叫
window.knReview = k => review(k);
function review(k) { if (k === 'recent') return window.knRecent(); if (k === 'grow') return growPane(); if (k === 'tour') return tourList(); if (k === 'tm') return tmPane(); }

// ---------- 每月成長 ----------
function growPane() {
  const ps = KN.realPts(), by = {};
  ps.forEach(p => { const m = srcDate(p).slice(0, 7); if (m) (by[m] = by[m] || []).push(p); });
  const ms = Object.keys(by).sort(), cur = today().slice(0, 7), mx = Math.max(1, ...ms.map(m => by[m].length));
  const W = Math.max(320, ms.length * 54), bars = ms.map((m, i) => { const n = by[m].length, hh = Math.round(n / mx * 110); return `<rect x="${i * 54 + 10}" y="${130 - hh}" width="34" height="${hh}" rx="3"></rect><text x="${i * 54 + 27}" y="${124 - hh}" text-anchor="middle">${n}</text><text x="${i * 54 + 27}" y="146" text-anchor="middle">${m.slice(2).replace('-', '/')}</text>`; }).join('');
  const thisM = by[cur] || [], tops = {}; thisM.forEach(p => { const t = topOf(p); tops[t] = (tops[t] || 0) + 1; });
  const firstM = {}; ps.forEach(p => { const t = topOf(p), m = srcDate(p).slice(0, 7); if (m && (!firstM[t] || m < firstM[t])) firstM[t] = m; });
  const newT = Object.keys(firstM).filter(t => firstM[t] === cur);
  openPane('回顧', tabsRow('grow') + `<div class="kstat"><div><b>${ps.length}</b><span>累積知識點</span></div><div><b>${K.sources.filter(s => !s.demo).length}</b><span>來源</span></div><div><b>${thisM.length}</b><span>這個月新增</span></div></div>
   ${ms.length ? `<div class="ksec">每月新增</div><div class="kc still" style="overflow-x:auto"><svg class="gbar" width="${W}" height="152" viewBox="0 0 ${W} 152">${bars}</svg></div>` : ''}
   ${Object.keys(tops).length ? `<div class="ksec">這個月長最多</div><div class="kgrid">${Object.entries(tops).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `<div class="kc still"><div class="t">${E(t)}</div><div class="s">＋${n} 個點</div></div>`).join('')}</div>` : ''}
   ${newT.length ? `<div class="ksec">這個月的新主題</div><div class="kgrid">${newT.map(t => `<div class="kc still"><div class="t">${E(t)}</div></div>`).join('')}</div>` : ''}`);
  bindTabs();
}

// ---------- 導覽：主題的門口牌子 → 帶我走一遍 → 最後一站＝缺口 ----------
let TOUR = null;
const tourDir = () => KN.root.getDirectoryHandle('04-知識網', { create: true });
async function tourData() { try { return JSON.parse(await readF(await tourDir(), '導覽.json')); } catch (e) { return {}; } }
function tourList() {
  const ps = KN.realPts(), tops = K.topics.filter(t => !t.parent && ps.some(p => topOf(p) === t.id));
  openPane('回顧', tabsRow('tour') + (tops.length ? `<div class="ksec">選一個主題，一站一站帶你看${qtip('最後一站會告訴你這個主題還缺什麼。')}</div><div class="kgrid">` + tops.map(t => `<div class="kc" tabindex="0" data-t="${E(t.id)}"><div class="t">${E(t.name)}</div><div class="s">${ps.filter(p => topOf(p) === t.id).length} 點・${K.topics.filter(s => s.parent === t.id).length} 個子主題</div></div>`).join('') + '</div>' : '<p class="kempty">還沒有主題。</p>'));
  bindTabs(); pbody.querySelectorAll('[data-t]').forEach(b => b.onclick = () => tourStart(b.dataset.t));
}
async function tourStart(tid) {
  const all = KN.realPts().filter(p => topOf(p) === tid), pub = all.filter(p => !p.priv);
  openPane('導覽：' + tid, '<p class="note">準備門口牌子…</p>');
  const D = KN.root ? await tourData() : {}; let d = D[tid];
  if (!d || d.n !== all.length) {
    d = { n: all.length, sign: '', order: pub.map(p => p.id), gap: '' };
    try {
      const r = await aiAsk(`這是我知識網裡「${tid}」主題的知識點。請當博物館導覽員。只輸出 JSON：{"牌子":"一句話說這個主題在回答什麼","順序":[知識點編號，照最好懂的參觀順序],"缺口":"一兩句：這個主題還缺哪些重要知識"}\n\n${pub.map((p, i) => `${i + 1}. ${p.name}：${p.desc || ''}`).join('\n')}`);
      const o = pj(r.text) || {}; d.sign = o['牌子'] || ''; d.gap = o['缺口'] || '';
      const ord = (o['順序'] || []).map(n => pub[parseInt(n) - 1]).filter(Boolean); d.order = [...new Set([...ord, ...pub].map(p => p.id))];
      if (KN.root) { D[tid] = d; await KN.writeFile(await tourDir(), '導覽.json', JSON.stringify(D)); }
    } catch (e) { toast('AI 沒成功，先照原本順序走：' + e.message, 6000); }
  }
  const order = [...d.order.filter(id => all.some(p => p.id === id)), ...all.filter(p => p.priv).map(p => p.id)];
  openPane('導覽：' + tid, `<div class="row"><button class="go sub" id="tback">← 導覽</button></div><div class="kc still">${d.sign ? `<div class="t">${E(d.sign)}</div>` : ''}<div class="s">共 ${order.length} 站${d.gap ? '，最後一站是「缺口」' : ''}</div></div><div class="row"><button class="go" id="twalk">帶我走一遍</button></div>`);
  pbody.querySelector('#tback').onclick = () => tourList();
  pbody.querySelector('#twalk').onclick = () => { KN.closePane(); TOUR = { order, gap: d.gap, i: 0, name: tid }; tourStep(); };
}
function tourStep() {
  let bar = document.getElementById('tourBar'); if (!bar) { bar = h('div', { id: 'tourBar' }); document.body.append(bar); }
  const T = TOUR, last = T.i >= T.order.length;
  if (last) { card.hidden = true; bar.innerHTML = `<b>最後一站：缺口</b><span>${E(T.gap || '這個主題目前沒有明顯缺口。')}</span><button class="c" id="tpv">‹ 上一站</button><button class="c" id="tend">結束</button>`; }
  else { const p = byId[T.order[T.i]]; if (p) goPoint(p.id); bar.innerHTML = `<span>${E(T.name)}　第 ${T.i + 1}／${T.order.length} 站</span><button class="c" id="tpv"${T.i ? '' : ' disabled'}>‹ 上一站</button><button class="c" id="tnx">下一站 ›</button><button class="c" id="tend">結束</button>`; }
  bar.querySelector('#tpv').onclick = () => { T.i = Math.max(0, T.i - 1); tourStep(); };
  const nx = bar.querySelector('#tnx'); if (nx) nx.onclick = () => { T.i++; if (T.i === T.order.length && !T.gap) return end(); tourStep(); };
  const end = () => { bar.remove(); TOUR = null; card.hidden = true; view.sel = null; dirty = true; };
  bar.querySelector('#tend').onclick = end;
}
const _st = showTip;
showTip = function (text, x, y, p) {
  _st(text, x, y, p);
  if (!p) { const T = TP.find(T => T.name === text && !T.demo && T.pts.some(q => !q.demo)); if (T) { const b = h('button', { textContent: '導覽 ›' }); b.onclick = () => tourStart(T.id); tip.append(b); } }
};

// ---------- 圈選整理：圈一群點 → AI 建議 → 看過才套用 ----------
const zoomBar = document.getElementById('zoom'), selBtn = h('button', { className: 'c', textContent: '圈選', title: '圈一群知識點，請 AI 整理' });
zoomBar.prepend(selBtn); let selOn = false, sel0 = null, box = null;
selBtn.onclick = () => { selOn = !selOn; selBtn.classList.toggle('on', selOn); cv.style.cursor = selOn ? 'crosshair' : ''; if (selOn) toast('拖一個框圈住知識點'); };
cv.addEventListener('pointerdown', e => { if (!selOn) return; e.stopImmediatePropagation(); e.preventDefault(); sel0 = [e.clientX, e.clientY]; box = h('div', { id: 'selBox' }); document.body.append(box); cv.setPointerCapture(e.pointerId); }, true);
cv.addEventListener('pointermove', e => { if (!selOn || !sel0) return; e.stopImmediatePropagation(); const [a, b] = sel0; Object.assign(box.style, { left: Math.min(a, e.clientX) + 'px', top: Math.min(b, e.clientY) + 'px', width: Math.abs(e.clientX - a) + 'px', height: Math.abs(e.clientY - b) + 'px' }); }, true);
cv.addEventListener('pointerup', e => {
  if (!selOn || !sel0) return; e.stopImmediatePropagation();
  const [a, b] = sel0, x0 = Math.min(a, e.clientX), x1 = Math.max(a, e.clientX), y0 = Math.min(b, e.clientY), y1 = Math.max(b, e.clientY);
  box.remove(); sel0 = null; selOn = false; selBtn.classList.remove('on'); cv.style.cursor = '';
  const got = S.filter(p => { if (p.demo || !p._path) return false; const [x, y] = toS(...pos(p)); return x >= x0 && x <= x1 && y >= y0 && y <= y1; });
  if (got.length < 2) { toast('圈到的知識點不到 2 個，放大一點再圈'); return; }
  groupPane(got);
}, true);
async function groupPane(got) {
  KNX.glow = new Set(got); dirty = true;
  const pub = got.filter(p => !p.priv);
  openPane('圈選整理', `<p>圈到 ${got.length} 個知識點${got.length - pub.length ? `（${got.length - pub.length} 個私人的不送 AI）` : ''}：${got.slice(0, 12).map(p => E(p.name)).join('、')}${got.length > 12 ? '…' : ''}</p><p class="note" id="gwait">AI 整理中…</p>`);
  const t0 = Date.now(), tick = setInterval(() => { const w = document.getElementById('gwait'); if (!w || !/整理中/.test(w.textContent)) return clearInterval(tick); w.textContent = `AI 整理中…（${Math.round((Date.now() - t0) / 1000)} 秒）`; }, 1000);
  KNX.glow = new Set(got); dirty = true;
  let o = {};
  try {
    const r = await aiAsk(`幫我整理下面這群知識點。只輸出 JSON：{"摘要":"這群點合起來在講什麼（2～3 句白話）","主題":"最適合它們的主題（2～6 字）","子主題":"（2～8 字）","關聯":[{"甲":"名稱","乙":"名稱","類型":"從「${KN.RTYPES.join('、')}」選","說明":"一句白話"}],"合併":[["保留的名稱","併進去的名稱"]]}
「合併」只列意思幾乎一樣、重複的點；沒有就給空陣列。
只列意思真的相關、而且原本沒有的關聯；名字一樣但意思不同的不要連。

${pub.map(p => `- ${p.name}：${p.desc || ''}（現在在：${(tmap()[p.topic] || {}).parent || ''}／${(tmap()[p.topic] || {}).name || ''}）`).join('\n')}`);
    o = pj(r.text) || {};
  } catch (e) { pbody.querySelector('.note').textContent = 'AI 沒成功：' + e.message; return; }
  const byName = {}; got.forEach(p => byName[p.name] = p);
  const merges = (o['合併'] || []).map(m => [byName[(m || [])[0]], byName[(m || [])[1]]]).filter(m => m[0] && m[1] && m[0] !== m[1]);
  const rels = (o['關聯'] || []).map(l => ({ a: byName[l['甲']], b: byName[l['乙']], type: KN.RTYPES.includes(l['類型']) ? l['類型'] : '有關', note: l['說明'] || '' }))
    .filter(l => l.a && l.b && l.a !== l.b && !(adj[l.a.id] || []).some(r => r.p.id === l.b.id));
  openPane('圈選整理', `<p>圈到 ${got.length} 個知識點。</p>${o['摘要'] ? `<blockquote>${E(o['摘要'])}</blockquote>` : ''}
   ${o['主題'] ? `<label><input type="checkbox" id="gmv"> 全部移到「${E(o['主題'])}／${E(o['子主題'] || '其他')}」</label><br>` : ''}
   ${rels.map((l, i) => `<label><input type="checkbox" class="grl" data-i="${i}" checked> ${E(l.a.name)} ──${E(l.type)}──▶ ${E(l.b.name)}：${E(l.note)}</label><br>`).join('')}
   ${merges.map((m, i) => `<label><input type="checkbox" class="gmg" data-i="${i}"> 合併：把「${E(m[1].name)}」併進「${E(m[0].name)}」</label><br>`).join('')}
   ${o['摘要'] ? `<label><input type="checkbox" id="gnote" checked> 把摘要存成筆記（03-我的）</label>` : ''}
   <div class="row"><button class="go" id="gok">套用勾選的</button><button class="go sub" id="gno">不用</button></div>`);
  pbody.querySelector('#gno').onclick = () => KN.closePane();
  pbody.querySelector('#gok').onclick = async () => {
    const kd = await KN.root.getDirectoryHandle('02-知識'), fileOf = async p => { const [dn, fn] = p._path.split('/'), dh = await kd.getDirectoryHandle(dn); return [dh, fn, (await readF(dh, fn)).replace(/\r\n/g, '\n')]; };
    const mv = pbody.querySelector('#gmv') && pbody.querySelector('#gmv').checked, todo = new Map();
    const get = async p => { if (!todo.has(p)) todo.set(p, await fileOf(p)); return todo.get(p); };
    if (mv) for (const p of got) { const f = await get(p); f[2] = f[2].replace(/^主題:.*$/m, () => '主題: ' + JSON.stringify(o['主題'])).replace(/^子主題:.*$/m, () => '子主題: ' + JSON.stringify(o['子主題'] || '其他')); }
    for (const el of pbody.querySelectorAll('.grl:checked')) { const l = rels[+el.dataset.i], f = await get(l.a);
      if (!/\n##\s*關聯\s*(\n|$)/.test(f[2])) f[2] = f[2].replace(/\s*$/, '') + '\n\n## 關聯';
      f[2] = f[2].replace(/\s*$/, '') + '\n' + `- ${l.b.name}（id: ${l.b.id}）${l.type && l.type !== '有關' ? '［' + l.type + '］' : ''}：${l.note}` + '\n'; }
    const gone = [];
    for (const el of pbody.querySelectorAll('.gmg:checked')) { const [a, b] = merges[+el.dataset.i], fa = await get(a), fb = await get(b); let t = fa[2];
      const sb = b._path.split('/')[0], al = t.match(/^也出現在:\s*(.*)$/m); let arr = []; if (al) { try { arr = JSON.parse(al[1]); } catch (e) {} }
      if (sb !== a._path.split('/')[0] && !arr.includes(sb)) arr.push(sb);
      t = al ? t.replace(/^也出現在:.*$/m, () => '也出現在: ' + JSON.stringify(arr)) : t.replace(/\n---\n/, () => '\n也出現在: ' + JSON.stringify(arr) + '\n---\n');
      const k = t.indexOf('\n## '); const add = `\n\n（合併自「${b.name}」）${b.desc || ''}\n`; t = k >= 0 ? t.slice(0, k).replace(/\s*$/, '') + add + t.slice(k) : t.replace(/\s*$/, '') + add;
      const rl = (fb[2].split(/\n##\s*關聯/)[1] || '').split('\n').filter(l => /^\s*-\s/.test(l) && !l.includes('id: ' + a.id));
      if (rl.length) { if (!/\n##\s*關聯/.test(t)) t = t.replace(/\s*$/, '') + '\n\n## 關聯'; t = t.replace(/\s*$/, '') + '\n' + rl.join('\n') + '\n'; }
      fa[2] = t; gone.push(b); }
    for (const [p, [dh, fn, t]] of todo) if (!gone.includes(p)) await KN.writeFile(dh, fn, t);
    for (const b of gone) { const [dh, fn, t] = todo.get(b); if (window.knHist) await knHist(dh, fn, null); await dh.removeEntry(fn); }
    if (pbody.querySelector('#gnote') && pbody.querySelector('#gnote').checked) { const md = await KN.root.getDirectoryHandle('03-我的', { create: true });
      await KN.writeFile(md, `${today()} 圈選整理 ${Date.now().toString(36)}.md`, `# 圈選整理（${today()}）\n\n${o['摘要']}\n\n## 圈到的知識點\n${got.map(p => '- ' + p.name).join('\n')}\n`); }
    KN.closePane(); await KN.load(true); toast('已套用（可以在編輯台「知識內容」復原）', 5000);
  };
}

// ---------- 時光機：每天自動存一份；也可以手動存（含圖片）----------
let TM = null;
const tmDir = async () => (await KN.root.getDirectoryHandle('04-知識網', { create: true })).getDirectoryHandle('時光機', { create: true });
const snapData = () => ({ date: today(), sources: K.sources.filter(s => !s.demo).map(s => ({ id: s.id, title: s.title, date: s.date })), topics: K.topics,
  points: KN.realPts().map(p => ({ id: p.id, name: p.name, topic: p.topic, src: p.src, desc: (p.desc || '').slice(0, 200), priv: !!p.priv })), links: K.links });
async function tmSave(withPic, name) {
  const d = await tmDir(), base = today() + (name ? ' ' + name.replace(/[\\/:*?"<>|]/g, ' ').slice(0, 30) : ''); await KN.writeFile(d, base + '.json', JSON.stringify(snapData()));
  if (withPic && !window.KNAPP) { dirty = true; await new Promise(r => requestAnimationFrame(r)); const b = await new Promise(r => cv.toBlob(r, 'image/png')); if (b) await KN.writeFile(d, base + '.png', b); }
}
(async () => { const t0 = Date.now(); while (Date.now() - t0 < 15000 && !(KN.root && K.points.some(p => p._path))) await new Promise(r => setTimeout(r, 1000));
  if (!KN.root || !K.points.some(p => p._path)) return; try { const d = await tmDir(); await d.getFileHandle(today() + '.json'); } catch (e) { tmSave(false).catch(() => {}); } })();
async function tmPane() {
  if (!KN.root) { openPane('回顧', tabsRow('tm') + '<p class="kempty">還沒連上資料夾。</p>'); bindTabs(); return; }
  const d = await tmDir(), days = []; for await (const [n, fh] of d.entries()) if (n.endsWith('.json')) days.push(n.slice(0, -5));
  days.sort().reverse(); const pics = new Set(); for await (const n of d.keys()) if (n.endsWith('.png')) pics.add(n.slice(0, -4));
  openPane('回顧', tabsRow('tm') + `<div class="row"><input type="text" id="tmname" placeholder="名稱（可不填）" style="flex:1;min-width:0"><button class="go" id="tmsave">現在存一張</button>${qtip('存下今天的知識網（資料＋圖片）。每天第一次打開也會自動存資料。')}</div>
   ${days.length ? `<div class="ksec">以前的知識網</div><div class="kgrid">${days.map(x => `<div class="kc" tabindex="0" data-d="${E(x)}"><div class="t">${E(x.slice(0, 10))}</div><div class="s">${E(x.slice(11) || '自動存')}</div>${pics.has(x) ? '<span class="kchip">有圖片</span>' : ''}</div>`).join('')}</div>` : '<p class="kempty">還沒有存過。</p>'}`);
  bindTabs();
  pbody.querySelector('#tmsave').onclick = async () => { const nm = pbody.querySelector('#tmname').value.trim(); KN.closePane(); await new Promise(r => setTimeout(r, 400)); await tmSave(true, nm); toast('已存今天的知識網'); };
  pbody.querySelectorAll('[data-d]').forEach(b => b.onclick = () => tmView(b.dataset.d, pics.has(b.dataset.d)));
}
async function tmView(day, pic) {
  const d = await tmDir(), o = JSON.parse(await readF(d, day + '.json')), nowN = KN.realPts().length;
  KN.closePane(); TM = day;
  K.sources = o.sources; K.topics = o.topics; K.points = o.points; K.links = o.links; view.sel = null; card.hidden = true; build(); ui(); enterMode();
  let bar = document.getElementById('tmBar'); if (!bar) { bar = h('div', { id: 'tmBar' }); document.body.append(bar); }
  bar.innerHTML = `<b>時光機：${day}</b><span>${o.points.length} 個知識點（現在 ${nowN}，多了 ${nowN - o.points.length}）</span>${pic ? '<button class="c" id="tmpic">看當天的圖</button>' : ''}<button class="c" id="tmcmp">跟現在比對</button><button class="c" id="tmback">回到現在</button>`;
  bar.querySelector('#tmcmp').onclick = async () => { const ids = new Set(o.points.map(p => p.id)); TM = null; await KN.load(true);
    const now = KN.realPts(), nowIds = new Set(now.map(p => p.id)), added = now.filter(p => !ids.has(p.id)), gone = o.points.filter(p => !nowIds.has(p.id));
    KNX.glow = new Set(added.map(p => byId[p.id]).filter(Boolean)); dirty = true;
    bar.innerHTML = `<b>和 ${day} 比對</b><span>之後新長的 ${added.length} 個（亮起來的）${gone.length ? '｜不見的：' + gone.slice(0, 8).map(p => E(p.name)).join('、') + (gone.length > 8 ? '…' : '') : ''}</span><button class="c" id="tmend">結束比對</button>`;
    bar.querySelector('#tmend').onclick = () => { bar.remove(); KNX.glow = null; dirty = true; }; };
  bar.querySelector('#tmback').onclick = async () => { bar.remove(); TM = null; await KN.load(true); };
  if (pic) bar.querySelector('#tmpic').onclick = async () => { const f = await (await d.getFileHandle(day + '.png')).getFile(); window.open(URL.createObjectURL(f)); };
}

// ---------- 新長的點：光圈（7 天內；顏色、開關在外觀面板）----------
function ringNew() {
  if (KNX.ringOn === false) return;
  const now = Date.now(); ctx.save(); ctx.strokeStyle = KNX.ring || '#5FE0A0'; ctx.lineWidth = 1.4; ctx.globalAlpha = .85;
  for (const p of S) { if (p.demo || !p.created || now - p.created > 7 * 864e5) continue; const T = TP[p.t];
    if (st.mode === 'star' ? ttOf(T) < .15 : ptA(T) < .3) continue; const [x, y] = toS(...pos(p)); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.283); ctx.stroke(); }
  ctx.restore();
}
const _dm = drawMin, _ds = drawStar;
drawMin = function () { _dm(); ringNew(); }; drawStar = function () { _ds(); ringNew(); };

// ---------- 卡片：名字一樣、意思可能不同的提醒 ----------
const _oc2 = window.openCard;
window.openCard = openCard = function (p, tab) {
  _oc2(p, tab); const on = document.querySelector('#ctabs button.on'); if (!p || p.demo || !on || on.dataset.t !== 'desc') return;
  const n = String(p.name).replace(/\s/g, ''), same = S.filter(q => q !== p && !q.demo && String(q.name).replace(/\s/g, '') === n && !(adj[p.id] || []).some(r => r.p === q));
  if (same.length) { const B = document.getElementById('cbody'), el = h('p', { className: 'meta' }); el.innerHTML = '名字一樣、意思可能不同：' + same.map(q => `<a href="#" data-g="${E(q.id)}">${E(q.name)}（${E(TP[q.t].name)}）</a>`).join('、');
    B.insertBefore(el, B.children[1] || null); el.querySelectorAll('[data-g]').forEach(a => a.onclick = ev => { ev.preventDefault(); goPoint(a.dataset.g); }); }
};

// ---------- 簡約模式：把知識點拖到別的子主題 → 問要不要換過去 ----------
let dropAsk = null;
cv.addEventListener('pointerup', () => {
  if (st.mode !== 'min' || !dragN || dragN.demo || !dragN._path) return;
  const p = dragN, [wx, wy] = dragW; let best = null, bd = 1e9;
  TP.forEach((T, ti) => T.subs.forEach((s, si) => { if (s.cx == null || (ti === p.t && si === p.sub) || T.demo) return; const d = Math.hypot(wx - s.cx, wy - s.cy); if (d < (s.rS || 30) * 1.2 && d < bd) { bd = d; best = [T, s]; } }));
  if (!best) return;
  setTimeout(() => {
    let bar = document.getElementById('tourBar'); if (bar) return; bar = h('div', { id: 'tourBar' }); document.body.append(bar);
    bar.innerHTML = `<span>把「${E(p.name)}」移到「${E(best[0].name)}／${E(best[1].name)}」？</span><button class="c" id="mvok">移過去</button><button class="c" id="mvno">不要</button>`;
    bar.querySelector('#mvno').onclick = () => bar.remove();
    bar.querySelector('#mvok').onclick = async () => { bar.remove(); const [dn, fn] = p._path.split('/'), dh = await (await KN.root.getDirectoryHandle('02-知識')).getDirectoryHandle(dn);
      const t = (await readF(dh, fn)).replace(/\r\n/g, '\n').replace(/^主題:.*$/m, () => '主題: ' + JSON.stringify(best[0].id)).replace(/^子主題:.*$/m, () => '子主題: ' + JSON.stringify(best[1].name));
      await KN.writeFile(dh, fn, t); await KN.load(true); toast('已移過去（可以在編輯台復原）'); };
  }, 50);
}, true);

// ---------- 先看拆解：AI 重拆（可以寫一句想怎麼拆）----------
function addResplit() {
  if (ptitle.textContent !== '先看拆解' || pbody.querySelector('#resplit') || !window.aiAsk) return;
  const back = [...pbody.querySelectorAll('button')].find(b => /重貼回答/.test(b.textContent)); if (!back) return;
  back.insertAdjacentHTML('afterend', `<input type="text" id="rsn" placeholder="想怎麼重拆（可不填）" style="min-width:8em;flex:1"><button class="go sub" id="resplit">AI 重拆</button>`);
  pbody.querySelector('#resplit').onclick = async e => {
    const job = KN.job; if (!job) return; const b = e.target, note = pbody.querySelector('#rsn').value.trim(); b.disabled = true; b.textContent = '重拆中…';
    try {
      let prompt = window.knPromptExtra ? knPromptExtra(KN.buildPrompt()) : KN.buildPrompt();
      prompt = prompt.replace('\n\nJSON 格式：', `\n7. 這是重拆：上一次的拆法她不滿意，請換個角度重新拆。${note ? '她的要求：' + note : ''}\n\nJSON 格式：`);
      let text = (await aiAsk(prompt)).text; if (window.knIntegrate) { try { text = await knIntegrate(text); } catch (er) {} }
      const r = KN.parseAnswer(text); if (!r) throw new Error('AI 的回答看不懂');
      job.answer = text; job.r = r; KN.step3(); toast('重拆好了');
    } catch (er) { toast('重拆沒成功：' + er.message, 6000); b.disabled = false; b.textContent = 'AI 重拆'; }
  };
}
new MutationObserver(addResplit).observe(pbody, { childList: true });
})();
