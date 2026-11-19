// Layer 2：引用核對、關鍵字＋意思找相關（混合）、整合判斷、問答、最近消化、卡片「我的想法」
// 意思座標：本機向量模型（bge-base-zh-v1.5），在瀏覽器裡跑；模型和座標存在這台電腦的瀏覽器，可以刪掉重建。
(() => {
const KN = window.KN, { h, toast, qtip, openPane, pbody, pane, RTYPES } = KN;
const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pts = () => KN.realPts().filter(p => !p.priv);            // 私人的不給 AI
const ptxt = p => p.name + '：' + (p.desc || '');
const srcOf = p => (p._path || '').split('/')[0];
const pj = t => { t = String(t || ''); const m = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) t = m[1]; const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } };
function goPoint(id) { const q = byId[id]; if (!q) return; view.sel = q; tip.style.display = 'none'; flyPoint(q); openCard(q); }

// ---------- 引用核對：AI 引的原文，在原文裡找不找得到（忽略空白和標點）----------
const norm = s => String(s || '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
function quoteCheck(quote, full) {
  const q = norm(quote), f = norm(full);
  if (!q) return 'none';
  if (f.includes(q)) return 'ok';
  const ch = []; for (let i = 0; i + 6 <= q.length; i += 6) ch.push(q.slice(i, i + 6));
  return ch.length && ch.filter(c => f.includes(c)).length / ch.length >= 0.6 ? 'part' : 'miss';
}
const QC = { ok: '✓ 原文對得上', part: '≈ 部分對得上', miss: '⚠ 原文裡找不到', none: '' };

// ---------- 關鍵字找（雙字切詞 BM25，沿用舊提問包的做法）----------
const toks = s => { s = String(s || '').toLowerCase(); const out = s.match(/[a-z0-9]+/g) || [];
  s.replace(/[^\p{Script=Han}]/gu, ' ').split(/\s+/).filter(Boolean).forEach(w => { if (w.length === 1) out.push(w); for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2)); });
  return out; };
function bm25(docs) {
  const N = docs.length, df = {};
  const tf = docs.map(d => { const m = {}; toks(d.text).forEach(t => m[t] = (m[t] || 0) + 1); Object.keys(m).forEach(t => df[t] = (df[t] || 0) + 1); return m; });
  const len = tf.map(m => Object.values(m).reduce((a, b) => a + b, 0)), avg = len.reduce((a, b) => a + b, 0) / (N || 1);
  return q => { const qt = [...new Set(toks(q))];
    return docs.map((d, i) => { let s = 0; qt.forEach(t => { const f = tf[i][t]; if (!f) return; s += Math.log(1 + (N - df[t] + .5) / (df[t] + .5)) * f * 2.2 / (f + 1.2 * (.25 + .75 * len[i] / avg)); }); return { p: d.p, s }; })
      .filter(x => x.s > 0).sort((a, b) => b.s - a.s); };
}

