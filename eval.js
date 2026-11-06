// 評估成績表（07 第六節，面試作品集用）：實驗一 拆點品質、實驗二 整合判斷、實驗三 問答
// 資料存在 04-知識網/評估.json；成績表可存成 04-知識網/評估成績表.md
(() => {
const KN = window.KN, { toast, qtip, openPane, pbody } = KN, X = () => window.KN2;
const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s || '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const pct = x => x == null ? '—' : Math.round(x * 100) + '%';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readF = async (dh, fn) => (await (await dh.getFileHandle(fn)).getFile()).text();
const dir = () => KN.root.getDirectoryHandle('04-知識網', { create: true });
let EV = null;
async function loadEV() {
  if (EV) return EV; EV = { split: [], labels: {}, cand: null, ai: {}, qs: [], res: {} };
  try { Object.assign(EV, JSON.parse(await readF(await dir(), '評估.json'))); } catch (e) {}
  return EV;
}
const saveEV = async () => KN.writeFile(await dir(), '評估.json', JSON.stringify(EV));
window.knLog = async o => { if (!KN.root) return; await loadEV(); EV.split.push({ t: Date.now(), ...o }); saveEV(); };  // folder.js 存檔時呼叫

// ---------- 實驗一：拆點品質 ----------
async function exp1() {
  const all = KN.realPts(), kd = await KN.root.getDirectoryHandle('02-知識'); let ok = 0, has = 0, bN = 0, bHit = 0;
  for (const s of K.sources.filter(s => !s.demo)) {
    let full = ''; try { full = await readF(await kd.getDirectoryHandle(s.id), '原文.md'); } catch (e) { continue; }
    const ps = all.filter(p => X().srcOf(p) === s.id);
    ps.forEach(p => { const c = X().quoteCheck(p.quote, full); if (c !== 'none') { has++; if (c === 'ok') ok++; } });
    const bold = [...new Set([...full.matchAll(/\*\*(.+?)\*\*/g)].map(m => m[1].trim()).filter(b => b.length >= 2 && b.length <= 20))];
    const blob = norm(ps.map(p => p.name + (p.desc || '')).join(''));
    bN += bold.length; bHit += bold.filter(b => blob.includes(norm(b))).length;
  }
  const prop = EV.split.reduce((a, x) => a + x.proposed, 0), kept = EV.split.reduce((a, x) => a + x.kept, 0);
  EV.res.e1 = { t: Date.now(), pts: all.length, cite: has ? ok / has : null, citeN: has, keep: prop ? kept / prop : null, keepN: prop, bold: bN, boldCover: bN ? bHit / bN : null };
}

// ---------- 實驗二：整合判斷（五種做法找候選，她標記，算分）----------
const M2 = { B0: '字面比對', B1: '關鍵字', B2: '意思座標＋門檻', H: '混合', HA: '混合＋AI 判斷' };
const bigr = s => { s = norm(s); const o = new Set(); for (let i = 0; i < s.length - 1; i++) o.add(s.slice(i, i + 2)); return o; };
async function buildCand() {
  const list = X().pts(), vec = await X().ensureVec(list).catch(() => false);
  const kw = X().bm25(list.map(p => ({ p, text: p.name + ' ' + p.name + ' ' + (p.desc || '') }))), find = await X().finder(list);
  const date = p => (K.sources.find(s => s.id === X().srcOf(p)) || {}).date || '';
  const sample = list.slice().sort((a, b) => date(b).localeCompare(date(a))).slice(0, 40), cand = {};
  for (const q of sample) {
    const pool = list.filter(p => X().srcOf(p) !== X().srcOf(q)), inP = new Set(pool), qb = bigr(q.name), c = {};
    c.B0 = pool.map(p => { const b = bigr(p.name); let n = 0; b.forEach(x => qb.has(x) && n++); return { p, n }; }).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5).map(x => x.p.id);
    c.B1 = kw(q.name + ' ' + (q.desc || '')).filter(x => inP.has(x.p)).slice(0, 5).map(x => x.p.id);
    c.B2 = vec && X().V.get(q.id) ? pool.map(p => ({ p, s: X().V.get(p.id) ? X().dot(X().V.get(q.id).v, X().V.get(p.id).v) : 0 })).filter(x => x.s >= 0.6).sort((a, b) => b.s - a.s).slice(0, 5).map(x => x.p.id) : null;
    c.H = (await find(q.name + '：' + (q.desc || ''), 8)).filter(p => inP.has(p)).slice(0, 5).map(p => p.id);
    cand[q.id] = c;
  }
  EV.cand = cand; await saveEV();
}
const pairs = () => { const o = []; for (const q in EV.cand) { const c = EV.cand[q], u = new Set([...c.B0, ...c.B1, ...(c.B2 || []), ...c.H]); u.forEach(p => o.push(q + '|' + p)); } return o; };
async function judgeAI() {
  const todo = []; for (const q in EV.cand) EV.cand[q].H.forEach(p => { const k = q + '|' + p; if (!(k in EV.ai) && byPid(q) && byPid(p)) todo.push(k); });
  for (let i = 0; i < todo.length; i += 25) {
    const part = todo.slice(i, i + 25);
    const r = await aiAsk(`判斷每一組「新」和「舊」知識點的關係。只輸出一個 JSON。關係只能是「有關」「名字像但不同」「無關」。字不同但意思相關＝有關；名字一樣或很像、但意思不同＝名字像但不同。
格式：{"判斷":[{"組":1,"關係":""}]}

${part.map((k, j) => { const [a, b] = k.split('|').map(byPid); return `${j + 1}. 新：${a.name}｜${a.desc || ''}\n   舊：${b.name}｜${b.desc || ''}`; }).join('\n')}`);
    ((X().pj(r.text) || {})['判斷'] || []).forEach(d => { const k = part[(parseInt(d['組']) || 0) - 1]; if (k) EV.ai[k] = d['關係']; });
    toast(`AI 判斷 ${Math.min(i + 25, todo.length)}／${todo.length}`); if (i + 25 < todo.length) await sleep(4000);
  }
}
const byPid = id => KN.realPts().find(p => p.id === id);
function exp2() {
  const L = EV.labels, rel = Object.keys(L).filter(k => L[k] === 'rel'), out = {};
  const score = ks => { const lab = ks.filter(k => L[k]); if (!lab.length) return null; const hit = lab.filter(k => L[k] === 'rel').length;
    return { recall: rel.length ? hit / rel.length : null, wrong: (lab.length - hit) / lab.length, n: lab.length }; };
  const all = m => { const o = []; for (const q in EV.cand) (EV.cand[q][m] || []).forEach(p => o.push(q + '|' + p)); return o; };
  ['B0', 'B1', 'B2', 'H'].forEach(m => out[m] = EV.cand && Object.values(EV.cand).some(c => c[m]) ? score(all(m)) : null);
  out.HA = score(all('H').filter(k => EV.ai[k] === '有關'));
  const ok = Object.keys(out).filter(m => out[m] && out[m].recall != null), best = ok.reduce((a, m) => !a || out[m].recall > out[a].recall ? m : a, '');
  const simple = ['B0', 'B1', 'B2', 'H', 'HA'].find(m => out[m] && out[m].recall != null && out[best].recall - out[m].recall < 0.1);
  EV.res.e2 = { t: Date.now(), out, rel: rel.length, labeled: Object.keys(L).length, pick: simple || best };
}
function labelPane(tabs) {
  const todo = pairs().filter(k => !(k in EV.labels) && k.split('|').every(byPid)), done = Object.keys(EV.labels).length;
  if (!todo.length) { toast('都標完了'); return window.knEvalPane(tabs); }
  const [a, b] = todo[0].split('|').map(byPid);
  openPane('編輯台', `<div class="edp">${tabs}<p class="note">已標 ${done}／${done + todo.length}　這兩個知識點有關嗎？</p>
   <div class="rcp"><b>新：${E(a.name)}</b><p>${E(a.desc)}</p></div><div class="rcp"><b>舊：${E(b.name)}</b><p>${E(b.desc)}</p></div>
   <div class="row"><button class="go" data-l="rel">有關</button><button class="go sub" data-l="sim">名字像但不同</button><button class="go sub" data-l="no">無關</button><button class="c" data-l="">先停</button></div></div>`);
  if (window.knBindTabs) knBindTabs();
  pbody.querySelectorAll('[data-l]').forEach(x => x.onclick = async () => { if (!x.dataset.l) return window.knEvalPane(tabs); EV.labels[todo[0]] = x.dataset.l; await saveEV(); labelPane(tabs); });
}

// ---------- 實驗三：問答（不找資料／關鍵字／混合）----------
const C3 = { none: '不找資料', kw: '關鍵字找', mix: '混合找' };
async function exp3() {
  const list = X().pts(), qs = EV.qs; if (!qs.length) { toast('先加幾個題目'); return; }
  const kw = X().bm25(list.map(p => ({ p, text: p.name + ' ' + p.name + ' ' + (p.desc || '') + ' ' + (p.quote || '') }))), find = await X().finder(list, true), rows = [];
  let n = 0;
  for (const c of Object.keys(C3)) for (let i = 0; i < qs.length; i++) {
    const it = qs[i]; toast(`問答評估 ${++n}／${qs.length * 3}（${C3[c]}）`, 8000);
    const hits = c === 'kw' ? kw(it.q).slice(0, 8).map(x => x.p) : c === 'mix' ? await find(it.q, 8, true) : [];
    const pr = c === 'none' ? `回答問題。不知道就只回答「資料裡沒有」。用繁體中文、白話。只輸出 JSON：{"回答":""}\n\n問題：${it.q}`
      : `只根據下面的「資料」回答問題，不要用你自己的知識。每句話後面用 [編號] 標出根據哪一筆資料。資料裡沒有答案，就只回答「資料裡沒有」。用繁體中文、白話。只輸出 JSON：{"回答":""}\n\n問題：${it.q}\n\n資料：\n${hits.map((p, j) => `[${j + 1}] ${p.name}：${p.desc || ''}`).join('\n')}`;
    let ans = ''; try { const r = await aiAsk(pr); ans = (X().pj(r.text) || {})['回答'] || r.text; } catch (e) { ans = '（AI 沒成功）'; }
    const cited = [...ans.matchAll(/\[(\d+)\]/g)].map(m => (hits[m[1] - 1] || {}).id).filter(Boolean);
    rows.push({ c, i, ans, refuse: /資料裡沒有/.test(ans), hit: c !== 'none' && it.gold ? hits.some(p => p.id === it.gold) : null, cite: c !== 'none' && it.gold ? cited.includes(it.gold) : null });
    await sleep(4000);
  }
  for (const c of Object.keys(C3)) {   // 重點涵蓋：請 AI 對照標準知識點評分
    const rs = rows.filter(r => r.c === c && qs[r.i].gold && byPid(qs[r.i].gold)); if (!rs.length) continue;
    try { const r = await aiAsk(`對照「標準重點」幫每個「回答」評分：完整涵蓋＝1，部分＝0.5，沒有或說資料裡沒有＝0。只輸出 JSON：{"評分":[{"題":1,"分":1}]}\n\n${rs.map((x, j) => { const g = byPid(qs[x.i].gold); return `${j + 1}. 標準重點：${g.name}：${g.desc || ''}\n   回答：${x.ans}`; }).join('\n')}`);
      ((X().pj(r.text) || {})['評分'] || []).forEach(d => { const x = rs[(parseInt(d['題']) || 0) - 1]; if (x) x.cover = Number(d['分']) || 0; }); } catch (e) {}
    await sleep(4000);
  }
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null, out = {};
  for (const c of Object.keys(C3)) {
    const R = rows.filter(r => r.c === c), A = R.filter(r => qs[r.i].gold), Z = R.filter(r => qs[r.i].none);
    out[c] = { hit: c === 'none' ? null : avg(A.map(r => r.hit ? 1 : 0)), cover: avg(A.filter(r => r.cover != null).map(r => r.cover)), cite: c === 'none' ? null : avg(A.map(r => r.cite ? 1 : 0)),
      refuse: avg(Z.map(r => r.refuse ? 1 : 0)), wrongRefuse: avg(A.map(r => r.refuse ? 1 : 0)) };
  }
  EV.res.e3 = { t: Date.now(), out, n: qs.length, none: qs.filter(q => q.none).length };
}

// ---------- 成績表 ----------
function table() {
  const R = EV.res, d = t => new Date(t).toLocaleDateString();
  let h = '';
  if (R.e1) h += `<h4>實驗一 拆點品質（${d(R.e1.t)}）</h4><table class="mt"><tr><th>項目</th><th>結果</th></tr><tr><td>知識點</td><td>${R.e1.pts}</td></tr><tr><td>依據核對率（引的原文找得到）</td><td>${pct(R.e1.cite)}（${R.e1.citeN} 點）</td></tr><tr><td>保留率（AI 拆的點你留下）</td><td>${pct(R.e1.keep)}（${R.e1.keepN} 點）</td></tr><tr><td>對照：粗體關鍵概念被拆點涵蓋</td><td>${pct(R.e1.boldCover)}（${R.e1.bold} 個）</td></tr></table>`;
  if (R.e2) h += `<h4>實驗二 整合判斷（${d(R.e2.t)}，標了 ${R.e2.labeled} 組，有關 ${R.e2.rel} 組）</h4><table class="mt"><tr><th>做法</th><th>候選找回率</th><th>連錯率</th><th>漏連率</th></tr>${Object.keys(M2).map(m => { const o = R.e2.out[m]; return `<tr><td>${M2[m]}</td><td>${o ? pct(o.recall) : '—'}</td><td>${o ? pct(o.wrong) : '—'}</td><td>${o && o.recall != null ? pct(1 - o.recall) : '—'}</td></tr>`; }).join('')}</table><p class="note">選用：${M2[R.e2.pick] || '—'}（找回率差不到 10 個百分點就選簡單的）</p>`;
  if (R.e3) h += `<h4>實驗三 問答（${d(R.e3.t)}，${R.e3.n} 題，其中 ${R.e3.none} 題資料裡沒有）</h4><table class="mt"><tr><th>條件</th><th>命中率</th><th>重點涵蓋</th><th>出處正確</th><th>該拒答有拒答</th><th>誤拒答</th></tr>${Object.keys(C3).map(c => { const o = R.e3.out[c]; return `<tr><td>${C3[c]}</td><td>${pct(o.hit)}</td><td>${pct(o.cover)}</td><td>${pct(o.cite)}</td><td>${pct(o.refuse)}</td><td>${pct(o.wrongRefuse)}</td></tr>`; }).join('')}</table>`;
  return h || '<p class="note">還沒有成績。</p>';
}
const toMd = html => html.replace(/<h4>(.*?)<\/h4>/g, '\n## $1\n\n').replace(/<table class="mt">/g, '').replace(/<\/table>/g, '\n').replace(/<tr>(.*?)<\/tr>/g, (m, r, o, s) => {
  const cells = [...r.matchAll(/<t[hd]>(.*?)<\/t[hd]>/g)].map(x => x[1]); const line = '| ' + cells.join(' | ') + ' |\n'; return /<th>/.test(r) ? line + '|' + cells.map(() => '---|').join('') + '\n' : line; })
  .replace(/<p class="note">(.*?)<\/p>/g, '\n$1\n').replace(/<[^>]+>/g, '');

window.knEvalPane = async tabs => {
  if (!KN.root) { openPane('編輯台', `<div class="edp">${tabs}<p>還沒連上資料夾。</p></div>`); if (window.knBindTabs) knBindTabs(); return; }
  await loadEV();
  const np = pairs().length, nl = Object.keys(EV.labels).length;
  openPane('編輯台', `<div class="edp">${tabs}
   <details open><summary>成績表</summary>${table()}<div class="row"><button class="c" id="emd">存成 Markdown</button>${qtip('存到 04-知識網／評估成績表.md，履歷、作品集可以直接用。')}</div></details>
   <details><summary>實驗一　拆點品質</summary><p class="note">全自動：引的原文找不找得到、你留下幾成、和「只抓粗體」比。</p><button class="go" id="e1">算</button></details>
   <details><summary>實驗二　整合判斷</summary><p class="note">你只要點選「有關／名字像但不同／無關」。標越多越準，隨時可以停。</p>
    <div class="row"><button class="go sub" id="e2c">${EV.cand ? '重新抽題' : '抽題'}</button>${EV.cand ? `<button class="go" id="e2l">標記（${nl}／${np}）</button><button class="go sub" id="e2s">算</button>` : ''}</div></details>
   <details><summary>實驗三　問答</summary><p class="note">每題選「答案在哪個知識點」，或勾「資料裡沒有」（建議 20 題，其中 3 題沒有）。</p>
    ${EV.qs.map((q, i) => `<div class="tr"><span style="flex:1">${E(q.q)}</span><span class="note">${q.none ? '資料裡沒有' : E((byPid(q.gold) || {}).name || '?')}</span><button class="c" data-qx="${i}">×</button></div>`).join('')}
    <div class="tr"><input type="text" id="qn" placeholder="題目" style="flex:1;min-width:0"><input type="text" id="qg" list="qgl" placeholder="答案在哪個知識點" style="flex:1;min-width:0"><label><input type="checkbox" id="qz">資料裡沒有</label><button class="c" id="qa">加</button></div>
    <datalist id="qgl">${X().pts().map(p => `<option value="${E(p.name)}">`).join('')}</datalist>
    <div class="row"><button class="go" id="e3">跑評估（${EV.qs.length} 題，約 ${Math.ceil(EV.qs.length * 3 * 5 / 60)} 分鐘）</button></div></details></div>`);
  const P = pbody, again = () => window.knEvalPane(tabs), busy = async (b, fn) => { b.disabled = true; b.textContent = '處理中…'; try { await fn(); await saveEV(); } catch (e) { toast('沒成功：' + e.message, 7000); } again(); };
  P.querySelector('#emd').onclick = async () => { await KN.writeFile(await dir(), '評估成績表.md', '# 知識工具評估成績表\n' + toMd(table()) + '\n'); toast('已存：04-知識網／評估成績表.md'); };
  P.querySelector('#e1').onclick = e => busy(e.target, exp1);
  P.querySelector('#e2c').onclick = e => busy(e.target, buildCand);
  if (EV.cand) { P.querySelector('#e2l').onclick = () => labelPane(tabs); P.querySelector('#e2s').onclick = e => busy(e.target, async () => { await judgeAI().catch(err => toast('AI 判斷沒做完：' + err.message, 6000)); exp2(); }); }
  P.querySelectorAll('[data-qx]').forEach(b => b.onclick = async () => { EV.qs.splice(+b.dataset.qx, 1); await saveEV(); again(); });
  P.querySelector('#qa').onclick = async () => {
    const q = P.querySelector('#qn').value.trim(), none = P.querySelector('#qz').checked, g = X().pts().find(p => p.name === P.querySelector('#qg').value.trim());
    if (!q) return toast('請打題目'); if (!none && !g) return toast('請從清單選知識點，或勾「資料裡沒有」');
    EV.qs.push({ q, gold: none ? '' : g.id, none }); await saveEV(); again();
  };
  P.querySelector('#e3').onclick = e => busy(e.target, exp3);
  if (window.knBindTabs) knBindTabs();
};
})();
