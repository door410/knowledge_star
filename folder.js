// ===== 知識網資料夾：直接讀寫雲端硬碟裡的 Markdown（Chrome／Edge 內建功能，不用安裝任何東西）=====
// 資料夾結構：知識網資料／00-收件匣、02-知識（一個來源一個資料夾：原文.md＋每個知識點一個檔）、03-我的、04-知識網
(() => {
const FS_OK = 'showDirectoryPicker' in window;
const DIRS = ['00-收件匣', '02-知識', '03-我的', '04-知識網'];
const ORIG = JSON.parse(JSON.stringify(window.KNOWLEDGE));   // 第一版的 33 個點（搬家用）
let root = null, sig = '', busy = false, paneOpen = false;
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const safe = s => String(s).replace(/[\\/:*?"<>|\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '未命名';
const h = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };

// ---------- 畫面元件 ----------
document.head.append(h('style', {}, `
#fbar{display:flex;gap:4px;align-items:center}
#pane{position:fixed;inset:56px 12px 12px;max-width:1100px;margin:0 auto;background:#111316;color:#ddd;border:1px solid #ffffff22;border-radius:14px;z-index:20;display:flex;flex-direction:column;font-size:14px;line-height:1.7}
body.light #pane{background:#fff;color:#2b2d31;border-color:#0002}
#pane[hidden]{display:none}
#pane header{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #ffffff1a}
body.light #pane header{border-color:#0001}
#pane header b{font-size:16px;flex:1}
#pane .x{border:none;background:none;color:inherit;font-size:22px;cursor:pointer;opacity:.6}
#pbody{flex:1;overflow:auto;padding:14px 16px}
#pane input[type=text],#pane textarea{width:100%;background:transparent;color:inherit;border:1px solid #ffffff33;border-radius:8px;padding:7px 10px;font:inherit}
body.light #pane input[type=text],body.light #pane textarea{border-color:#0003}
#pane textarea{resize:vertical}
#pane .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}
#pane .go{border:1px solid #9B7BFF;background:#9B7BFF;color:#fff;border-radius:999px;padding:7px 16px;font:inherit;cursor:pointer}
#pane .go:disabled{opacity:.35;cursor:default}
#pane .go.sub{background:transparent;color:inherit;border-color:#ffffff44}
body.light #pane .go.sub{border-color:#0003}
#pane .note{color:#888;font-size:13px}
#pane ol{margin:4px 0 8px;padding-left:22px}
#pane .inbox button{display:block;width:100%;text-align:left;border:1px solid #ffffff22;background:none;color:inherit;font:inherit;border-radius:8px;padding:6px 10px;margin:4px 0;cursor:pointer}
.rv{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.rv>div{min-width:0}
.rv .src{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #ffffff1a;border-radius:10px;padding:10px 12px;max-height:65vh;overflow:auto}
.rv mark{color:inherit;border-radius:3px;padding:0 1px}
.pt{border-left:4px solid;border-radius:6px;padding:6px 10px;margin:0 0 10px;background:#ffffff08}
body.light .pt{background:#00000006}
.pt .hd{display:flex;gap:8px;align-items:center}
.pt .hd input[type=text]{font-weight:600}
.pt .two{display:flex;gap:6px;margin:6px 0}
.pt.off{opacity:.4}
.pt small{color:#888;display:block}
.lk{display:block;margin:3px 0}.lk small{display:block;color:#888;margin-left:22px}
#toast{position:fixed;left:50%;top:60px;transform:translateX(-50%);background:#000d;color:#fff;padding:8px 16px;border-radius:999px;font-size:13px;z-index:30;display:none;border:1px solid #fff3}
#pane select{background:transparent;color:inherit;border:1px solid #8886;border-radius:8px;padding:5px 6px;font:inherit}
#pane option{background:#1b1d21;color:#ddd}body.light #pane option{background:#fff;color:#2b2d31}
#pbody.rvmode{display:flex;flex-direction:column;overflow:hidden}
.rvbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.rvbar .art{border:1px solid #8886;background:none;color:inherit;font:inherit;border-radius:999px;padding:3px 12px;cursor:pointer;opacity:.7}
.rvbar .art.on{opacity:1;border-color:#9B7BFF}.rvbar .art small{margin-left:6px;opacity:.7}
#rvw{flex:1;min-height:0;display:flex;gap:16px;position:relative}
#rvw .col{flex:1;min-width:0;display:flex;flex-direction:column}
.cv{flex:1;min-height:0;overflow:auto;position:relative;padding-right:6px}
.rtabs{display:flex;gap:4px;border-bottom:1px solid #8884;margin-bottom:10px}
.rtabs button{border:none;background:none;color:inherit;opacity:.55;padding:6px 10px;cursor:grab;border-bottom:2px solid transparent;font:inherit}
.rtabs button.on{opacity:1;border-color:currentColor}.rtabs .sp{margin-left:auto;cursor:pointer;font-size:16px}
.drop{display:none;position:absolute;right:0;top:0;bottom:0;width:42%;border:2px dashed #9B7BFF;border-radius:12px;align-items:center;justify-content:center;background:#9B7BFF22;z-index:4}
#rvw.dragging .drop{display:flex}.drop.over{background:#9B7BFF55}
.ann{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:16px}
.ann .src{overflow-wrap:anywhere}
.src p{margin:0 0 .7em}.src h5{margin:1em 0 .4em;font-size:15px}.src h5.h1{font-size:18px}.src h5.h2{font-size:16px}
.src table.mt{border-collapse:collapse;margin:.4em 0 1em;font-size:13px}.mt td,.mt th{border:1px solid #8885;padding:3px 6px;vertical-align:top;text-align:left}
.src blockquote{margin:.4em 0;padding-left:10px;border-left:3px solid #8886;opacity:.85}.src hr{border:none;border-top:1px solid #8884}
.src mark{color:inherit;border-radius:3px;cursor:pointer}.src mark.hot{outline:2px solid #9B7BFF}
.notes{position:relative}
.nt{position:absolute;left:0;right:0;border-left:4px solid;border-radius:6px;padding:4px 8px;background:#ffffff0c;transition:top .15s}
body.light .nt{background:#00000008}.nt.hot{outline:1px solid #9B7BFF}.nt.off{opacity:.4}.nt.open{z-index:2;background:#1b1d21}body.light .nt.open{background:#fff;box-shadow:0 2px 10px #0002}
.nt .nh{display:flex;gap:6px;align-items:center}.nt b{cursor:pointer;font-weight:600}
.nt small{display:block;color:#888;cursor:pointer;font-size:12px;line-height:1.5}
.nt input[type=text],.nt textarea{margin-top:4px}
#pane .two{display:flex;gap:6px}
.mk{position:absolute;z-index:3;padding:4px 12px!important}
.lay{display:flex;gap:4px;margin-bottom:8px}.lay button{border:1px solid #8886;background:none;color:inherit;font:inherit;border-radius:999px;padding:2px 12px;cursor:pointer;opacity:.7}.lay .on{opacity:1;border-color:#9B7BFF}
.lr{display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid #8882}
.lr.off{opacity:.4}#pane .lr input[type=text]{flex:1;min-width:70px;width:auto}
.lr .pn{white-space:nowrap;max-width:32%;overflow:hidden;text-overflow:ellipsis}.pn i{font-style:normal;font-size:11px;opacity:.6;margin-left:4px;border:1px solid;border-radius:4px;padding:0 3px}
.rels h5{margin:12px 0 2px;font-size:14px}
.ibhead{display:flex;gap:14px;align-items:center;margin:18px 0 6px}.cols{display:flex;gap:10px;font-size:13px;opacity:.8}
table.ib{width:100%;border-collapse:collapse;font-size:13px}.ib th{text-align:left;cursor:pointer;opacity:.7;font-weight:500;padding:4px 6px;border-bottom:1px solid #8884;white-space:nowrap}
.ib td{padding:3px 6px;border-bottom:1px solid #8882}.ib a.open{cursor:pointer;text-decoration:underline dotted}#pane .ib input.tag{width:120px;padding:2px 6px}
.frm label{display:block;margin:6px 0}.frm .two label{flex:1}
.cadd{display:flex;flex-wrap:wrap;gap:4px;margin-top:12px}.cadd input,.cadd select,.cadd button{background:transparent;color:inherit;border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:inherit;font-size:13px}
.cadd #cp{flex:1 1 100%}.cadd #cn{flex:1}.cadd option{background:var(--panel)}
.q{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1px solid #8888;font-size:11px;line-height:1;opacity:.6;cursor:help;position:relative;margin:0 4px;font-weight:400;vertical-align:middle}
.q:hover,.q:focus{opacity:1}.q:hover::after,.q:focus::after{content:attr(data-tip);position:absolute;left:50%;top:calc(100% + 6px);transform:translateX(-50%);width:max-content;max-width:240px;white-space:normal;background:#000e;color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;line-height:1.6;z-index:40;text-align:left}
.pcs,.rcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;align-items:start}
.pc,.rc{border:1px solid #8883;border-left:4px solid;border-radius:8px;padding:8px 10px;background:#ffffff08;cursor:pointer}
.rc{border-left-color:#9B7BFF;cursor:default}body.light .pc,body.light .rc{background:#00000005}
.pc.off,.rc.off{opacity:.4}.pc.open{cursor:default;outline:1px solid #9B7BFF}
.pc blockquote{margin:0 0 6px;padding:0 0 6px;border-bottom:1px dashed #8885;font-size:13px;opacity:.85}
.pc .nh,.rc .nh{display:flex;gap:6px;align-items:center}.pc p{margin:4px 0 0;font-size:13px}.pc small{display:block;color:#888;font-size:12px}
.pc input[type=text],.pc textarea,.rc textarea{margin-top:4px}.pc .done{margin-top:6px;padding:3px 12px}
.rc .arr{margin:4px 0 4px 22px;opacity:.85;white-space:nowrap}.rc .arr select{padding:2px 4px;margin:0 2px}.rc>div:nth-child(3){margin-left:22px}
.rc .old{font-size:11px;border:1px solid #8888;border-radius:4px;padding:0 4px;margin-left:6px;opacity:.75;white-space:nowrap}
.rc b.off{text-decoration:line-through;opacity:.6}.rc.add{border-style:dashed;margin-top:10px;max-width:420px}.rc.add #nadd{margin-top:6px}
.src.full{margin-top:8px;border-top:1px solid #8884;padding-top:10px;overflow-wrap:anywhere}
@media(max-width:760px){.rv{grid-template-columns:1fr}#pane{inset:8px}#rvw{flex-direction:column}}
`));
const fbar = h('div', { id: 'fbar', className: 'g' }, '<button class="c" id="addBtn">＋ 丟東西進去</button><button class="c" id="newBtn">＋ 知識點</button><button class="c" id="folderBtn">連上資料夾</button>');
document.getElementById('ui').append(fbar);
const pane = h('section', { id: 'pane', hidden: true }, '<header><b id="ptitle"></b><button class="x" title="關閉">×</button></header><div id="pbody"></div>');
const toastEl = h('div', { id: 'toast' });
document.body.append(pane, toastEl);
const pbody = pane.querySelector('#pbody');
pane.querySelector('.x').onclick = () => closePane();
const toast = (t, ms = 3500) => { toastEl.textContent = t; toastEl.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.style.display = 'none', ms); };
function openPane(title, html) { pane.querySelector('#ptitle').textContent = title; pbody.innerHTML = html; pbody.scrollTop = 0; pane.hidden = false; paneOpen = true; card.hidden = true; }
function closePane() { pane.hidden = true; paneOpen = false; pbody.classList.remove('rvmode'); }
const folderBtn = document.getElementById('folderBtn');
function setFolderBtn() { folderBtn.textContent = root ? '資料夾：' + root.name : '連上資料夾'; folderBtn.classList.toggle('on', !!root); }

// ---------- 記住選過的資料夾（存在這台電腦的瀏覽器裡）----------
function idb(mode, fn) {
  return new Promise((res, rej) => {
    const o = indexedDB.open('kn-folder', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('h');
    o.onerror = () => rej(o.error);
    o.onsuccess = () => { try { const tx = o.result.transaction('h', mode); const r = fn(tx.objectStore('h')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); } catch (e) { rej(e); } };
  });
}
const saveH = x => idb('readwrite', s => s.put(x, 'root')).catch(() => {});
const loadH = () => idb('readonly', s => s.get('root')).catch(() => null);

// ---------- Markdown 讀寫 ----------
function fmVal(v) { if (typeof v === 'boolean') return String(v); if (Array.isArray(v)) return JSON.stringify(v); v = String(v ?? ''); return /^[\s"'\[{>|&*!%@`#-]|[:#]\s|\n|\s$/.test(v) ? JSON.stringify(v) : v; }
const fm = o => '---\n' + Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => k + ': ' + fmVal(v)).join('\n') + '\n---\n';
function parseMd(t) {
  t = t.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const meta = {}; let body = t;
  const m = t.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) {
    body = t.slice(m[0].length);
    m[1].split('\n').forEach(l => { const i = l.indexOf(':'); if (i < 1) return; const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim();
      if (/^["\[]/.test(v)) { try { v = JSON.parse(v); } catch (e) {} } else if (v === 'true' || v === 'false') v = v === 'true'; meta[k] = v; });
  }
  return { meta, body };
}
function pointMd(p) {
  const rel = (p.rels || []).map(relLine).join('\n');
  return fm({ id: p.id, 主題: p.top, 子主題: p.sub, 也出現在: p.also && p.also.length ? p.also : undefined, 拆點: p.by, 建立: p.created, 私人: !!p.priv }) +
    `# ${p.name}\n\n${p.desc || ''}\n\n## 為什麼拆成這個點\n${p.why || ''}\n\n## 原文出處\n${(p.quote || '').split('\n').map(l => '> ' + l).join('\n')}\n\n## 關聯\n${rel}\n`;
}
function parsePoint(t, fileName) {
  const { meta, body } = parseMd(t);
  const lines = body.split('\n'); let name = '', cur = '_', sec = { _: [] };
  for (const l of lines) {
    if (!name && /^#\s+/.test(l)) { name = l.replace(/^#\s+/, '').trim(); continue; }
    const s = l.match(/^##\s+(.*)/); if (s) { cur = s[1].trim(); sec[cur] = []; continue; }
    sec[cur].push(l);
  }
  const txt = k => (sec[k] || []).join('\n').trim();
  const rels = [];
  (sec['關聯'] || []).forEach(l => { const r = l.match(/^\s*-\s*(.*?)（id:\s*([^）]+)）(?:［([^］]*)］)?[:：]?\s*(.*)$/); if (r) rels.push({ name: r[1].trim(), id: r[2].trim(), type: (r[3] || '有關').trim(), note: r[4].trim() }); });
  return { meta, name: name || fileName.replace(/\.md$/, ''), desc: txt('_'), why: txt('為什麼拆成這個點'), quote: txt('原文出處').split('\n').map(l => l.replace(/^>\s?/, '')).join('\n').trim(), mine: txt('我的想法'), rels };
}
async function writeFile(dir, name, text) { if (window.knHist) await knHist(dir, name, text); const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close(); }
async function exists(dir, name, kind) { try { kind === 'dir' ? await dir.getDirectoryHandle(name) : await dir.getFileHandle(name); return true; } catch (e) { return false; } }
async function uniqueName(dir, base, ext, kind) { let n = base + ext, i = 2; while (await exists(dir, n, kind)) n = `${base} (${i++})${ext}`; return n; }

// ---------- 掃描資料夾 → 知識網資料 ----------
async function scan(withText) {
  const kd = await root.getDirectoryHandle('02-知識', { create: true });
  const sg = [], files = [];
  for await (const [dn, dh] of kd.entries()) {
    if (dh.kind !== 'directory') continue;
    for await (const [fn, fh] of dh.entries()) {
      if (fh.kind !== 'file' || !fn.endsWith('.md')) continue;
      const f = await fh.getFile(); sg.push(dn + '/' + fn + ':' + f.lastModified + ':' + f.size);
      if (withText) files.push({ dn, fn, f, text: await f.text() });
    }
  }
  return { sig: sg.sort().join('|'), files };
}
function toKnowledge(files) {
  const sources = {}, points = [], topics = [], tset = new Set(), links = [], lset = new Set();
  const srcOf = dn => sources[dn] || (sources[dn] = { id: dn, title: dn.replace(/^\d{4}-\d{2}-\d{2}\s*/, ''), date: (dn.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0], file: dn });
  files.forEach(({ dn, fn, f, text }) => {
    const s = srcOf(dn);
    if (fn === '原文.md') { const { meta } = parseMd(text); if (meta['標題']) s.title = meta['標題']; if (meta['日期']) s.date = meta['日期']; s.priv = !!meta['私人']; return; }
    const P = parsePoint(text, fn), m = P.meta;
    const top = String(m['主題'] || '未分類'), sub = String(m['子主題'] || '其他'), sid = top + '/' + sub;
    if (!tset.has(top)) { tset.add(top); topics.push({ id: top, name: top }); }
    if (!tset.has(sid)) { tset.add(sid); topics.push({ id: sid, name: sub, parent: top }); }
    if (!s.date) s.date = new Date(f.lastModified).toISOString().slice(0, 10);
    points.push({ id: String(m.id || dn + '/' + fn), name: P.name, topic: sid, src: [dn, ...(Array.isArray(m['也出現在']) ? m['也出現在'] : [])], desc: P.desc, why: P.why, quote: P.quote, mine: P.mine,
      by: m['拆點'] || '', priv: !!m['私人'], seen: m['最近看過'] || undefined, _rels: P.rels, _path: dn + '/' + fn });
  });
  const srcList = Object.values(sources);
  points.forEach(p => { p.src = p.src.filter(id => sources[id]); if (!p.src.length) p.src = [p._path.split('/')[0]]; });
  const ids = new Set(points.map(p => p.id));
  points.forEach(p => p._rels.forEach(r => { if (!ids.has(r.id) || r.id === p.id) return; const k = [p.id, r.id].sort().join('~'); if (lset.has(k)) return; lset.add(k); links.push({ a: p.id, b: r.id, type: r.type, note: (r.type && r.type !== '有關' ? r.type + '・' : '') + r.note }); }));
  return { sources: srcList, topics, points, links };
}
function apply(d) {
  K.sources = d.sources; K.topics = d.topics; K.points = d.points; K.links = d.links;
  view.sel = null; hover = null; tip.style.display = 'none'; card.hidden = true;
  build(); ui(); enterMode();
}
async function load(quiet) {
  if (!root || busy) return; busy = true;
  try {
    const { sig: s, files } = await scan(true); sig = s;
    const d = toKnowledge(files);
    if (!d.points.length) { if (!quiet) offerMigrate(); return; }
    apply(d);
    if (!quiet) toast(`已讀入資料夾：${d.sources.length} 份來源、${d.points.length} 個知識點`);
  } catch (e) { console.error(e); toast('讀資料夾時出錯：' + e.message, 6000); }
  finally { busy = false; }
}
// 工具開著時，資料夾裡有新增、刪除、修改，約 2 秒內同步（畫面隱藏時不檢查，不耗電）
setInterval(async () => {
  if (!root || busy || paneOpen || document.hidden) return;
  try { const { sig: s } = await scan(false); if (s !== sig) load(true); } catch (e) {}
}, 2000);

// ---------- 連上資料夾 ----------
async function connect(fromClick) {
  if (!FS_OK) { toast('這個瀏覽器不能存取資料夾，請用 Chrome 或 Edge 打開', 6000); return false; }
  try {
    let x = root || await loadH();
    if (x) {
      if (await x.queryPermission({ mode: 'readwrite' }) !== 'granted') {
        if (!fromClick) { folderBtn.textContent = '按一下連上「' + x.name + '」'; return false; }
        if (await x.requestPermission({ mode: 'readwrite' }) !== 'granted') return false;
      }
    } else {
      if (!fromClick) return false;
      x = await window.showDirectoryPicker({ id: 'kn', mode: 'readwrite' });
      if (x.name !== '知識網資料' && !(await exists(x, '02-知識', 'dir'))) x = await x.getDirectoryHandle('知識網資料', { create: true });
      await saveH(x);
    }
    root = x;
    for (const d of DIRS) await root.getDirectoryHandle(d, { create: true });
    setFolderBtn(); await load(); return true;
  } catch (e) { if (e.name !== 'AbortError') toast('連不上資料夾：' + e.message, 6000); return false; }
}
folderBtn.onclick = async () => {
  if (!root) { await connect(true); return; }
  openPane('知識網資料夾', `<p>現在連著：<b>${esc(root.name)}</b></p>
   <div class="row"><button class="go sub" id="reload">重新讀一次</button><button class="go sub" id="change">換一個資料夾</button></div>`);
  pbody.querySelector('#reload').onclick = () => { closePane(); load(); };
  pbody.querySelector('#change').onclick = async () => { closePane(); root = null; await idb('readwrite', s => s.delete('root')).catch(() => {}); setFolderBtn(); connect(true); };
};

// ---------- 第一次：把第一版的 33 個知識點存進資料夾 ----------
function offerMigrate() {
  openPane('資料夾是空的', `<p>已經連上「${esc(root.name)}」，裡面還沒有知識點。</p>
   <p>要把第一版的 <b>${ORIG.points.length} 個知識點</b>（2 份影片分析，Claude 代拆）存進去嗎？存好後，每個知識點都是一個 Markdown 檔，Obsidian 也打得開。</p>
   <div class="row"><button class="go" id="mig">存進去</button><button class="go sub" id="skip">先不要</button></div>`);
  pbody.querySelector('#skip').onclick = closePane;
  pbody.querySelector('#mig').onclick = async () => {
    pbody.innerHTML = '<p>存檔中…</p>';
    try {
      const kd = await root.getDirectoryHandle('02-知識', { create: true }), folder = {};
      const tn = {}; ORIG.topics.forEach(t => tn[t.id] = t);
      for (const s of ORIG.sources) {
        const dn = await uniqueName(kd, safe(s.date + ' ' + s.title), '', 'dir'); folder[s.id] = dn;
        const dh = await kd.getDirectoryHandle(dn, { create: true });
        const raw = (window.FIRST_SOURCES || {})[s.file] || '（原文沒有找到）';
        await writeFile(dh, '原文.md', fm({ 標題: s.title, 日期: s.date, 類型: '影片分析', 私人: false }) + raw.replace(/^---\n[\s\S]*?\n---\n/, '') + '\n');
      }
      const nm = {}; ORIG.points.forEach(p => nm[p.id] = p.name);
      for (const p of ORIG.points) {
        const sub = tn[p.topic], top = tn[sub.parent] || sub;
        const rels = ORIG.links.filter(l => l.a === p.id).map(l => ({ id: l.b, name: nm[l.b], note: l.note }));
        const date = (ORIG.sources.find(s => s.id === p.src[0]) || {}).date || today();
        const dh = await kd.getDirectoryHandle(folder[p.src[0]]);
        await writeFile(dh, await uniqueName(dh, safe(p.name), '.md'), pointMd({ ...p, top: top.name, sub: sub.name, also: p.src.slice(1).map(id => folder[id]), by: 'Claude 代拆（第一版）', created: date, rels }));
      }
      closePane(); await load();
    } catch (e) { console.error(e); pbody.innerHTML = '<p>存檔時出錯：' + esc(e.message) + '</p>'; }
  };
}

// ---------- 丟東西進去：待拆清單 → 給 AI（手動模式）→ 看拆解 → 存檔 ----------
const RTYPES = ['有關', '因果', '相反', '例子', '屬於'];
const typeList = () => [...new Set([...RTYPES, ...K.links.map(l => l.type).filter(Boolean)])];
const BATCH_MAX = 20000;   // 一次給 AI 的字數上限，超過就分批
let draft = null, job = null;
const qtip = t => `<span class="q" tabindex="0" data-tip="${esc(t)}">?</span>`;
const isTxt = n => /\.(txt|md)$/i.test(n);
const realPts = () => K.points.filter(p => !p.demo);
const topNames = () => [...new Set(K.topics.filter(t => !t.parent).map(t => t.name))];
const subNames = top => [...new Set(K.topics.filter(t => t.parent && (!top || t.parent === top)).map(t => t.name))];
const dl = (id, arr) => `<datalist id="${id}">${arr.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
const typeSel = (v, attr = '') => `<select ${attr}>${typeList().map(t => `<option${t === (v || '有關') ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;

async function readInbox() {
  const ib = await root.getDirectoryHandle('00-收件匣', { create: true }), out = [];
  for await (const [n, x] of ib.entries()) {
    if (x.kind !== 'file' || !isTxt(n)) continue;
    const f = await x.getFile(), t = await f.text(), { meta, body } = parseMd(t);
    out.push({ n, meta, body: /\.md$/i.test(n) ? body : t, title: meta['標題'] || n.replace(/\.(txt|md)$/i, ''),
      from: meta['來源'] === '電腦' ? '電腦' : '手機', date: meta['日期'] || new Date(f.lastModified).toISOString().slice(0, 10), tag: meta['標籤'] || '', priv: !!meta['私人'] });
  }
  return out;
}
async function writeInbox(it) {   // 存成 .md（手機來的 .txt 加上標籤時也改存成 .md）
  const ib = await root.getDirectoryHandle('00-收件匣', { create: true });
  const name = it.n && /\.md$/i.test(it.n) ? it.n : await uniqueName(ib, safe(it.title), '.md');
  await writeFile(ib, name, fm({ 標題: it.title, 來源: it.from, 日期: it.date, 標籤: it.tag, 私人: it.priv || undefined }) + it.body.trim() + '\n');
  if (it.n && it.n !== name) { try { await ib.removeEntry(it.n); } catch (e) {} }
  it.n = name;
}

document.getElementById('addBtn').onclick = async () => { if (!root && !(await connect(true))) return; draft = { title: '', text: '', priv: false, inbox: null }; inboxPane(); };
async function inboxPane() {
  const items = await readInbox();
  const cols = store.get('ibCols', { from: true, date: true, len: true, tag: true }), sort = store.get('ibSort', { k: 'date', d: -1 });
  const val = { title: i => i.title, from: i => i.from, date: i => i.date, len: i => i.body.length, tag: i => i.tag };
  items.sort((a, b) => { const x = val[sort.k](a), y = val[sort.k](b); return (x > y ? 1 : x < y ? -1 : 0) * sort.d; });
  const tags = [...new Set(items.map(i => i.tag).filter(Boolean))];
  const th = (k, t) => `<th data-s="${k}">${t}${sort.k === k ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  openPane('丟東西進去', `
   <div class="row"><input type="text" id="dtitle" placeholder="標題"></div>
   <textarea id="dtext" rows="7" placeholder="貼上文章、AI 的回答、影片分析"></textarea>
   <div class="row"><label><input type="checkbox" id="dpriv"> 私人</label>${qtip('勾了就不送給 AI，只把原文存進知識網。')}<span style="flex:1"></span>
    <button class="go sub" id="keep">先存著</button>${qtip('放進下面的待拆清單，之後想拆再拆。')}<button class="go" id="next">交給 AI 拆</button>${qtip('貼的是原文：下一步複製給 AI。貼的是 AI 拆好的回答：直接看拆解。')}</div>
   <div class="ibhead"><b>待拆 ${items.length}</b><span class="cols">${[['from', '來源'], ['date', '日期'], ['len', '字數'], ['tag', '標籤']].map(([k, t]) => `<label><input type="checkbox" data-c="${k}"${cols[k] ? ' checked' : ''}> ${t}</label>`).join('')}</span></div>
   ${items.length ? `<table class="ib"><thead><tr><th></th>${th('title', '標題')}${cols.from ? th('from', '來源') : ''}${cols.date ? th('date', '日期') : ''}${cols.len ? th('len', '字數') : ''}${cols.tag ? th('tag', '標籤' + qtip('同類的文章打一樣的標籤，下面按標籤就能一次勾起來。')) : ''}</tr></thead><tbody>
    ${items.map((it, i) => `<tr data-i="${i}"><td><input type="checkbox" class="pick"${it.priv ? ' disabled title="私人"' : ''}></td><td><a class="open">${esc(it.title)}</a>${it.priv ? ' <small>私人</small>' : ''}</td>${cols.from ? `<td>${it.from}</td>` : ''}${cols.date ? `<td>${it.date}</td>` : ''}${cols.len ? `<td>${it.body.length}</td>` : ''}${cols.tag ? `<td><input type="text" class="tag" list="tagl" value="${esc(it.tag)}"></td>` : ''}</tr>`).join('')}
   </tbody></table>${dl('tagl', tags)}
   <div class="row"><button class="go" id="multi" disabled>勾選的一起拆</button>${qtip('勾選的文章合成一份給 AI，只要貼一次；太長會自動分幾次。')}<button class="go sub" id="del" disabled>刪除勾選</button>${tags.length ? `${tags.map(t => `<button class="go sub tg">${esc(t)}</button>`).join('')}` : ''}</div>` : ''}`);
  const T = pbody.querySelector('#dtitle'), X = pbody.querySelector('#dtext'), Pv = pbody.querySelector('#dpriv'), N = pbody.querySelector('#next');
  T.value = draft.title; X.value = draft.text; Pv.checked = draft.priv;
  const sync = () => { draft.title = T.value.trim(); draft.text = X.value; draft.priv = Pv.checked; N.textContent = draft.priv ? '存進知識網（不送 AI）' : '交給 AI 拆'; };
  [T, X, Pv].forEach(e => e.oninput = e.onchange = sync); sync();
  const ready = () => { sync(); if (!draft.text.trim()) { toast('還沒有貼上內容'); return false; } if (!draft.title) draft.title = draft.text.trim().split('\n')[0].replace(/^#+\s*/, '').slice(0, 30); return true; };
  pbody.querySelector('#keep').onclick = async () => {
    if (!ready()) return;
    const old = draft.inbox && items.find(i => i.n === draft.inbox);
    await writeInbox(old ? Object.assign(old, { title: draft.title, body: draft.text, priv: draft.priv }) : { title: draft.title, body: draft.text, from: '電腦', date: today(), tag: '', priv: draft.priv });
    draft = { title: '', text: '', priv: false, inbox: null }; inboxPane(); toast('已存到待拆');
  };
  N.onclick = () => {
    if (!ready()) return;
    const a = { title: draft.title, text: draft.text, priv: draft.priv, inbox: draft.inbox };
    if (a.priv) { job = { arts: [a] }; saveJob([]); return; }
    if (asAnswer(a)) return;
    startJob([a]);
  };
  pbody.querySelectorAll('[data-c]').forEach(c => c.onchange = () => { cols[c.dataset.c] = c.checked; store.set('ibCols', cols); inboxPane(); });
  pbody.querySelectorAll('[data-s]').forEach(c => c.onclick = () => { const k = c.dataset.s; store.set('ibSort', { k, d: sort.k === k ? -sort.d : (k === 'title' || k === 'tag' ? 1 : -1) }); inboxPane(); });
  const picked = () => [...pbody.querySelectorAll('tr[data-i]')].filter(r => r.querySelector('.pick').checked).map(r => items[+r.dataset.i]);
  const upd = () => { const n = picked().length, m = pbody.querySelector('#multi'); if (!m) return; m.disabled = pbody.querySelector('#del').disabled = !n;
    const len = picked().reduce((s, i) => s + i.body.length, 0); m.textContent = n ? `勾選的 ${n} 篇一起拆` + (len > BATCH_MAX ? `（分 ${batches(picked()).length} 次）` : '') : '勾選的一起拆'; };
  pbody.querySelectorAll('.pick').forEach(c => c.onchange = upd);
  pbody.querySelectorAll('.tg').forEach(b => b.onclick = () => { pbody.querySelectorAll('tr[data-i]').forEach(r => { const it = items[+r.dataset.i]; if (!it.priv) r.querySelector('.pick').checked = it.tag === b.textContent; }); upd(); });
  pbody.querySelectorAll('.open').forEach(a => a.onclick = () => { const it = items[+a.closest('tr').dataset.i]; draft = { title: it.title, text: it.body, priv: it.priv, inbox: it.n }; T.value = it.title; X.value = it.body; Pv.checked = it.priv; sync(); pbody.scrollTop = 0; });
  pbody.querySelectorAll('.tag').forEach(t => t.onchange = async () => { const it = items[+t.closest('tr').dataset.i]; it.tag = t.value.trim(); await writeInbox(it); inboxPane(); });
  const m = pbody.querySelector('#multi');
  if (m) {
    m.onclick = () => startJob(picked().map(it => ({ title: it.title, text: it.body, priv: false, inbox: it.n })));
    pbody.querySelector('#del').onclick = async () => { const ib = await root.getDirectoryHandle('00-收件匣'); for (const it of picked()) { try { await ib.removeEntry(it.n); } catch (e) {} } inboxPane(); toast('已刪除（雲端硬碟垃圾桶可救回）'); };
  }
}
function batches(arts) { const out = []; let cur = [], len = 0;
  arts.forEach(a => { const l = (a.text || a.body).length; if (cur.length && len + l > BATCH_MAX) { out.push(cur); cur = []; len = 0; } cur.push(a); len += l; });
  if (cur.length) out.push(cur); return out; }
// 貼的是 AI 拆好的回答（JSON）：直接看拆解，原文用回答裡引的句子
function asAnswer(a) {
  if (!/"(知識點|points)"\s*:/.test(a.text)) return false;
  job = { arts: [a] }; const r = parseAnswer(a.text, true); if (!r) { job = null; return false; }
  r.points.forEach(p => p.art = 0);
  a.json = true; a.text = r.points.map(p => p.quote).filter(Boolean).join('\n\n');
  if (!a.title || /^[`{\s]/.test(a.title)) a.title = `${r.points[0].name} 等 ${r.points.length} 點`;
  job.r = r; step3(); return true;
}
function startJob(arts) {
  const js = arts.filter(a => /"(知識點|points)"\s*:/.test(a.text));
  if (js.length && arts.length === 1) { if (asAnswer(arts[0])) return; }
  else if (js.length) { toast('AI 拆好的回答要一篇一篇看，這次先拆其他的', 6000); arts = arts.filter(a => !js.includes(a)); if (!arts.length) return; }
  job = { queue: batches(arts), bi: 0 }; job.total = job.queue.length; nextBatch(); }
function nextBatch() { job.arts = job.queue[job.bi]; job.answer = ''; step2(); }

function buildPrompt() {
  const real = realPts().filter(p => !p.priv);
  const tops = K.topics.filter(t => !t.parent).map(t => `- ${t.name}：${K.topics.filter(s => s.parent === t.id).map(s => s.name).join('、')}`).join('\n') || '（還沒有）';
  const tn = {}; K.topics.forEach(t => tn[t.id] = t);
  const list = real.slice(-400).map(p => { const s = tn[p.topic]; return `- ${p.id}｜${p.name}｜${s ? (tn[s.parent] || s).name + '/' + s.name : ''}`; }).join('\n') || '（還沒有）';
  const many = job.arts.length > 1;
  return `請幫我把下面的${many ? ' ' + job.arts.length + ' 篇' : ''}「原文」拆成知識點。只輸出一個 JSON，放在 \`\`\`json 區塊裡，不要其他說明。

規則：
1. 一個知識點＝一個可以單獨看懂的重點，名稱 4～12 個字。
2. 每個知識點附：說明（1～2 句白話）、理由（為什麼值得拆成一個點，一句）、原文（從原文「逐字複製」最能代表它的一段，不可以改寫）${many ? '、文章（它來自第幾篇，填數字）' : ''}。
3. 主題、子主題：優先用「現有主題」裡的名稱；都不合適才取新的（主題 2～6 字，子主題 2～8 字）。
4. 關聯：只有意思真的相關才連，每條附類型（從「${RTYPES.join('、')}」選一個）和一句白話說明。可以連這次的其他新知識點（寫名稱），也可以連「現有知識點」（寫 id）。名字一樣但意思不同的，不要連。
5. 不要合併知識點，不要改寫原文。

JSON 格式：
{"知識點":[{"名稱":"","主題":"","子主題":"","說明":"","理由":"","原文":""${many ? ',"文章":1' : ''}}],
 "關聯":[{"甲":"新知識點名稱","乙":"新知識點名稱或現有知識點 id","類型":"有關","說明":""}]}

現有主題（主題：子主題）：
${tops}

現有知識點（id｜名稱｜主題/子主題）：
${list}

${job.arts.map((a, i) => `${many ? `【第 ${i + 1} 篇】` : ''}原文標題：${a.title}
原文：
<<<
${a.text.trim()}
>>>`).join('\n\n')}`;
}
function step2() {
  const prompt = window.knPromptExtra ? knPromptExtra(buildPrompt()) : buildPrompt();
  openPane('交給 AI 拆' + (job.total > 1 ? `（第 ${job.bi + 1}／${job.total} 次）` : '') + '：' + job.arts.map(a => a.title).join('、'), `
   <div class="row"><button class="go" id="copy">複製給 AI 的內容</button><button class="go sub" id="back">← 待拆</button><span class="note">${prompt.length} 字</span></div>
   <textarea id="ans" rows="12" placeholder="貼上 AI 的回答"></textarea>
   <div class="row"><button class="go" id="review">先看拆解</button><button class="go sub" id="direct">直接放進去</button>${qtip('不看拆解，直接存進知識網。')}</div>
   <details><summary class="note">給 AI 的內容</summary><textarea id="pr" rows="10" readonly></textarea></details>`);
  const pr = pbody.querySelector('#pr'), ans = pbody.querySelector('#ans'); pr.value = prompt; ans.value = job.answer || '';
  ans.oninput = () => job.answer = ans.value;
  pbody.querySelector('#back').onclick = inboxPane;
  pbody.querySelector('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(prompt); } catch (e) { pr.parentElement.open = true; pr.select(); document.execCommand('copy'); }
    toast('已複製，去 Gemini 或 ChatGPT 貼上');
  };
  const go = dir => { const r = parseAnswer(ans.value); if (!r) return; job.r = r; if (dir) saveJob(); else step3(); };
  pbody.querySelector('#review').onclick = () => go(false);
  pbody.querySelector('#direct').onclick = () => go(true);
  if (window.aiSocket) aiSocket(prompt, ans, () => go(false));
}
window.KN = { h, toast, qtip, openPane, closePane, pbody, pane, step2, load, writeFile, realPts, mdHtml, markQuote, RTYPES, get HL() { return HL; }, get root() { return root; } }; // 給 ai.js、layer2.js 用
function parseAnswer(t, quiet) {
  const say = quiet ? () => {} : toast;
  t = (t || '').trim(); if (!t) { say('還沒有貼上 AI 的回答'); return null; }
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/); let s = m ? m[1] : t;
  const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b < a) { say('看不懂這段回答（找不到 JSON），請再貼一次完整的回答', 6000); return null; }
  let o; try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { say('回答的格式有點壞掉，請請 AI「只輸出 JSON」再試一次', 6000); return null; }
  const n = job.arts.length;
  const pts = (o['知識點'] || o.points || []).filter(p => p && (p['名稱'] || p.name)).map((p, i) => ({
    key: i, on: true, name: String(p['名稱'] || p.name).trim(), top: String(p['主題'] || '未分類').trim(), sub: String(p['子主題'] || '其他').trim(),
    desc: String(p['說明'] || ''), why: String(p['理由'] || ''), quote: String(p['原文'] || ''), art: Math.min(n, Math.max(1, parseInt(p['文章']) || 1)) - 1 }));
  if (!pts.length) { say('回答裡沒有知識點，請再試一次', 6000); return null; }
  const links = (o['關聯'] || o.links || []).map(l => ({ on: true, a: String(l['甲'] ?? l.a ?? '').trim(), b: String(l['乙'] ?? l.b ?? '').trim(), type: String(l['類型'] ?? l.type ?? '有關').trim() || '有關', note: String(l['說明'] ?? l.note ?? '') })).filter(l => l.a && l.b && l.a !== l.b);
  return { points: pts, links };
}

// ---------- 乾淨排版：Markdown → 畫面（不顯示開頭資料區和符號）----------
function mdHtml(t) {
  t = t.replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n?/, '');
  const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<b>$1</b>').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1$2');
  const L = t.split('\n'), out = []; let para = [];
  const flush = () => { if (para.length) out.push('<p>' + para.map(inl).join('<br>') + '</p>'); para = []; };
  for (let i = 0; i < L.length; i++) {
    const l = L[i], s = l.trim();
    if (!s) { flush(); continue; }
    let m;
    if ((m = s.match(/^(#{1,6})\s+(.*)/))) { flush(); out.push(`<h5 class="h${Math.min(3, m[1].length)}">${inl(m[2])}</h5>`); continue; }
    if (/^([-*_])\1{2,}$/.test(s)) { flush(); out.push('<hr>'); continue; }
    if (s.startsWith('|')) { flush(); const rows = []; while (i < L.length && L[i].trim().startsWith('|')) { const r = L[i].trim(); if (!/^\|[\s:|-]+\|?$/.test(r)) rows.push(r.replace(/^\||\|$/g, '').split('|').map(c => c.trim())); i++; } i--;
      out.push('<table class="mt">' + rows.map((r, k) => '<tr>' + r.map(c => k ? `<td>${inl(c)}</td>` : `<th>${inl(c)}</th>`).join('') + '</tr>').join('') + '</table>'); continue; }
    if ((m = s.match(/^>\s?(.*)/))) { flush(); out.push(`<blockquote>${inl(m[1])}</blockquote>`); continue; }
    if ((m = s.match(/^([-*+]|\d+[.)])\s+(.*)/))) { flush(); out.push(`<p class="li">${/\d/.test(m[1]) ? m[1] : '•'} ${inl(m[2])}</p>`); continue; }
    para.push(s);
  }
  flush(); return out.join('');
}
// 在畫面文字裡找 AI 引的原文（忽略空白和符號），標上顏色
function markQuote(box, quote, color, key) {
  const norm = c => !/[\s*_#>|`]/.test(c);
  const q = [...quote].filter(norm).join(''); if (!q) return false;
  const walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), map = []; let full = '', nd;
  while ((nd = walk.nextNode())) { const inM = !!nd.parentElement.closest('mark');
    for (let i = 0; i < nd.data.length; i++) if (norm(nd.data[i])) { full += inM ? '\u0001' : nd.data[i]; map.push([nd, i]); } }
  let at = full.indexOf(q), len = q.length;
  if (at < 0 && q.length > 12) { at = full.indexOf(q.slice(0, 12)); len = 12; }
  if (at < 0) return false;
  const [n0, o0] = map[at], [n1, o1] = map[at + len - 1];
  const parts = []; const w2 = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let on = false;
  while ((nd = w2.nextNode())) { if (nd === n0) on = true; if (on) parts.push(nd); if (nd === n1) break; }
  parts.forEach(n => { const a = n === n0 ? o0 : 0, b = n === n1 ? o1 + 1 : n.data.length; if (b <= a) return;
    const r = document.createRange(); r.setStart(n, a); r.setEnd(n, b); const mk = document.createElement('mark'); mk.dataset.k = key; mk.style.background = color + '55'; r.surroundContents(mk); });
  return true;
}

// ---------- ③ 看拆解：分頁「原文＋知識點」「關聯」，把分頁拖到右邊＝並排 ----------
const HL = ['#FFB020', '#6EA8FF', '#FF8FB1', '#5FE0C1', '#C9A2FF', '#F7A072', '#8FD3FF', '#B5E36B'];
let rv = { art: 0, tab: 'txt', open: null };
function step3() {
  const r = job.r; r.points.forEach((p, i) => p.color = p.color || HL[i % HL.length]);
  rv = { art: 0, tab: 'txt', open: null, full: false, split: store.get('rvSplit', false), lay: store.get('rvLay', 'xls') };
  openPane('先看拆解', `<div class="rvbar"><span id="arts"></span><span style="flex:1"></span><button class="go sub" id="back">← 重貼回答</button><button class="go" id="save">放進知識網</button></div><div id="rvw"></div>
   ${dl('tops', topNames())}${dl('subs', subNames())}${dl('allp', [...r.points.map(p => p.name), ...realPts().map(p => p.name)])}`);
  pbody.classList.add('rvmode');
  pbody.querySelector('#back').onclick = () => { pbody.classList.remove('rvmode'); if (job.arts[0].json) inboxPane(); else step2(); };
  pbody.querySelector('#save').onclick = () => { pbody.classList.remove('rvmode'); saveJob(); };
  drawRv();
}
function drawRv() {
  const r = job.r, arts = job.arts;
  pbody.querySelector('#arts').innerHTML = arts.length > 1 ? arts.map((a, i) => `<button class="art${i === rv.art ? ' on' : ''}" data-a="${i}">${esc(a.title)}<small>${r.points.filter(p => p.art === i && p.on).length}</small></button>`).join('') : `<b>${esc(arts[0].title)}</b>`;
  pbody.querySelectorAll('.art').forEach(b => b.onclick = () => { rv.art = +b.dataset.a; drawRv(); });
  const tabs = ks => `<nav class="rtabs">${ks.map(k => `<button draggable="true" data-t="${k}" class="${k === (rv.split ? k : rv.tab) ? 'on' : ''}">${k === 'txt' ? '知識點' : '關聯'}</button>`).join('')}<button class="sp" title="${rv.split ? '合成一頁' : '並排'}">${rv.split ? '▭' : '◫'}</button></nav>`;
  const w = pbody.querySelector('#rvw');
  w.className = rv.split ? 'split' : '';
  w.innerHTML = rv.split ? `<div class="col">${tabs(['txt'])}<div class="cv" id="vtxt"></div></div><div class="col">${tabs(['rel'])}<div class="cv" id="vrel"></div></div>`
    : `<div class="col">${tabs(['txt', 'rel'])}<div class="cv" id="v${rv.tab}"></div></div><div class="drop">拖到這裡並排</div>`;
  w.querySelectorAll('.rtabs [data-t]').forEach(b => { b.onclick = () => { if (!rv.split) { rv.tab = b.dataset.t; drawRv(); } };
    b.ondragstart = e => { e.dataTransfer.setData('text/plain', b.dataset.t); w.classList.add('dragging'); }; b.ondragend = () => w.classList.remove('dragging'); });
  const setSplit = v => { rv.split = v; store.set('rvSplit', v); drawRv(); };
  w.querySelectorAll('.sp').forEach(b => b.onclick = () => setSplit(!rv.split));
  const dz = w.querySelector('.drop'); if (dz) { dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = e => { e.preventDefault(); setSplit(true); }; }
  if (rv.split) w.querySelectorAll('.rtabs').forEach(n => { n.ondragover = e => e.preventDefault(); n.ondrop = e => { e.preventDefault(); setSplit(false); }; });
  if (w.querySelector('#vtxt')) drawTxt(w.querySelector('#vtxt'));
  if (w.querySelector('#vrel')) drawRel(w.querySelector('#vrel'));
}
function drawTxt(v) {
  const r = job.r, pts = r.points.filter(p => p.art === rv.art), a = job.arts[rv.art];
  const card = p => {
    const ed = rv.open === p.key;
    return `<div class="pc${p.on ? '' : ' off'}${ed ? ' open' : ''}" data-k="${p.key}" style="border-color:${p.color}">
     ${p.quote ? `<blockquote>${esc(p.quote)}</blockquote>` : ''}
     <div class="nh"><input type="checkbox" data-f="on"${p.on ? ' checked' : ''}>${ed ? `<input type="text" data-f="name" value="${esc(p.name)}">` : `<b>${esc(p.name)}</b>`}</div>
     ${ed ? `<div class="two"><input type="text" data-f="top" list="tops" value="${esc(p.top)}"><input type="text" data-f="sub" list="subs" value="${esc(p.sub)}"></div><textarea rows="3" data-f="desc">${esc(p.desc)}</textarea><button class="go sub done">完成</button>`
       : `<small>${esc(p.top)}／${esc(p.sub)}</small>${p.desc ? `<p>${esc(p.desc)}</p>` : ''}`}</div>`;
  };
  v.innerHTML = `<div class="pcs">${pts.map(card).join('')}</div>
   ${a.json ? '' : `<div class="row"><button class="go sub" id="full">${rv.full ? '收起整篇原文' : '整篇原文'}</button>${qtip('看整篇原文。反白一段字，可以把它變成新的知識點。')}</div>
   ${rv.full ? `<div class="src full">${mdHtml(a.text)}</div><button class="go mk" hidden>變成知識點</button>` : ''}`}`;
  v.querySelectorAll('.pc').forEach(el => { const p = r.points[+el.dataset.k];
    el.onclick = e => { if (rv.open === p.key || e.target.matches('input,textarea,select,button')) return; rv.open = p.key; drawTxt(v); };
    el.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => { const f = inp.dataset.f;
      if (f === 'name') r.links.forEach(l => { if (l.a === p.name) l.a = inp.value; if (l.b === p.name) l.b = inp.value; });
      p[f] = f === 'on' ? inp.checked : inp.value; if (f === 'on') el.classList.toggle('off', !p.on); const o = pbody.querySelector('#vrel'); if (o && f !== 'desc') drawRel(o); });
    const d = el.querySelector('.done'); if (d) d.onclick = () => { rv.open = null; drawTxt(v); }; });
  const fb = v.querySelector('#full'); if (fb) fb.onclick = () => { rv.full = !rv.full; drawTxt(v); };
  const src = v.querySelector('.src'), mkb = v.querySelector('.mk');
  if (!src) return;
  pts.forEach(p => markQuote(src, p.quote, p.color, p.key));
  src.onmouseup = () => setTimeout(() => { const s = getSelection(), t = s.toString().trim();
    if (!t || !src.contains(s.anchorNode)) { mkb.hidden = true; return; }
    const b = s.getRangeAt(0).getBoundingClientRect(), vb = v.getBoundingClientRect();
    mkb.style.left = (b.left - vb.left) + 'px'; mkb.style.top = (b.bottom - vb.top + v.scrollTop + 4) + 'px'; mkb.hidden = false;
    mkb.onclick = () => { const k = r.points.length, last = pts[pts.length - 1] || r.points[0];
      r.points.push({ key: k, on: true, name: t.replace(/\s+/g, ' ').slice(0, 14), top: last ? last.top : '未分類', sub: last ? last.sub : '其他', desc: '', why: '', quote: t, art: rv.art, mine: true, color: HL[k % HL.length] });
      rv.open = k; getSelection().removeAllRanges(); drawRv(); v.scrollTop = 0; }; }, 0);
}
function drawRel(v) {
  const r = job.r, nm = x => { const p = r.points.find(q => q.name === x); if (p) return { name: p.name, off: !p.on }; const o = byId[x] || realPts().find(q => q.name === x); return o ? { name: o.name, old: true } : { name: x }; };
  const lab = x => { const o = nm(x); return `<b class="${o.off ? 'off' : ''}">${esc(o.name)}</b>${o.old ? `<span class="old">已有${qtip('這個點是知識網裡本來就有的，不是這次新拆的。')}</span>` : ''}`; };
  const card = ({ l, i }) => `<div class="rc${l.on ? '' : ' off'}" data-i="${i}">
    <div class="nh"><input type="checkbox" data-f="on"${l.on ? ' checked' : ''}>${lab(l.a)}</div>
    <div class="arr">──${typeSel(l.type, 'data-f="type"')}──▶</div>
    <div>${lab(l.b)}</div>
    <textarea rows="2" data-f="note" placeholder="為什麼有關">${esc(l.note)}</textarea></div>`;
  const mine = new Set(r.points.filter(p => p.art === rv.art).map(p => p.name)), L = r.links.map((l, i) => ({ l, i })).filter(({ l }) => mine.has(l.a) || mine.has(l.b));
  const grid = arr => `<div class="rcs">${arr.map(card).join('')}</div>`;
  let body = '';
  if (rv.lay === 'xls') body = grid(L);
  if (rv.lay === 'book') { const names = [...new Set(L.map(({ l }) => nm(l.a).name))];
    body = names.map(n => `<h5>${esc(n)}</h5>` + grid(L.filter(({ l }) => nm(l.a).name === n))).join(''); }
  if (rv.lay === 'box') body = typeList().filter(t => L.some(({ l }) => l.type === t)).map(t => `<h5>${esc(t)}</h5>` + grid(L.filter(({ l }) => l.type === t))).join('');
  v.innerHTML = `<div class="lay">${[['xls', '全部'], ['book', '依知識點'], ['box', '依關係']].map(([k, t]) => `<button data-l="${k}" class="${rv.lay === k ? 'on' : ''}">${t}</button>`).join('')}</div>
   ${body}
   <div class="rc add"><input type="text" id="na" list="allp" placeholder="知識點"><div class="arr">──${typeSel('有關', 'id="nt"')}──▶</div><input type="text" id="nb" list="allp" placeholder="另一個知識點"><textarea rows="2" id="nn" placeholder="為什麼有關"></textarea><button class="go sub" id="nadd">＋ 加這條關聯</button></div>`;
  v.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { rv.lay = b.dataset.l; store.set('rvLay', rv.lay); drawRel(v); });
  v.querySelectorAll('.rc[data-i]').forEach(el => { const l = r.links[+el.dataset.i];
    el.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => { const f = inp.dataset.f; l[f] = f === 'on' ? inp.checked : inp.value; if (f !== 'note') drawRel(v); }); });
  v.querySelector('#nadd').onclick = () => { const a = v.querySelector('#na').value.trim(), b = v.querySelector('#nb').value.trim();
    const idOf = x => r.points.some(p => p.name === x) ? x : ((realPts().find(p => p.name === x) || {}).id || '');
    if (!idOf(a) || !idOf(b) || a === b) { toast('請從清單選兩個不同的知識點'); return; }
    r.links.push({ on: true, a: idOf(a), b: idOf(b), type: v.querySelector('#nt').value, note: v.querySelector('#nn').value.trim() }); drawRel(v); };
}

// ---------- 存檔：02-知識／日期 標題／原文.md＋每個知識點一個檔 ----------
const relLine = r => `- ${r.name}（id: ${r.id}）${r.type && r.type !== '有關' ? '［' + r.type + '］' : ''}：${r.note || ''}`;
async function saveJob() {
  const r = job.r || { points: [], links: [] };
  pbody.innerHTML = '<p>存檔中…</p>';
  try {
    const kd = await root.getDirectoryHandle('02-知識', { create: true }), date = today(), stamp = Date.now().toString(36), byName = {};
    const pts = r.points.filter(p => p.on && p.name.trim());
    pts.forEach((p, i) => { p.id = 'k' + stamp + i; p.rels = []; byName[p.name.trim()] = p; });
    const resolve = x => byName[x] || (byId[x] && !byId[x].demo ? { id: x, name: byId[x].name, old: true } : null);
    r.links.filter(l => l.on).forEach(l => { let a = resolve(l.a), b = resolve(l.b); if (!a || !b || a === b) return; if (a.old) [a, b] = [b, a]; if (a.old) return; a.rels.push({ id: b.id, name: b.name, note: l.note, type: l.type }); });
    for (let ai = 0; ai < job.arts.length; ai++) {
      const a = job.arts[ai];
      const dn = await uniqueName(kd, safe(date + ' ' + a.title), '', 'dir'), dh = await kd.getDirectoryHandle(dn, { create: true });
      await writeFile(dh, '原文.md', fm({ 標題: a.title, 日期: date, 類型: a.json ? 'AI 回答' : a.inbox ? '收件匣' : '貼上文字', 私人: a.priv }) + a.text.trim() + '\n');
      for (const p of pts.filter(p => (p.art || 0) === ai)) await writeFile(dh, await uniqueName(dh, safe(p.name), '.md'), pointMd({ ...p, name: p.name.trim(), by: p.mine ? '自己新增' : '手動模式（貼給 AI）', created: date, priv: a.priv }));
      if (a.inbox) { try { const ib = await root.getDirectoryHandle('00-收件匣'); await ib.removeEntry(a.inbox); } catch (e) {} }
    }
    toast(pts.length ? `已放進知識網：${pts.length} 個知識點` : '已存好原文（私人）', 5000);
    if (job.queue && job.bi + 1 < job.total) { job.bi++; await load(true); nextBatch(); return; }
    closePane(); await load(true);
  } catch (e) { console.error(e); pbody.innerHTML = '<p>存檔時出錯：' + esc(e.message) + '</p>'; }
}

// ---------- ＋知識點（工具列）----------
document.getElementById('newBtn').onclick = async () => {
  if (!root && !(await connect(true))) return;
  const srcs = K.sources.filter(s => !s.demo);
  openPane('新增知識點', `
   <div class="frm"><label>名稱<input type="text" id="fn"></label>
   <div class="two"><label>主題<input type="text" id="ft" list="tops"></label><label>子主題<input type="text" id="fs" list="subs"></label></div>
   <label>說明<textarea id="fd" rows="3"></textarea></label>
   <label>來源<select id="fo"><option value="">我自己</option>${srcs.map(s => `<option value="${esc(s.id)}">${esc(s.date + ' ' + s.title)}</option>`).join('')}</select></label>
   <label>原文出處<textarea id="fq" rows="2"></textarea></label>
   <b>關聯</b><div id="frel"></div><button class="go sub" id="fadd">＋ 關聯</button></div>
   <div class="row"><button class="go" id="fsave">存</button></div>
   ${dl('tops', topNames())}<datalist id="subs"></datalist>${dl('allp', realPts().map(p => p.name))}`);
  const subs = () => pbody.querySelector('#subs').innerHTML = subNames(pbody.querySelector('#ft').value.trim()).map(n => `<option value="${esc(n)}">`).join('');
  pbody.querySelector('#ft').oninput = subs; subs();
  const addRow = () => pbody.querySelector('#frel').insertAdjacentHTML('beforeend', `<div class="lr">${typeSel('有關', 'class="rt"')}<input type="text" class="rp" list="allp" placeholder="知識點"><input type="text" class="rn" placeholder="說明"></div>`);
  pbody.querySelector('#fadd').onclick = addRow; addRow();
  pbody.querySelector('#fsave').onclick = async () => {
    const g = id => pbody.querySelector(id).value.trim(), name = g('#fn');
    if (!name) { toast('請填名稱'); return; }
    const rels = [...pbody.querySelectorAll('#frel .lr')].map(el => { const o = realPts().find(p => p.name === el.querySelector('.rp').value.trim()); return o && { id: o.id, name: o.name, type: el.querySelector('.rt').value, note: el.querySelector('.rn').value.trim() }; }).filter(Boolean);
    const kd = await root.getDirectoryHandle('02-知識', { create: true }); let dn = g('#fo');
    if (!dn) { dn = '我自己新增'; const dh = await kd.getDirectoryHandle(dn, { create: true }); if (!(await exists(dh, '原文.md'))) await writeFile(dh, '原文.md', fm({ 標題: '我自己新增', 日期: today(), 類型: '自己新增', 私人: false }) + '\n'); }
    const dh = await kd.getDirectoryHandle(dn, { create: true }), id = 'k' + Date.now().toString(36);
    await writeFile(dh, await uniqueName(dh, safe(name), '.md'), pointMd({ id, name, top: g('#ft') || '未分類', sub: g('#fs') || '其他', desc: g('#fd'), why: '', quote: g('#fq'), rels, by: '自己新增', created: today() }));
    closePane(); await load(true); toast('已新增：' + name); if (byId[id]) openCard(byId[id], 'desc');
  };
};

// ---------- 卡片的「關聯」分頁：＋ 關聯 ----------
const _openCard = openCard;
window.openCard = openCard = function (p, tab = 'desc') {
  _openCard(p, tab);
  if (tab !== 'rel' || p.demo || !p._path || !root) return;
  const B = document.getElementById('cbody');
  B.insertAdjacentHTML('beforeend', `<div class="cadd"><input type="text" id="cp" list="callp" placeholder="＋ 關聯：輸入知識點">${typeSel('有關', 'id="ct"')}<input type="text" id="cn" placeholder="說明"><button id="cok">加</button>${dl('callp', realPts().filter(q => q.id !== p.id).map(q => q.name))}</div>`);
  B.querySelector('#cok').onclick = async () => {
    const o = realPts().find(q => q.name === B.querySelector('#cp').value.trim() && q.id !== p.id); if (!o) { toast('請從清單選一個知識點'); return; }
    const [dn, fn] = p._path.split('/'), dh = await (await root.getDirectoryHandle('02-知識')).getDirectoryHandle(dn);
    let t = await (await (await dh.getFileHandle(fn)).getFile()).text(); t = t.replace(/\s+$/, '');
    if (!/\n##\s*關聯\s*(\n|$)/.test(t)) t += '\n\n## 關聯';
    await writeFile(dh, fn, t + '\n' + relLine({ id: o.id, name: o.name, type: B.querySelector('#ct').value, note: B.querySelector('#cn').value.trim() }) + '\n');
    const id = p.id; await load(true); if (byId[id]) openCard(byId[id], 'rel'); toast('已加上關聯');
  };
};

// 打開時：如果之前連過、瀏覽器也記得允許，就自動讀資料夾
setFolderBtn(); connect(false);
})();