// ---------- 意思座標（本機向量模型）----------
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js';
const MODEL = 'Xenova/bge-base-zh-v1.5', QPRE = '为这个句子生成表示以用于检索相关文章：';
const db = new Promise((res, rej) => { const o = indexedDB.open('kn-vec', 1); o.onupgradeneeded = () => { o.result.createObjectStore('files'); o.result.createObjectStore('vec'); }; o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
const st = (name, mode, fn) => db.then(d => new Promise((res, rej) => { const t = d.transaction(name, mode), r = fn(t.objectStore(name)); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
const fileCache = {   // 模型檔存在瀏覽器（IndexedDB），只下載一次
  async match(k) { const b = await st('files', 'readonly', s => s.get(String(k))); return b ? new Response(b, { headers: { 'content-length': String(b.byteLength) } }) : undefined; },
  async put(k, r) { const b = await r.arrayBuffer(); await st('files', 'readwrite', s => s.put(b, String(k))); } };
let ext = null, extP = null, vecOff = false; const V = new Map();
function loadModel() {
  if (ext || vecOff) return Promise.resolve(ext);
  return extP || (extP = (async () => {
    try {
      const T = await import(LIB);
      Object.assign(T.env, { allowLocalModels: false, useBrowserCache: false, useCustomCache: true, customCache: fileCache });
      let shown = 0;
      ext = await T.pipeline('feature-extraction', MODEL, { dtype: 'q8', progress_callback: d => { if (d.status === 'progress' && d.total > 5e6 && !store.get('vecok', false) && Date.now() - shown > 1500) { shown = Date.now(); toast(`第一次下載意思模型 ${Math.round(d.progress)}%（只下載一次）`); } } });
      store.set('vecok', true);
    } catch (e) { vecOff = true; console.warn(e); toast('意思模型載入失敗，先只用關鍵字找', 6000); }
    return ext;
  })());
}
// 用完 3 分鐘沒再用就放掉記憶體（模型檔還在裝置裡，下次用時幾秒內載回來）
let idleT = 0;
async function freeModel() { const m = ext; if (!m) return; ext = null; extP = null; try { await m.dispose(); } catch (e) {} }
const embed = async texts => { const m = await loadModel(); if (!m) throw new Error('沒有意思模型'); clearTimeout(idleT); idleT = setTimeout(freeModel, 180000); return (await m(texts, { pooling: 'cls', normalize: true })).tolist(); };
async function ensureVec(list) {
  if (!(await loadModel())) return false;
  const saved = (await st('vec', 'readonly', s => s.get(MODEL))) || {};
  const need = list.filter(p => { const v = V.get(p.id) || saved[p.id]; if (v && v.t === ptxt(p)) { V.set(p.id, v); return false; } return true; });
  for (let i = 0; i < need.length; i += 16) {
    const b = need.slice(i, i + 16), vs = await embed(b.map(ptxt));
    b.forEach((p, j) => V.set(p.id, { t: ptxt(p), v: Float32Array.from(vs[j]) }));
    if (need.length > 32) toast(`建立意思座標 ${Math.min(i + 16, need.length)}／${need.length}`);
  }
  if (need.length) { const o = Object.assign({}, saved); V.forEach((v, k) => o[k] = v); await st('vec', 'readwrite', s => s.put(o, MODEL)); }
  return true;
}
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// ---------- 混合找：關鍵字＋意思，用名次合併（RRF）----------
async function finder(list, withQuote) {
  const kw = bm25(list.map(p => ({ p, text: p.name + ' ' + p.name + ' ' + (p.desc || '') + (withQuote ? ' ' + (p.quote || '') : '') })));
  const vec = await ensureVec(list).catch(e => { console.warn(e); return false; });
  return async (q, k, isQ) => {
    const a = kw(q).slice(0, 20); let b = [];
    if (vec) { const [qv] = await embed([(isQ ? QPRE : '') + q]); b = list.map(p => ({ p, s: V.get(p.id) ? dot(qv, V.get(p.id).v) : 0 })).filter(x => x.s >= 0.5).sort((x, y) => y.s - x.s).slice(0, 20); }
    const sc = new Map(); [a, b].forEach(L => L.forEach((x, r) => sc.set(x.p, (sc.get(x.p) || 0) + 1 / (60 + r))));
    return [...sc].sort((x, y) => y[1] - x[1]).slice(0, k).map(([p]) => p);
  };
}

// ---------- 整合判斷：AI 拆完後，找舊的相關知識點，請 AI 判斷（ai.js 呼叫）----------
window.knIntegrate = async text => {
  const o = pj(text); if (!o) return text;
  const np = (o['知識點'] || []).filter(p => p && p['名稱']), old = pts();
  if (!np.length || !old.length) return text;
  const find = await finder(old), pairs = [];
  for (const p of np) (await find(p['名稱'] + '：' + (p['說明'] || ''), 5)).forEach(q => pairs.push([p, q]));
  if (!pairs.length) return text;
  const r = await aiAsk(`判斷每一組「新」和「舊」知識點的關係。只輸出一個 JSON，不要其他說明。
關係只能是「有關」「名字像但不同」「無關」其中一個。字不同但意思相關＝有關；名字一樣或很像、但意思不同＝名字像但不同。
有關的，類型從「${RTYPES.join('、')}」選一個，說明寫一句白話（為什麼有關）。
格式：{"判斷":[{"組":1,"關係":"有關","類型":"有關","說明":""}]}

${pairs.map(([n, q], i) => `${i + 1}. 新：${n['名稱']}｜${n['說明'] || ''}\n   舊：${q.name}｜${q.desc || ''}`).join('\n')}`);
  const j = pj(r.text) || {}, L = o['關聯'] = o['關聯'] || [], have = new Set(L.map(l => l['甲'] + '>' + l['乙']));
  let n = 0;
  (j['判斷'] || []).forEach(d => {
    const pr = pairs[(parseInt(d['組']) || 0) - 1]; if (!pr || d['關係'] !== '有關') return;
    const k = pr[0]['名稱'] + '>' + pr[1].id; if (have.has(k)) return; have.add(k); n++;
    L.push({ 甲: pr[0]['名稱'], 乙: pr[1].id, 類型: RTYPES.includes(d['類型']) ? d['類型'] : '有關', 說明: String(d['說明'] || '') });
  });
  toast(`整合判斷：和舊知識點多找到 ${n} 條關聯`, 5000);
  return JSON.stringify(o);
};

// ---------- 工具列、樣式 ----------
const qaBtn = h('button', { className: 'c', textContent: '問答' }), rcBtn = h('button', { className: 'c', textContent: '最近消化' });
document.getElementById('fbar').append(qaBtn, rcBtn);
document.head.append(h('style', {}, `.cite{cursor:pointer;border:1px solid #8888;border-radius:6px;padding:0 5px;margin:0 3px;font-size:12px;background:none;color:inherit}
.qa-a{white-space:pre-wrap;margin:10px 0}.qa-l p,.rcs{margin:4px 0}.rcs{cursor:pointer}.qc{font-size:12px;opacity:.8;margin-left:8px}.qc.miss{color:#e07070;opacity:1}
.qa-row{margin:0 0 4px!important;flex-wrap:nowrap!important}.qa-row #qq{flex:1;min-width:0}
.qa-opt{border:0;background:none;color:inherit;opacity:.4;font-size:18px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:6px}.qa-opt:hover,.qa-opt.on{opacity:.9}
.qa-set{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;opacity:.75;margin:0 0 6px}.qa-set label{display:inline-flex;gap:4px;align-items:center;cursor:pointer}
.qa-mini{margin:2px 0 8px;font-size:12px}.qa-mini>summary{list-style:none;cursor:pointer;opacity:.4;font-size:11px;user-select:none;display:inline-block;padding:2px 0}
.qa-mini>summary::-webkit-details-marker{display:none}.qa-mini>summary::after{content:' ▾'}.qa-mini:not([open])>summary::after{content:' ▸'}
.qchips{display:flex;flex-wrap:wrap;gap:4px 6px;margin-top:3px}
.qchip{border:0;background:color-mix(in srgb,currentColor 9%,transparent);color:inherit;opacity:.7;border-radius:999px;padding:2px 9px;font:inherit;font-size:12px;line-height:1.6;cursor:pointer}.qchip:hover{opacity:1}
.rcp{border:1px solid #8884;border-radius:10px;padding:8px 12px;margin:8px 0}.rcp blockquote{margin:0 0 6px;opacity:.85}.rcp .nm{cursor:pointer;font-weight:bold;background:none;border:0;color:inherit;padding:0;font-size:inherit}
#cbody textarea.mine{width:100%;box-sizing:border-box;min-height:9em;background:transparent;color:inherit;border:1px solid #8886;border-radius:8px;padding:6px;font:inherit}`));
const ptitle = document.getElementById('ptitle');
// 右側小面板（問答、編輯台…）的位置改在 folder.js openPane 決定（11/7）

// ---------- 問答（11/20 改版）：關鍵字＋意思混合找 ----------
// 三個幫手各自可以開關（⋯）：打字即時出結果、還沒打字先給提示（主題、隨機、快忘、最近新增）、結果下面給相關詞；關掉只是不顯示，功能還在。
// 有 AI 金鑰：按「問」或 Enter 會多一段 AI 根據知識點寫的回答；沒有金鑰就只列找到的知識點，不跳錯。
const QA = Object.assign({ live: true, hint: true, rel: true, sim: true, shut: {} }, store.get('qa', {}));
const saveQA = () => store.set('qa', QA);
const hasAI = () => !!(window.aiReady && window.aiReady());
let qaLast = { q: '', cur: null };
// 找的索引：資料沒變就不重建（打字即時找才不會卡）；主題、子主題名稱也找得到
let IDX = null;
const tnames = p => { const t = K.topics.find(x => x.id === p.topic); if (!t) return ''; const par = t.parent && K.topics.find(x => x.id === t.parent); return (par ? par.name + ' ' : '') + t.name; };
function index() {
  const list = pts();
  if (IDX && IDX.pts === K.points && IDX.n === list.length) return IDX;
  return IDX = { pts: K.points, n: list.length, list, kw: bm25(list.map(p => ({ p, text: p.name + ' ' + p.name + ' ' + (p.desc || '') + ' ' + (p.quote || '') + ' ' + tnames(p) }))), vec: null };
}
async function search(q, k, deep) {
  const I = index(), a = I.kw(q).slice(0, 20), kwOnly = () => a.slice(0, k).map(x => x.p);
  if (!deep || vecOff) return kwOnly();
  if (!I.vec) I.vec = ensureVec(I.list).catch(e => { console.warn(e); return false; });
  if (!(await I.vec)) return kwOnly();
  let qv; try { [qv] = await embed([QPRE + q]); } catch (e) { return kwOnly(); }
  const b = I.list.map(p => ({ p, s: V.get(p.id) ? dot(qv, V.get(p.id).v) : 0 })).filter(x => x.s >= 0.5).sort((x, y) => y.s - x.s).slice(0, 20);
  const sc = new Map(); [a, b].forEach(L => L.forEach((x, r) => sc.set(x.p, (sc.get(x.p) || 0) + 1 / (60 + r))));
  return [...sc].sort((x, y) => y[1] - x[1]).slice(0, k).map(([p]) => p);
}
// 相關詞：找到的知識點裡，好幾個都出現、但在整個知識網不常見的詞（2～4 字）
const NUMW = /^[一二三四五六七八九十百千萬零兩幾半分秒鐘年月日天週次個多少]+$/;   // 「二十」「分鐘」這種數字、單位不當相關詞
const STOP = new Set('的了是在和與及或也就都而且但被把讓給對從向於以為之其這那些個一不有沒會要能可很更最等並又還再已所如若則即因此故然後前中上下內外時地得著過來去到說看用做你我他她它們嗎呢吧啊每各該'.split(''));
function relTerms(hits, q) {
  const all = index().list, cnt = new Map(), ql = q.toLowerCase();
  hits.forEach(p => { const seen = new Set(), t = p.name + '。' + (p.desc || '');
    t.replace(/[^\p{Script=Han}]+/gu, ' ').split(' ').forEach(w => { for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= w.length; i++) { const g = w.slice(i, i + n); if (!STOP.has(g[0]) && !STOP.has(g[n - 1])) seen.add(g); } });
    (t.match(/[A-Za-z][A-Za-z0-9]{2,}/g) || []).forEach(g => seen.add(g.toLowerCase()));
    seen.forEach(g => cnt.set(g, (cnt.get(g) || 0) + 1)); });
  let c = [...cnt].filter(([g, n]) => n >= 2 && !NUMW.test(g) && !ql.includes(g) && !g.includes(ql));
  c = c.filter(([g, n]) => !c.some(([g2, n2]) => g2 !== g && g2.length > g.length && g2.includes(g) && n2 >= n));
  const N = all.length || 1;
  return c.map(([g, n]) => { const df = all.filter(p => (p.name + (p.desc || '')).toLowerCase().includes(g)).length || 1; return [g, n * Math.log(1 + N / df)]; })
    .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g);
}
const subOf = sid => K.topics.find(t => t.id === sid);
const topOfP = p => { const t = subOf(p.topic); return t ? (t.parent || t.id) : ''; };
const live = p => byId[p.id] || p;   // 畫面上的那個點（有「最近看過」「建立時間」）
const chipsHtml = cs => `<div class="qchips">${cs.map(c => `<button class="qchip" ${c.a}>${E(c.t)}</button>`).join('')}</div>`;
const mini = (key, title, cs) => cs.length ? `<details class="qa-mini" data-m="${key}"${QA.shut[key] ? '' : ' open'}><summary>${title}</summary>${chipsHtml(cs)}</details>` : '';

// 找相似的：拿一個知識點的意思座標去比其他點（沒有意思模型時用它的名稱和說明當關鍵字）
async function similar(p, k) {
  const I = index(), a = I.kw(p.name + ' ' + (p.desc || '')).filter(x => x.p.id !== p.id).slice(0, 20);
  let b = [];
  if (!vecOff) {
    if (!I.vec) I.vec = ensureVec(I.list).catch(e => { console.warn(e); return false; });
    if (await I.vec) try {
      const v = V.get(p.id) ? V.get(p.id).v : (await embed([ptxt(p)]))[0];
      b = I.list.filter(q => q.id !== p.id).map(q => ({ p: q, s: V.get(q.id) ? dot(v, V.get(q.id).v) : 0 })).filter(x => x.s >= 0.55).sort((x, y) => y.s - x.s).slice(0, 20);
    } catch (e) { console.warn(e); }
  }
  const sc = new Map(); [a, b].forEach((L, j) => L.forEach((x, r) => sc.set(x.p, (sc.get(x.p) || 0) + (j ? 1.3 : 1) / (60 + r))));   // 意思比較準，稍微加重
  return [...sc].sort((x, y) => y[1] - x[1]).slice(0, k).map(([q]) => q);
}
function qaPane(opt = {}) {
  openPane('問答', `<div class="row qa-row"><input type="text" id="qq" placeholder="問你的知識網" autocomplete="off" value="${E(qaLast.q)}"><button class="go" id="qgo">問</button><button class="qa-opt" id="qopt" title="問答設定" aria-label="問答設定">⋯</button></div>
   <div class="qa-set" hidden>${[['live', '即時結果'], ['hint', '提示'], ['rel', '相關詞'], ['sim', '卡片找相似']].map(([k, t]) => `<label><input type="checkbox" data-qa="${k}"${QA[k] ? ' checked' : ''}>${t}</label>`).join('')}</div>
   <div id="qhint"></div><div id="qout"></div>`);
  const qq = pbody.querySelector('#qq'), out = pbody.querySelector('#qout'), hint = pbody.querySelector('#qhint'), go = pbody.querySelector('#qgo'), set = pbody.querySelector('.qa-set');
  let cur = qaLast.cur, seq = 0, tmr = 0;
  const title = p => (K.sources.find(s => s.id === srcOf(p)) || {}).title || '';
  const card = (p, i) => `<div class="kc cite" tabindex="0" data-id="${E(p.id)}"><div class="t"><span class="kno">${i + 1}</span>${E(p.name)}</div><div class="s">${E(title(p))}${cur && cur.linked && cur.linked.includes(p.id) ? '・已有關聯' : ''}</div></div>`;
  const glow = L => { KNX.glow = L && L.length ? new Set(L.map(p => byId[p.id]).filter(Boolean)) : null; dirty = true; };
  const goBtn = () => { go.hidden = QA.live && !hasAI(); go.textContent = hasAI() ? '問' : '找'; };
  function drawHint() {
    const q = qq.value.trim(), list = pts();
    if (!QA.hint || !list.length || (q && !(cur && !cur.list.length))) { hint.innerHTML = ''; return; }
    const tops = K.topics.filter(t => !t.parent).map(t => [t, list.filter(p => topOfP(p) === t.id).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
    hint.innerHTML = mini('hint', '提示', [{ t: '隨機一個', a: 'data-qk="rand"' }, { t: '快忘的', a: 'data-qk="fade"' }, { t: '最近新增', a: 'data-qk="new"' },
      ...tops.map(([t]) => ({ t: t.name, a: `data-top="${E(t.id)}"` }))]);
  }
  function render() {
    if (!cur) out.innerHTML = '';
    else out.innerHTML = (cur.ans || '') + (cur.list.length ? `<div class="ksec">${E(cur.head)}</div><div class="kgrid">${cur.list.map(card).join('')}</div>` : `<p class="kempty">${E(cur.empty || '沒找到')}</p>`)
      + (QA.rel && cur.rel ? mini('rel', '相關', cur.rel) : '');
    qaLast = { q: qq.value, cur }; drawHint();
  }
  const show = (list, head, rel, extra = {}) => { cur = Object.assign({ list, head, rel }, extra); glow(list); render(); };
  const relFor = (hits, q) => { const subs = [...new Set(hits.map(p => p.topic))].map(subOf).filter(t => t && t.parent && !q.includes(t.name)).slice(0, 4);
    const sn = new Set(subs.map(t => t.name));
    return [...subs.map(t => ({ t: t.name, a: `data-sub="${E(t.id)}"` })), ...relTerms(hits, q).filter(g => !sn.has(g)).map(g => ({ t: g, a: `data-q="${E(g)}"` }))]; };
  async function run(q, withAI) {
    const my = ++seq; if (!q) { cur = null; glow(null); render(); return; }
    const k0 = await search(q, 8, false);   // 關鍵字先出來；意思模型第一次載入要幾秒，載好再補
    if (my !== seq) return; if (k0.length) show(k0, '找到的知識點', relFor(k0, q)); else { cur = { list: [], head: '', empty: '找資料中…' }; render(); }
    const hits = await search(q, 8, true); if (my !== seq) return;
    show(hits, '找到的知識點', relFor(hits, q));
    if (!withAI || !hits.length || !hasAI()) return;
    cur.ans = '<p class="note">AI 回答中…</p>'; render();
    let ans = null;
    try {
      const r = await aiAsk(`只根據下面的「資料」回答問題，不要用你自己的知識。每句話後面用 [編號] 標出根據哪一筆資料。資料裡沒有答案，就只回答「資料裡沒有」。用繁體中文、白話。只輸出 JSON：{"回答":""}

問題：${q}

資料：
${hits.map((p, i) => `[${i + 1}] ${p.name}：${p.desc || ''}${p.quote ? '（原文：' + p.quote.slice(0, 200) + '）' : ''}`).join('\n')}`);
      ans = (pj(r.text) || {})['回答'] || r.text;
    } catch (e) { toast('AI 沒成功：' + e.message, 6000); }
    if (my !== seq) return;
    cur.ans = ans == null ? '' : `<div class="qa-a">${E(ans).replace(/\[(\d+)\]/g, (m, n) => hits[n - 1] ? `<button class="cite" data-id="${E(hits[n - 1].id)}">${n}</button>` : m)}</div>`;
    render();
  }
  async function quick(q) { const my = ++seq; const hits = await search(q, 8, false); if (my === seq && hits.length) show(hits, '找到的知識點', relFor(hits, q)); }
  const browse = (list, head, rel) => { seq++; show(list, head, rel, { empty: '這裡還沒有知識點' }); };
  const subChips = tid => K.topics.filter(t => t.parent === tid).map(t => ({ t: t.name, a: `data-sub="${E(t.id)}"` }));
  function onPick(e) {
    const c = e.target.closest('[data-id],[data-qk],[data-top],[data-sub],[data-q]'); if (!c) return;
    if (c.dataset.id) return goPoint(c.dataset.id);
    const list = pts();
    if (c.dataset.q) { qq.value = c.dataset.q; run(c.dataset.q, false); return; }
    qq.value = '';
    if (c.dataset.top) { const t = c.dataset.top; browse(list.filter(p => topOfP(p) === t), (subOf(t) || {}).name || t, subChips(t)); }
    else if (c.dataset.sub) { const s = subOf(c.dataset.sub) || {}, pn = s.parent ? (subOf(s.parent) || {}).name || s.parent : '';
      browse(list.filter(p => p.topic === c.dataset.sub), (pn ? pn + '／' : '') + (s.name || ''), [...(pn ? [{ t: '← ' + pn, a: `data-top="${E(s.parent)}"` }] : []), ...subChips(s.parent).filter(x => !x.a.includes(`"${E(c.dataset.sub)}"`))]); }
    else if (c.dataset.qk === 'rand') { const p = list[Math.floor(Math.random() * list.length)]; if (p) { browse([p], '隨機一個', []); goPoint(p.id); } }
    else if (c.dataset.qk === 'fade') browse(list.slice().sort((a, b) => (live(b).seen || 0) - (live(a).seen || 0)).slice(0, 12), '快忘的（最久沒看）', []);
    else if (c.dataset.qk === 'new') browse(list.slice().sort((a, b) => (live(b).created || 0) - (live(a).created || 0)).slice(0, 12), '最近新增', []);
  }
  [out, hint].forEach(el => { el.addEventListener('click', onPick); el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.kc[data-id]')) onPick(e); });
    el.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('details[data-m]'); if (!d) return; if (d.open) delete QA.shut[d.dataset.m]; else QA.shut[d.dataset.m] = true; saveQA(); }, true); });
  pbody.querySelector('#qopt').onclick = e => { set.hidden = !set.hidden; e.currentTarget.classList.toggle('on', !set.hidden); };
  set.querySelectorAll('[data-qa]').forEach(x => x.onchange = () => { QA[x.dataset.qa] = x.checked; saveQA(); goBtn(); render(); });
  // 打字即時：先用關鍵字馬上出，停一下再用意思找補上（中文選字中不找）
  let comp = false;
  qq.addEventListener('compositionstart', () => comp = true);
  qq.addEventListener('compositionend', () => { comp = false; qq.dispatchEvent(new Event('input')); });
  qq.oninput = () => { qaLast.q = qq.value; if (comp) return; const q = qq.value.trim();
    if (!q) { clearTimeout(tmr); seq++; if (cur && cur.head === '找到的知識點') { cur = null; glow(null); } render(); return; }
    drawHint(); if (!QA.live) return; quick(q); clearTimeout(tmr); tmr = setTimeout(() => run(q, false), 350); };
  const ask = () => { clearTimeout(tmr); const q = qq.value.trim(); if (!q) return; if (!pts().length) { cur = { list: [], head: '', empty: '知識網裡還沒有你的知識點。' }; render(); return; } run(q, true); };
  go.onclick = ask;
  qq.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) ask(); };
  async function simRun(p) {
    const my = ++seq; clearTimeout(tmr); qq.value = ''; cur = { list: [], head: '', empty: '找相似的中…' }; render();
    const hits = await similar(p, 8); if (my !== seq) return;
    show(hits, `和「${p.name}」相似的`, relFor(hits, p.name), { linked: (adj[p.id] || []).map(r => r.p.id), empty: '沒找到相似的' });
  }
  goBtn(); render(); if (cur) glow(cur.list);
  if (opt.sim) simRun(opt.sim);
  if (!matchMedia('(pointer:coarse)').matches) qq.focus();
}
qaBtn.onclick = () => qaPane();
// 知識點卡片「說明」分頁：「找相似的」（放在 ✎ 編輯 旁邊；問答的 ⋯ 可以關掉）。等所有程式載入完再接，才排得到最後
addEventListener('load', () => {
  const o = window.openCard;
  window.openCard = openCard = function (p, tab) {
    o(p, tab);
    if (!QA.sim || !p || p.demo || !p.id) return;
    const on = document.querySelector('#ctabs button.on'); if (!on || on.dataset.t !== 'desc') return;
    const B = document.getElementById('cbody'), b = h('button', { className: 'c', textContent: '找相似的' });
    b.style.marginTop = '8px';
    b.onclick = () => { if (innerWidth < 700) card.hidden = true; qaPane({ sim: p }); };
    const ed = [...B.querySelectorAll(':scope > button.c')].find(x => x.textContent.includes('編輯'));
    if (ed) { b.style.marginLeft = '6px'; ed.after(b); } else B.append(b);
  };
});

// ---------- 最近消化（補看拆解、理由、引用核對）----------
function recentPane() {
  const all = KN.realPts(), srcs = K.sources.filter(s => !s.demo).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title)).slice(0, 60);
  openPane('回顧', '<span data-rv hidden></span>' + (srcs.length ? '<div class="kgrid">' + srcs.map(s => `<div class="kc" tabindex="0" data-s="${E(s.id)}"><div class="t">${E(s.title)}</div><div class="s">${E(s.date)}・${all.filter(p => srcOf(p) === s.id).length} 點</div></div>`).join('') + '</div>' : '<p class="kempty">還沒有消化過的來源。</p>'));
  pbody.querySelectorAll('[data-s]').forEach(b => b.onclick = () => srcPane(b.dataset.s));
  if (window.knRecentTabs) knRecentTabs();
}
window.knRecent = recentPane;
rcBtn.onclick = recentPane;
async function srcPane(id) {
  const s = K.sources.find(x => x.id === id), list = KN.realPts().filter(p => srcOf(p) === id);
  let full = '';
  try { const dh = await (await KN.root.getDirectoryHandle('02-知識')).getDirectoryHandle(id); full = await (await (await dh.getFileHandle('原文.md')).getFile()).text(); } catch (e) {}
  const chk = list.map(p => quoteCheck(p.quote, full)), has = chk.filter(c => c !== 'none').length, ok = chk.filter(c => c === 'ok').length;
  openPane(s ? s.title : id, `<div class="row"><button class="go sub" id="rb">← 回顧</button><button class="go sub" id="rf">整篇原文</button>${has ? `<span class="note">原文對得上 ${ok}／${has}</span>${qtip('AI 引的原文，在你存的原文裡找不找得到（忽略空白和標點）。')}` : ''}</div>${(() => { const m = full.match(/^類型:\s*(.*)$/m); return `<p class="note">怎麼進來的：${m ? E(m[1].replace(/^"|"$/g, '')) : '—'}｜${E(s ? s.date : '')}</p>`; })()}<div id="rfull" hidden></div>
   ${list.map((p, i) => `<div class="rcp">${p.quote ? `<blockquote>${E(p.quote)}</blockquote>` : ''}<button class="nm" data-id="${E(p.id)}">${E(p.name)}</button><span class="qc ${chk[i]}">${QC[chk[i]]}</span><p>${E(p.desc)}</p>${p.why ? `<p class="note">${E(p.why)}</p>` : ''}</div>`).join('')}`);
  pbody.querySelector('#rb').onclick = recentPane;
  pbody.querySelectorAll('.nm').forEach(b => b.onclick = () => { KN.closePane(); goPoint(b.dataset.id); });
  pbody.querySelector('#rf').onclick = () => {
    const box = pbody.querySelector('#rfull'); if (!box.hidden) { box.hidden = true; return; }
    box.className = 'src full'; box.innerHTML = KN.mdHtml(full || '（找不到原文）');
    list.forEach((p, i) => p.quote && KN.markQuote(box, p.quote, KN.HL[i % KN.HL.length], i)); box.hidden = false;
  };
}

