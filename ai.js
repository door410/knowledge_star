// AI 插座（Layer 2 第一塊）：Vertex → Gemini 免費 → Groq → 手動（07 第三節）
// 金鑰和花費記錄只存在這台電腦的瀏覽器（localStorage），不寫進資料夾，不會上傳 GitHub。
(() => {
const { h, toast, qtip, openPane, pbody, step2 } = window.KN;
const LS = 'kn-ai', LEDGER = 'kn-ai-ledger', MAXOUT = 32768;
const CH = { vertex: 'Vertex', gemini: 'Gemini', groq: 'Groq' };
const ORDER = ['gemini', 'groq'];   // Vertex 11/5 決定不用（06 第 28 輪），程式留著
const DEF = { mode: 'auto', pick: 'gemini',
  vertex: { key: '', model: 'gemini-3.8-flash', project: '', pin: 0.75, pout: 3.75, credit: 300, expire: '', trial: false, ask: 0.10, days: 7, keep: 10 },
  gemini: { key: '', model: 'gemini-3.8-flash', billed: false, pin: 0.75, pout: 3.75, expire: '' },
  groq: { key: '', model: 'llama-3.3-70b-versatile' } };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const S = load(LS, {});
for (const k in DEF) S[k] = typeof DEF[k] === 'object' ? Object.assign({}, DEF[k], S[k]) : (S[k] ?? DEF[k]);
if (!S.v3) { S.gemini.billed = false; S.gemini.expire = ''; S.v3 = 1; }   // 11/5 改用免費專案的金鑰
['vertex', 'gemini'].forEach(c => { if (S[c].model === 'gemini-2.5-flash') Object.assign(S[c], { model: DEF[c].model, pin: DEF[c].pin, pout: DEF[c].pout }); });  // 2.5 新金鑰不能用了
let ledger = load(LEDGER, []);
const E = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = n => (n < 0.01 ? n.toFixed(4) : n.toFixed(2));
const ym = t => { const d = new Date(t); return d.getFullYear() + '-' + d.getMonth(); };
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} bar(); };
const spent = (month, ch = 'vertex') => ledger.filter(r => r.ch === ch && (!month || ym(r.t) === ym(Date.now()))).reduce((s, r) => s + r.usd, 0);

