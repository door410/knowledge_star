#!/usr/bin/env node
// 知識網 MCP 接頭：讓 Claude 桌面版等支援 MCP 的 AI 查你的知識網。只讀，不改檔；標「私人」的不給。
// 用法：node server.js "G:\我的雲端硬碟\知識網資料"
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || process.env.KN_DIR || '';
const KDIR = path.join(ROOT, '02-知識');

// ---------- 讀 Markdown（和 folder.js 同一套格式）----------
function parseMd(t) {
  t = t.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'); const meta = {}; let body = t;
  const m = t.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) { body = t.slice(m[0].length); m[1].split('\n').forEach(l => { const i = l.indexOf(':'); if (i < 1) return; let v = l.slice(i + 1).trim();
    if (/^["\[]/.test(v)) { try { v = JSON.parse(v); } catch (e) {} } else if (v === 'true' || v === 'false') v = v === 'true'; meta[l.slice(0, i).trim()] = v; }); }
  return { meta, body };
}
function parsePoint(t, fn) {
  const { meta, body } = parseMd(t); let name = '', cur = '_'; const sec = { _: [] };
  for (const l of body.split('\n')) { if (!name && /^#\s+/.test(l)) { name = l.replace(/^#\s+/, '').trim(); continue; } const s = l.match(/^##\s+(.*)/); if (s) { cur = s[1].trim(); sec[cur] = []; continue; } (sec[cur] = sec[cur] || []).push(l); }
  const txt = k => (sec[k] || []).join('\n').trim();
  const rels = txt('關聯').split('\n').map(l => l.match(/^\s*-\s*(.*?)（id:\s*([^）]+)）(?:［([^］]*)］)?[:：]?\s*(.*)$/)).filter(Boolean).map(r => ({ name: r[1].trim(), id: r[2].trim(), type: r[3] || '有關', note: r[4] }));
  return { id: String(meta.id || fn), name: name || fn.replace(/\.md$/, ''), top: String(meta['主題'] || '未分類'), sub: String(meta['子主題'] || '其他'), priv: !!meta['私人'],
    desc: txt('_'), why: txt('為什麼拆成這個點'), quote: txt('原文出處').replace(/^>\s?/gm, ''), mine: txt('我的想法'), rels };
}
let DB = null, at = 0;
function load() {
  if (DB && Date.now() - at < 30000) return DB;
  const pts = [], srcs = [];
  let dirs = []; try { dirs = fs.readdirSync(KDIR, { withFileTypes: true }).filter(d => d.isDirectory()); } catch (e) { throw new Error('找不到知識網資料夾：' + KDIR); }
  for (const d of dirs) {
    const dp = path.join(KDIR, d.name); let title = d.name.replace(/^\d{4}-\d{2}-\d{2}\s*/, ''), date = (d.name.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0], priv = false;
    try { const { meta } = parseMd(fs.readFileSync(path.join(dp, '原文.md'), 'utf8')); if (meta['標題']) title = meta['標題']; if (meta['日期']) date = meta['日期']; priv = !!meta['私人']; } catch (e) {}
    if (priv) continue;
    srcs.push({ id: d.name, title, date });
    for (const f of fs.readdirSync(dp)) { if (!f.endsWith('.md') || f === '原文.md') continue;
      try { const p = parsePoint(fs.readFileSync(path.join(dp, f), 'utf8'), f); if (!p.priv) pts.push(Object.assign(p, { src: title, date })); } catch (e) {} }
  }
  DB = { pts, srcs, idx: index(pts) }; at = Date.now(); return DB;
}
// ---------- 關鍵字找（雙字切詞 BM25）----------
const toks = s => { s = String(s || '').toLowerCase(); const o = s.match(/[a-z0-9]+/g) || [];
  s.replace(/[^\p{Script=Han}]/gu, ' ').split(/\s+/).filter(Boolean).forEach(w => { if (w.length === 1) o.push(w); for (let i = 0; i < w.length - 1; i++) o.push(w.slice(i, i + 2)); }); return o; };
function index(pts) {
  const df = {}, tf = pts.map(p => { const m = {}; toks([p.name, p.name, p.top, p.sub, p.desc, p.why, p.quote, p.mine].join(' ')).forEach(t => m[t] = (m[t] || 0) + 1); Object.keys(m).forEach(t => df[t] = (df[t] || 0) + 1); return m; });
  const len = tf.map(m => Object.values(m).reduce((a, b) => a + b, 0)), avg = len.reduce((a, b) => a + b, 0) / (pts.length || 1);
  return q => { const qt = [...new Set(toks(q))], N = pts.length;
    return pts.map((p, i) => { let s = 0; qt.forEach(t => { const f = tf[i][t]; if (f) s += Math.log(1 + (N - df[t] + .5) / (df[t] + .5)) * f * 2.2 / (f + 1.2 * (.25 + .75 * len[i] / avg)); }); return { p, s }; })
      .filter(x => x.s > 0).sort((a, b) => b.s - a.s); };
}
// ---------- 工具 ----------
const TOOLS = [
  { name: 'search_knowledge', description: '在使用者的個人知識網裡找相關的知識點（中文關鍵字）。回答使用者問題前先用這個查她自己的知識。', inputSchema: { type: 'object', properties: { query: { type: 'string', description: '要找的內容' }, limit: { type: 'number', description: '最多幾筆，預設 8' } }, required: ['query'] } },
  { name: 'get_point', description: '讀一個知識點的完整內容（說明、理由、原文出處、她的想法、關聯）。', inputSchema: { type: 'object', properties: { name: { type: 'string', description: '知識點名稱或 id' } }, required: ['name'] } },
  { name: 'list_topics', description: '列出知識網的主題、子主題和各有幾個知識點。', inputSchema: { type: 'object', properties: {} } },
  { name: 'recent_sources', description: '最近消化的來源（文章、影片分析）。', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: '預設 10' } } } }];
function call(name, a = {}) {
  const D = load();
  if (name === 'search_knowledge') { const r = D.idx(a.query || '').slice(0, Math.min(30, a.limit || 8));
    return r.length ? r.map((x, i) => `${i + 1}. ${x.p.name}（${x.p.top}／${x.p.sub}；來源：${x.p.src} ${x.p.date}；id: ${x.p.id}）\n   ${x.p.desc}`).join('\n') : '知識網裡沒有找到相關的知識點。'; }
  if (name === 'get_point') { const k = String(a.name || '').trim(), p = D.pts.find(p => p.id === k) || D.pts.find(p => p.name === k) || D.pts.find(p => p.name.includes(k));
    if (!p) return '找不到這個知識點。';
    return `# ${p.name}\n主題：${p.top}／${p.sub}\n來源：${p.src}（${p.date}）\n\n${p.desc}\n\n## 為什麼拆成這個點\n${p.why}\n\n## 原文出處\n${p.quote}` + (p.mine ? `\n\n## 她的想法\n${p.mine}` : '') +
      (p.rels.length ? `\n\n## 關聯\n${p.rels.filter(r => D.pts.some(q => q.id === r.id)).map(r => `- ${r.name}［${r.type}］${r.note}`).join('\n')}` : ''); }
  if (name === 'list_topics') { const m = {}; D.pts.forEach(p => { m[p.top] = m[p.top] || {}; m[p.top][p.sub] = (m[p.top][p.sub] || 0) + 1; });
    return `共 ${D.pts.length} 個知識點、${D.srcs.length} 份來源。\n` + Object.keys(m).map(t => `- ${t}：${Object.entries(m[t]).map(([s, n]) => `${s}（${n}）`).join('、')}`).join('\n'); }
  if (name === 'recent_sources') return D.srcs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, a.limit || 10).map(s => `- ${s.date} ${s.title}（${D.pts.filter(p => p.src === s.title).length} 點）`).join('\n') || '還沒有來源。';
  throw new Error('沒有這個工具：' + name);
}
// ---------- MCP（JSON-RPC，一行一則）----------
const send = o => process.stdout.write(JSON.stringify(o) + '\n');
function handle(msg) {
  const { id, method, params = {} } = msg; if (id === undefined) return;   // 通知不用回
  try {
    if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'knowledge-net', version: '1.0.0' } } });
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') { let text, err = false; try { text = call(params.name, params.arguments || {}); } catch (e) { text = String(e.message); err = true; }
      return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: err } }); }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
  } catch (e) { send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e.message) } }); }
}
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) { try { handle(JSON.parse(line)); } catch (e) {} } } });