// ---------- 卡片「我的想法」：打字、存進那個知識點的檔案 ----------
const _oc = window.openCard;
window.openCard = openCard = function (p, tab = 'desc') {
  _oc(p, tab);
  if (tab !== 'mine') return;
  const B = document.getElementById('cbody');
  if (p.demo || !p._path || !KN.root) { B.innerHTML = '<p class="meta">示範點不能寫想法。</p>'; return; }
  B.innerHTML = `<textarea class="mine" placeholder="寫下你的想法">${E(p.mine || '')}</textarea><div class="row"><button class="go" id="mok">存</button></div>`;
  B.querySelector('#mok').onclick = async () => {
    const v = B.querySelector('textarea').value.trim(), [dn, fn] = p._path.split('/');
    const dh = await (await KN.root.getDirectoryHandle('02-知識')).getDirectoryHandle(dn);
    let t = (await (await (await dh.getFileHandle(fn)).getFile()).text()).replace(/\r\n/g, '\n').replace(/\n## 我的想法\n[\s\S]*?(?=\n## |$)/, '');
    if (v) { const sec = '\n## 我的想法\n' + v + '\n'; t = /\n## 關聯[ \t]*(?=\n|$)/.test(t) ? t.replace(/\n## 關聯[ \t]*(?=\n|$)/, sec + '\n## 關聯') : t.replace(/\s*$/, '\n') + sec; }
    await KN.writeFile(dh, fn, t);
    const id = p.id; await KN.load(true); if (byId[id]) openCard(byId[id], 'mine'); toast('已存好想法');
  };
};
window.KN2 = { finder, bm25, quoteCheck, pts, pj, ensureVec, V, dot, srcOf };   // 給 eval.js 用
})();
