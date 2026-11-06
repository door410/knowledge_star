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
      ext = await T.pipeline('feature-extraction', MODEL, { dtype: 'q8', progress_callback: d => { if (d.status === 'progress' && d.total > 5e6 && Date.now() - shown > 1500) { shown = Date.now(); toast(`第一次下載意思模型 ${Math.round(d.progress)}%（只下載一次）`); } } });
    } catch (e) { vecOff = true; console.warn(e); toast('意思模型載入失敗，先只用關鍵字找', 6000); }
    return ext;
  })());
}
const embed = async texts => (await ext(texts, { pooling: 'cls', normalize: true })).tolist();
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
.rcp{border:1px solid #8884;border-radius:10px;padding:8px 12px;margin:8px 0}.rcp blockquote{margin:0 0 6px;opacity:.85}.rcp .nm{cursor:pointer;font-weight:bold;background:none;border:0;color:inherit;padding:0;font-size:inherit}
#cbody textarea.mine{width:100%;box-sizing:border-box;min-height:9em;background:transparent;color:inherit;border:1px solid #8886;border-radius:8px;padding:6px;font:inherit}`));
const ptitle = document.getElementById('ptitle');
// 右側小面板（問答、編輯台…）的位置改在 folder.js openPane 決定（11/7）

// ---------- 問答（右邊面板）----------
let qaLast = { q: '', html: '' };
qaBtn.onclick = () => {
  openPane('問答', `<div class="row"><input type="text" id="qq" placeholder="問你的知識網" style="flex:1;min-width:0" value="${E(qaLast.q)}"><button class="go" id="qgo">問</button></div><div id="qout">${qaLast.html}</div>`);
  const qq = pbody.querySelector('#qq'), out = pbody.querySelector('#qout');
  const bind = () => out.querySelectorAll('.cite').forEach(b => b.onclick = () => goPoint(b.dataset.id));
  bind();
  const ask = async () => {
    const q = qq.value.trim(); if (!q) return;
    const list = pts(); if (!list.length) { out.innerHTML = '<p>知識網裡還沒有你的知識點。</p>'; return; }
    out.innerHTML = '<p class="note">找資料中…</p>';
    const hits = await (await finder(list, true))(q, 8, true);
    KNX.glow = new Set(hits.map(p => byId[p.id]).filter(Boolean)); dirty = true;   // 知識網上相關的點亮起來
    if (!hits.length) { out.innerHTML = '<p class="qa-a">資料裡沒有。</p>'; qaLast = { q, html: out.innerHTML }; return; }
    const title = p => (K.sources.find(s => s.id === srcOf(p)) || {}).title || '';
    const refs = '<div class="ksec">找到的知識點</div><div class="kgrid">' + hits.map((p, i) => `<div class="kc cite" tabindex="0" data-id="${E(p.id)}"><div class="t"><span class="kno">${i + 1}</span>${E(p.name)}</div><div class="s">${E(title(p))}</div></div>`).join('') + '</div>';
    out.innerHTML = '<p class="note">AI 回答中…</p>' + refs; bind();
    let ans = null;
    try {
      const r = await aiAsk(`只根據下面的「資料」回答問題，不要用你自己的知識。每句話後面用 [編號] 標出根據哪一筆資料。資料裡沒有答案，就只回答「資料裡沒有」。用繁體中文、白話。只輸出 JSON：{"回答":""}

問題：${q}

資料：
${hits.map((p, i) => `[${i + 1}] ${p.name}：${p.desc || ''}${p.quote ? '（原文：' + p.quote.slice(0, 200) + '）' : ''}`).join('\n')}`);
      ans = (pj(r.text) || {})['回答'] || r.text;
    } catch (e) { toast('AI 沒成功：' + e.message, 6000); }
    out.innerHTML = (ans == null ? '<p class="note">AI 沒有回答，下面是找到的知識點。</p>'
      : `<div class="qa-a">${E(ans).replace(/\[(\d+)\]/g, (m, n) => hits[n - 1] ? `<button class="cite" data-id="${E(hits[n - 1].id)}">${n}</button>` : m)}</div>`) + refs;
    bind(); qaLast = { q, html: out.innerHTML };
  };
  pbody.querySelector('#qgo').onclick = ask;
  qq.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) ask(); };
  qq.focus();
};

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