// ---------- 能不能用 ----------
function vertexWhy() {
  const v = S.vertex;
  if (!v.key) return '沒有金鑰';
  if (!v.trial) return '還沒確認免費試用';
  if (v.expire) { const left = (new Date(v.expire + 'T23:59:59') - Date.now()) / 864e5; if (left < 0) return '已過期'; if (left <= v.days) return '快到期'; }
  if (v.credit - spent() <= v.keep) return '額度快用完';
  return '';
}
const gemWhy = () => { const g = S.gemini; if (!g.key) return '沒有金鑰'; if (g.billed && g.expire && new Date(g.expire + 'T23:59:59') < Date.now()) return '抵免額已到期'; return ''; };
const why = ch => ch === 'vertex' ? vertexWhy() : ch === 'gemini' ? gemWhy() : (S[ch].key ? '' : '沒有金鑰');
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
      throw new Error(res.status === 401 || res.status === 403 ? '金鑰不對或沒有權限（' + m + '）' : res.status === 402 ? '這把金鑰的專案要先儲值才能用，請換成免費專案的金鑰' : res.status === 429 ? '用量到上限，稍後再試（' + m + '）' : res.status === 404 ? '找不到這個模型（' + m + '）' : m + '（' + res.status + '）');
    }
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('等太久沒回應');
    if (e instanceof TypeError) throw new Error('連不上（網路或瀏覽器擋住：' + e.message + '）');
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
async function pickModel(ch) {   // 找不到模型時，問 Google／Groq 現在有哪些，挑最新的 Flash
  if (ch === 'groq') { const j = await (await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + S.groq.key } })).json();
    const ids = (j.data || []).map(m => m.id); return ids.find(i => /llama-3\.3-70b/.test(i)) || ids.find(i => /gpt-oss-120b/.test(i)) || ids.find(i => /70b|120b/.test(i)) || ''; }
  const key = S.gemini.key || (ch === 'vertex' ? '' : ''); if (!key) return '';
  const j = await (await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=300', { headers: { 'x-goog-api-key': key } })).json();
  const ns = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
  const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const stable = ns.filter(n => /^gemini-[\d.]+-flash$/.test(n)), loose = ns.filter(n => /^gemini-[\d.]+-flash/.test(n) && !/lite|image|tts|live|audio|exp/.test(n));
  return (stable.length ? stable : loose).sort((a, b) => ver(b) - ver(a))[0] || '';
}
async function altModels() {
  const j = await (await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=300', { headers: { 'x-goog-api-key': S.gemini.key } })).json();
  const ns = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
  const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  return ns.filter(n => /^gemini-[\d.]+-flash(-lite)?$/.test(n)).sort((a, b) => (/lite/.test(a) - /lite/.test(b)) || ver(b) - ver(a)).slice(0, 3);
}
for (const ch of ORDER) { const f0 = RUN[ch]; RUN[ch] = async p => {
  try { return await f0(p); } catch (e) {
    if (/（50[23]）|high demand|overloaded|UNAVAILABLE/i.test(e.message)) {   // Google 忙線：等一下再試，還是忙就換別的 Flash
      for (const w of [3000, 8000]) { await new Promise(r => setTimeout(r, w)); try { return await f0(p); } catch (e2) { if (!/（50[23]）|high demand|overloaded|UNAVAILABLE/i.test(e2.message)) throw e2; } }
      if (ch === 'groq') throw e;
      const keep = S[ch].model, alts = await altModels().catch(() => []);
      for (const m of alts.filter(m => m !== keep)) { S[ch].model = m; try { const r = await f0(p); toast(`${keep} 忙線，這次改用 ${m}`, 5000); return r; } catch (e3) {} finally { S[ch].model = keep; } }
      throw new Error('Google 現在忙線，請過幾分鐘再試');
    }
    if (!/找不到這個模型|not found/i.test(e.message)) throw e;
    const m = await pickModel(ch).catch(() => ''); if (!m || m === S[ch].model) throw e;
    S[ch].model = m; save(); toast(`${CH[ch]} 模型自動換成 ${m}`, 6000); return f0(p);
  } }; }
function record(ch, r) {
  const c = S[ch], usd = ch === 'vertex' || (ch === 'gemini' && c.billed) ? (r.tin * c.pin + r.tout * c.pout) / 1e6 : 0;
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
  barBtn.textContent = 'AI：' + (ok ? CH[first] : '手動') + (ok && first === 'vertex' ? `｜本月已花 $${f(spent(true))}｜剩 $${f(S.vertex.credit - spent())}` : ok && first === 'gemini' && S.gemini.billed ? `｜本月已花 $${f(spent(true, 'gemini'))}` : '');
}
bar();
document.head.append(h('style', {}, `.aiset fieldset{border:1px solid #8886;border-radius:8px;margin:10px 0;padding:6px 12px 10px}.aiset legend{font-weight:bold;padding:0 4px}
.aiset label{display:inline-flex;align-items:center;gap:4px;margin:5px 10px 5px 0}.aiset input:not([type=checkbox]):not([type=radio]){padding:3px 5px}`));

// ---------- 設定頁 ----------
const KEYTIP = '金鑰只存在這台電腦的瀏覽器，不會寫進資料夾，也不會上傳 GitHub。';
function settingsPane(back) {
  const inp = (k, type = 'text', w = 15) => { const [a, b] = k.split('.'); return `<input type="${type}" data-k="${k}" value="${E(S[a][b] ?? '')}" style="width:${w}em"${type === 'number' ? ' step="any" min="0"' : ''}>`; };
  openPane('AI 設定', `<div class="aiset">${back ? '<div class="row"><button class="go sub" id="aiBack">← 回去</button></div>' : ''}
  <fieldset><legend>Gemini</legend>${S.gemini.key ? '' : '<a href="https://aistudio.google.com/app/api-keys" target="_blank">取得金鑰 ›</a><br>'}<label>金鑰${inp('gemini.key', 'password')}</label>${qtip(KEYTIP)}<label>模型${inp('gemini.model', 'text', 11)}</label>${qtip('找不到模型時，測試會自動換成可以用的。')}${S.gemini.billed ? `<br><label><input type="checkbox" data-k="gemini.billed"${S.gemini.billed ? ' checked' : ''}>這把金鑰有開帳單（用抵免額）</label>${qtip('AI Studio 金鑰頁寫 Tier 1＝有開帳單。勾了就記花費，抵免額到期後自動停用。')}<label>價目 輸入${inp('gemini.pin', 'number', 4)}</label><label>輸出${inp('gemini.pout', 'number', 4)}</label><label>抵免額到期${inp('gemini.expire', 'date', 9)}</label>` : ''}<br><button class="go sub" data-test="gemini">測試</button>${S.gemini.billed ? `<span class="note">本月已花 $${f(spent(true, 'gemini'))}</span>` : ''}</fieldset>
  <fieldset><legend>Groq（備用，可以不填）</legend>${S.groq.key ? '' : '<a href="https://console.groq.com/keys" target="_blank">取得金鑰 ›</a><br>'}<label>金鑰${inp('groq.key', 'password')}</label>${qtip(KEYTIP)}<label>模型${inp('groq.model', 'text', 13)}</label><button class="go sub" data-test="groq">測試</button></fieldset></div>`);
  const line = () => { if (!pbody.querySelector('#aiSpent')) return; pbody.querySelector('#aiSpent').innerHTML = `本月已花 $${f(spent(true))}｜累計 $${f(spent())}｜剩 $${f(S.vertex.credit - spent())}｜${vertexWhy() || '可以用'}` + qtip('工具自己記的帳，是估算；精確數字以 Google Cloud 帳單頁為準。'); };
  line();
  pbody.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { const [a, b] = el.dataset.k.split('.'); S[a][b] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (parseFloat(el.value) || 0) : el.value.trim(); save(); line(); });
  pbody.querySelectorAll('[name=aim]').forEach(el => el.onchange = () => { S.mode = el.value; save(); });
  pbody.querySelectorAll('[data-test]').forEach(b => b.onclick = async () => {
    const ch = b.dataset.test; if (why(ch)) return toast(`${CH[ch]}：${why(ch)}`);
    b.textContent = '測試中…';
    let res = b.nextElementSibling && b.nextElementSibling.classList.contains('tres') ? b.nextElementSibling : null;
    if (!res) { res = h('span', { className: 'note tres' }); b.after(res); }
    try { record(ch, await RUN[ch]('請只輸出 JSON：{"ok":true}')); res.textContent = `✓ 可以用（模型 ${S[ch].model}）`; toast(`${CH[ch]} 可以用`); }
    catch (e) { res.textContent = '✗ ' + e.message; toast(`${CH[ch]} 沒成功：${e.message}`, 8000); }
    b.textContent = '測試'; line();
  });
  if (back) pbody.querySelector('#aiBack').onclick = back;
}

// ---------- 給其他功能用（整合判斷、問答）：照模式選 AI，失敗換下一個 ----------
window.aiGemini = async (parts, tools) => {   // 網址、影片、截圖用（more.js）
  if (why('gemini')) throw new Error('請先在 AI 設定貼上 Gemini 金鑰');
  const body = { contents: [{ role: 'user', parts }] }; if (tools) body.tools = tools;
  const run = () => post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(S.gemini.model)}:generateContent`, { 'x-goog-api-key': S.gemini.key }, body);
  let r; try { r = await run(); } catch (e) { if (!/（50[23]）|high demand/i.test(e.message)) throw e; await new Promise(z => setTimeout(z, 6000)); r = await run(); }
  const c = (r.candidates || [])[0] || {}, text = ((c.content && c.content.parts) || []).filter(x => !x.thought).map(x => x.text || '').join('');
  if (!text) throw new Error('AI 沒有回答' + (c.finishReason ? '（' + c.finishReason + '）' : ''));
  const u = r.usageMetadata || {}; record('gemini', { tin: u.promptTokenCount || 0, tout: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) }); return text;
};
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
