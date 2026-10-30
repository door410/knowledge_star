// AI 插座（Layer 2 第一塊）：Vertex → Gemini 免費 → Groq → 手動（07 第三節）
// 金鑰和花費記錄只存在這台電腦的瀏覽器（localStorage），不寫進資料夾，不會上傳 GitHub。
(() => {
const { h, toast, qtip, openPane, pbody, step2 } = window.KN;
const LS = 'kn-ai', LEDGER = 'kn-ai-ledger', MAXOUT = 32768;
const CH = { vertex: 'Vertex', gemini: 'Gemini 免費', groq: 'Groq' };
const ORDER = ['vertex', 'gemini', 'groq'];
const DEF = { mode: 'auto', pick: 'gemini',
  vertex: { key: '', model: 'gemini-2.5-flash', project: '', pin: 0.30, pout: 2.50, credit: 300, expire: '', trial: false, ask: 0.10, days: 7, keep: 10 },
  gemini: { key: '', model: 'gemini-2.5-flash' },
  groq: { key: '', model: 'llama-3.3-70b-versatile' } };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const S = load(LS, {});
for (const k in DEF) S[k] = typeof DEF[k] === 'object' ? Object.assign({}, DEF[k], S[k]) : (S[k] ?? DEF[k]);
let ledger = load(LEDGER, []);
const E = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = n => (n < 0.01 ? n.toFixed(4) : n.toFixed(2));
const ym = t => { const d = new Date(t); return d.getFullYear() + '-' + d.getMonth(); };
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} bar(); };
const spent = month => ledger.filter(r => r.ch === 'vertex' && (!month || ym(r.t) === ym(Date.now()))).reduce((s, r) => s + r.usd, 0);

// ---------- 能不能用 ----------
function vertexWhy() {
  const v = S.vertex;
  if (!v.key) return '沒有金鑰';
  if (!v.trial) return '還沒確認免費試用';
  if (v.expire) { const left = (new Date(v.expire + 'T23:59:59') - Date.now()) / 864e5; if (left < 0) return '已過期'; if (left <= v.days) return '快到期'; }
  if (v.credit - spent() <= v.keep) return '額度快用完';
  return '';
}
const why = ch => ch === 'vertex' ? vertexWhy() : (S[ch].key ? '' : '沒有金鑰');
const ready = () => ORDER.filter(c => !why(c));
const estimate = p => { const v = S.vertex, tin = Math.ceil(p.length * 1.1); return [(tin * v.pin + 1500 * v.pout) / 1e6, (tin * v.pin + MAXOUT * v.pout) / 1e6]; };

