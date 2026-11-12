// ===== 同步的規則（不碰網路、不碰檔案，可以單獨測試：tests/sync.test.cjs）=====
// 每個檔案都有「版本」：vv＝每台裝置改過幾次（版本向量，用來判斷誰是誰的延續）；v＝最後一次修改的時間戳（混合邏輯時鐘，跨裝置也能比先後）；k＝內容指紋；del＝已刪除。
// 合併規則（照 love-record）：
//   一邊是另一邊的延續 → 用新的；
//   兩台同時改、內容一樣 → 視為同一版；
//   一邊刪、一邊改 → 留改過的（刪除保護）；
//   兩台同時改、內容不同 → 時間新的留在原處，另一版存到 05-衝突／，兩版都不會丟。
(function (root) {
const hash = s => { let a = 0x811c9dc5, b = 0x01000193 ^ s.length; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); } return (a >>> 0).toString(36) + (b >>> 0).toString(36) + s.length.toString(36); };
const vMs = v => parseInt(String(v).split('.')[0], 36) || 0;
function clock(dev, state) {   // state：{ ms, c }，存在本機
  return {
    next() { const now = Date.now(); if (now > state.ms) { state.ms = now; state.c = 0; } else state.c++; return state.ms.toString(36).padStart(9, '0') + '.' + state.c.toString(36).padStart(3, '0') + '.' + dev; },
    see(v) { const m = vMs(v); if (m > state.ms) { state.ms = m; state.c = 0; } },
  };
}
const vvMax = (a = {}, b = {}) => { const o = { ...a }; for (const k in b) o[k] = Math.max(o[k] || 0, b[k]); return o; };
function cmp(a = {}, b = {}) {   // 'eq'｜'gt'（a 是 b 的延續）｜'lt'｜'cc'（同時改）
  let gt = false, lt = false;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[k] || 0, y = b[k] || 0; if (x > y) gt = true; if (x < y) lt = true; }
  return gt && lt ? 'cc' : gt ? 'gt' : lt ? 'lt' : 'eq';
}
function decide(L, R) {
  if (!R) return 'keep';
  if (!L) return 'take';
  const c = cmp(L.vv, R.vv);
  if (c === 'eq' || c === 'gt') return 'keep';
  if (c === 'lt') return 'take';
  if (!!L.del === !!R.del && (L.del || L.k === R.k)) return 'same';
  if (L.del) return 'take';        // 這台刪了、另一台改了 → 留改過的
  if (R.del) return 'keepNew';     // 另一台刪了、這台改了 → 留這台的
  return R.v > L.v ? 'takeConflict' : 'keepConflict';
}
const conflictPath = (p, loserV) => {
  const name = p.split('/').pop().replace(/\.(md|json|txt)$/i, ''), ext = (p.match(/\.(md|json|txt)$/i) || ['.md'])[0];
  const d = new Date(vMs(loserV)), z = n => String(n).padStart(2, '0');
  return `05-衝突/${name}（另一個版本 ${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}.${z(d.getMinutes())} ${String(loserV).slice(-4)}）${ext}`;
};
/**
 * 把另一台的狀態合併進來。
 * local：{ path: {v,vv,k,del} }（本機版本表）；text(path)：本機內容；remote：{ path: {v,vv,k,del,t} }；dev：這台的代號
 * 回傳要做的事：[{ op:'write'|'delete'|'conflict', path, text, ver }]，以及新的版本表 next（只列有變的）
 */
function merge(local, text, remote, clk, dev) {
  const acts = [], next = {};
  for (const p of Object.keys(remote)) {
    const L = local[p], R = remote[p]; clk.see(R.v);
    const d = decide(L, R), meta = x => ({ v: x.v, vv: { ...(x.vv || {}) }, k: x.k, ...(x.del ? { del: 1 } : {}) });
    if (d === 'keep') continue;
    if (d === 'take') { next[p] = meta(R); acts.push(R.del ? { op: 'delete', path: p } : { op: 'write', path: p, text: R.t }); continue; }
    const vv = vvMax(L.vv, R.vv);
    if (d === 'same') { next[p] = { ...meta(L.v > R.v ? L : R), vv }; continue; }
    if (d === 'keepNew') { vv[dev] = (vv[dev] || 0) + 1; next[p] = { ...meta(L), v: clk.next(), vv }; continue; }
    const win = d === 'takeConflict' ? R : L, lose = win === R ? L : R;
    acts.push({ op: 'conflict', path: conflictPath(p, lose.v), text: lose === L ? text(p) : lose.t, from: p });
    if (win === R) acts.push({ op: 'write', path: p, text: R.t });
    next[p] = { ...meta(win), vv };
  }
  return { acts, next };
}
// 這台自己改了一個檔：新的版本
const bump = (L, dev, clk, k, del) => { const vv = { ...((L && L.vv) || {}) }; vv[dev] = (vv[dev] || 0) + 1; return { v: clk.next(), vv, k, ...(del ? { del: 1 } : {}) }; };
const core = { hash, clock, cmp, decide, merge, bump, conflictPath, vMs };
if (typeof module !== 'undefined' && module.exports) module.exports = core; else root.KNSyncCore = core;
})(this);