// ---------- 呼叫 ----------
async function post(url, headers, body) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 180000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ac.signal });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const m = (j.error && j.error.message) || ('HTTP ' + res.status);
      throw new Error(res.status === 401 || res.status === 403 ? '金鑰不對或沒有權限（' + m + '）' : res.status === 429 ? '用量到上限，稍後再試' : res.status === 404 ? '找不到這個模型，請到設定改模型名稱' : m);
    }
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('等太久沒回應');
    if (e instanceof TypeError) throw new Error('連不上（網路或瀏覽器擋住）');
    throw e;
  } finally { clearTimeout(tm); }
}
async function google(url, headers, p) {
  const r = await post(url, headers, { contents: [{ role: 'user', parts: [{ text: p }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: MAXOUT } });
  const c = (r.candidates || [])[0] || {};
  const text = ((c.content && c.content.parts) || []).filter(x => !x.thought).map(x => x.text || '').join('');
  if (!text) throw new Error('AI 沒有回答' + (c.finishReason ? '（' + c.finishReason + '）' : ''));
  const u = r.usageMetadata || {};
  return { text, tin: u.promptTokenCount || 0, tout: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) };
}
const RUN = {
  vertex: p => { const v = S.vertex, m = encodeURIComponent(v.model);
    const base = v.project ? `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(v.project)}/locations/global/publishers/google/models/${m}` : `https://aiplatform.googleapis.com/v1/publishers/google/models/${m}`;
    return google(`${base}:generateContent?key=${encodeURIComponent(v.key)}`, {}, p); },
  gemini: p => google(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(S.gemini.model)}:generateContent`, { 'x-goog-api-key': S.gemini.key }, p),
  groq: async p => {
    const r = await post('https://api.groq.com/openai/v1/chat/completions', { Authorization: 'Bearer ' + S.groq.key }, { model: S.groq.model, messages: [{ role: 'user', content: p }], temperature: 0.2, response_format: { type: 'json_object' } });
    const text = (((r.choices || [])[0] || {}).message || {}).content || '';
    if (!text) throw new Error('AI 沒有回答');
    return { text, tin: (r.usage || {}).prompt_tokens || 0, tout: (r.usage || {}).completion_tokens || 0 };
  } };
function record(ch, r) {
  const usd = ch === 'vertex' ? (r.tin * S.vertex.pin + r.tout * S.vertex.pout) / 1e6 : 0;
  ledger.push({ t: Date.now(), ch, model: S[ch].model, tin: r.tin, tout: r.tout, usd });
  if (ledger.length > 1000) ledger = ledger.slice(-1000);
  try { localStorage.setItem(LEDGER, JSON.stringify(ledger)); } catch (e) {}
  bar(); return usd;
}

// ---------- 上方狀態列 ----------
const barBtn = h('button', { className: 'c', title: 'AI 設定' });
const g = h('div', { className: 'g', id: 'aiBar' }); g.append(barBtn); document.getElementById('ui').append(g);
barBtn.onclick = () => settingsPane();
function bar() {
  const first = S.mode === 'manual' ? S.pick : ORDER.find(c => !why(c));
  const ok = first && !why(first);
  barBtn.textContent = 'AI：' + (ok ? CH[first] : '手動') + (ok && first === 'vertex' ? `｜本月已花 $${f(spent(true))}｜剩 $${f(S.vertex.credit - spent())}` : '');
}
bar();
document.head.append(h('style', {}, `.aiset fieldset{border:1px solid #8886;border-radius:8px;margin:10px 0;padding:6px 12px 10px}.aiset legend{font-weight:bold;padding:0 4px}
.aiset label{display:inline-flex;align-items:center;gap:4px;margin:5px 10px 5px 0}.aiset input:not([type=checkbox]):not([type=radio]){padding:3px 5px}`));

// ---------- 設定頁 ----------
const KEYTIP = '金鑰只存在這台電腦的瀏覽器，不會寫進資料夾，也不會上傳 GitHub。';
function settingsPane(back) {
  const inp = (k, type = 'text', w = 15) => { const [a, b] = k.split('.'); return `<input type="${type}" data-k="${k}" value="${E(S[a][b] ?? '')}" style="width:${w}em"${type === 'number' ? ' step="any" min="0"' : ''}>`; };
  openPane('AI 設定', `<div class="aiset">${back ? '<div class="row"><button class="go sub" id="aiBack">← 回去</button></div>' : ''}
  <div class="row"><b>模式</b><label><input type="radio" name="aim" value="auto"${S.mode === 'auto' ? ' checked' : ''}>自動</label>${qtip('照順序用：Vertex → Gemini 免費 → Groq，失敗就換下一個，都不行就手動。')}
  <label><input type="radio" name="aim" value="manual"${S.mode === 'manual' ? ' checked' : ''}>手動</label>${qtip('每次拆的時候自己選用哪個。')}</div>
  <fieldset><legend>Vertex</legend>
   <label>金鑰${inp('vertex.key', 'password')}</label>${qtip(KEYTIP)}<label>模型${inp('vertex.model', 'text', 11)}</label><label>專案 ID${inp('vertex.project', 'text', 9)}</label>${qtip('通常不用填。')}<br>
   <label>價目 輸入${inp('vertex.pin', 'number', 4)}</label><label>輸出${inp('vertex.pout', 'number', 4)}</label>${qtip('美元／每 100 萬 token。換模型時照 Google 官方價目改。')}
   <label>額度 $${inp('vertex.credit', 'number', 4)}</label><label>到期日${inp('vertex.expire', 'date', 9)}</label><br>
   <label><input type="checkbox" data-k="vertex.trial"${S.vertex.trial ? ' checked' : ''}>已在帳單頁確認是「免費試用」</label>${qtip('沒勾就不會用 Vertex。要確認帳戶不是已升級的付費帳戶。')}<br>
   <label>單次超過 $${inp('vertex.ask', 'number', 3)} 先問我</label><label>到期前${inp('vertex.days', 'number', 3)}天改用免費</label><label>剩不到 $${inp('vertex.keep', 'number', 3)} 改用免費</label>
   <div class="row"><button class="go sub" data-test="vertex">測試</button><span class="note" id="aiSpent"></span></div></fieldset>
  <fieldset><legend>Gemini 免費</legend><label>金鑰${inp('gemini.key', 'password')}</label>${qtip(KEYTIP + '要建在和 Vertex 不同、沒開帳單的 Google 專案，不然會變付費。')}<label>模型${inp('gemini.model', 'text', 11)}</label><button class="go sub" data-test="gemini">測試</button></fieldset>
  <fieldset><legend>Groq</legend><label>金鑰${inp('groq.key', 'password')}</label>${qtip(KEYTIP)}<label>模型${inp('groq.model', 'text', 13)}</label><button class="go sub" data-test="groq">測試</button></fieldset></div>`);
  const line = () => { pbody.querySelector('#aiSpent').innerHTML = `本月已花 $${f(spent(true))}｜累計 $${f(spent())}｜剩 $${f(S.vertex.credit - spent())}｜${vertexWhy() || '可以用'}` + qtip('工具自己記的帳，是估算；精確數字以 Google Cloud 帳單頁為準。'); };
  line();
  pbody.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { const [a, b] = el.dataset.k.split('.'); S[a][b] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (parseFloat(el.value) || 0) : el.value.trim(); save(); line(); });
  pbody.querySelectorAll('[name=aim]').forEach(el => el.onchange = () => { S.mode = el.value; save(); });
  pbody.querySelectorAll('[data-test]').forEach(b => b.onclick = async () => {
    const ch = b.dataset.test; if (why(ch)) return toast(`${CH[ch]}：${why(ch)}`);
    b.textContent = '測試中…';
    try { record(ch, await RUN[ch]('請只輸出 JSON：{"ok":true}')); toast(`${CH[ch]} 可以用`); } catch (e) { toast(`${CH[ch]} 沒成功：${e.message}`, 8000); }
    b.textContent = '測試'; line();
  });
  if (back) pbody.querySelector('#aiBack').onclick = back;
}

// ---------- 給其他功能用（整合判斷、問答）：照模式選 AI，失敗換下一個 ----------
window.aiAsk = async p => {
  const list = S.mode === 'manual' ? (why(S.pick) ? [] : [S.pick]) : ready().filter(c => c !== 'vertex' || estimate(p)[1] <= S.vertex.ask);
  if (!list.length) throw new Error('沒有可以用的 AI（按上方「AI」設定）');
  let last = null;
  for (const ch of list) { try { const r = await RUN[ch](p), usd = record(ch, r); return Object.assign(r, { ch, usd }); } catch (e) { last = e; } }
  throw last;
};

// ---------- 「交給 AI 拆」畫面上的 AI 按鈕（folder.js step2 呼叫）----------
window.aiSocket = (prompt, ans, done) => {
  const row = h('div', { className: 'row' }); pbody.prepend(row);
  const run = async list => {
    if (!list.length) { toast('沒有可以用的 AI，請用下面的手動方式', 6000); return paint(); }
    for (const ch of list) {
      row.innerHTML = `<span class="note">AI 拆解中…（${CH[ch]}）</span>`;
      try {
        const r = await RUN[ch](prompt), usd = record(ch, r);
        let text = r.text;
        if (window.knIntegrate) { row.innerHTML = '<span class="note">找舊的相關知識點…</span>'; try { text = await knIntegrate(text); } catch (e) { toast('整合判斷沒成功：' + e.message, 6000); } }
        ans.value = text; ans.dispatchEvent(new Event('input'));
        toast(`用 ${CH[ch]} 拆好了` + (ch === 'vertex' ? `，約 $${f(usd)}` : '')); paint(); return done();
      } catch (e) { toast(`${CH[ch]} 沒成功：${e.message}`, 6000); }
    }
    toast('AI 都沒成功，請用下面的手動方式', 7000); paint();
  };
  const paint = () => {
    const rd = ready();
    if (!rd.length) { row.innerHTML = `<button class="go sub" id="aiGo">設定 AI</button>${qtip('設定後按一下就由 AI 拆，不用複製貼上。')}`; row.querySelector('#aiGo').onclick = () => settingsPane(() => step2()); return; }
    const man = S.mode === 'manual', first = man ? S.pick : rd[0];
    const est = first === 'vertex' && !why('vertex') ? estimate(prompt) : null;
    row.innerHTML = `<button class="go" id="aiGo"${man && why(first) ? ' disabled' : ''}>AI 拆</button>` +
      (man ? `<select id="aiPick">${ORDER.map(c => `<option value="${c}"${c === first ? ' selected' : ''}${why(c) ? ' disabled' : ''}>${CH[c]}${why(c) ? '（' + why(c) + '）' : ''}</option>`).join('')}</select>` : `<span class="note">${CH[first]}</span>`) +
      (est ? `<span class="note">預估 $${f(est[0])}～$${f(est[1])}</span>` : '');
    const sel = row.querySelector('#aiPick'); if (sel) sel.onchange = () => { S.pick = sel.value; save(); paint(); };
    row.querySelector('#aiGo').onclick = () => {
      if (man) return run([first]);
      if (first === 'vertex' && est[1] > S.vertex.ask) {
        row.innerHTML = `<span class="note">Vertex 這次最多約 $${f(est[1])}，超過你設的 $${f(S.vertex.ask)}</span><button class="go" id="aiYes">還是用 Vertex</button><button class="go sub" id="aiFree">改用免費的</button>`;
        row.querySelector('#aiYes').onclick = () => run(rd);
        row.querySelector('#aiFree').onclick = () => run(rd.filter(c => c !== 'vertex'));
        return;
      }
      run(rd);
    };
  };
  paint();
};
})();
