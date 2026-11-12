// 同步規則測試：模擬兩台裝置各自改、互相合併，最後兩台要一樣，而且不能丟資料
// 執行：node tests/sync.test.cjs
const assert = require('node:assert');
const C = require('../sync-core.js');

function device(id) {
  const st = { ms: 0, c: 0 }, clk = C.clock(id, st), files = {}, ver = {};
  return {
    id, files, ver,
    edit(p, t) { files[p] = t; ver[p] = C.bump(ver[p], id, clk, C.hash(t)); },
    remove(p) { delete files[p]; ver[p] = C.bump(ver[p], id, clk, '', true); },
    state() { const o = {}; for (const p in ver) o[p] = { ...ver[p], ...(ver[p].del ? {} : { t: files[p] }) }; return o; },
    pull(other) {
      const { acts, next } = C.merge(ver, p => files[p], other.state(), clk, id);
      for (const a of acts) {
        if (a.op === 'write') files[a.path] = a.text;
        if (a.op === 'delete') delete files[a.path];
        if (a.op === 'conflict') this.edit(a.path, a.text);
      }
      Object.assign(ver, next);
    },
  };
}
const sync = (a, b) => { for (let i = 0; i < 3; i++) { a.pull(b); b.pull(a); } };
const same = (a, b) => { assert.deepStrictEqual(a.files, b.files); for (const p in a.ver) { assert.strictEqual(a.ver[p].v, b.ver[p].v, p); assert.strictEqual(C.cmp(a.ver[p].vv, b.ver[p].vv), 'eq', p); } };
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };

t('新裝置取回全部資料', () => { const a = device('A'), b = device('B'); a.edit('x.md', '1'); a.edit('y.md', '2'); sync(a, b); same(a, b); assert.strictEqual(b.files['y.md'], '2'); });
t('一台改、另一台跟上', () => { const a = device('A'), b = device('B'); a.edit('x.md', '1'); sync(a, b); b.edit('x.md', '2'); b.edit('x.md', '3'); sync(a, b); same(a, b); assert.strictEqual(a.files['x.md'], '3'); });
t('兩台同時改成一樣的內容', () => { const a = device('A'), b = device('B'); a.edit('x.md', '1'); sync(a, b); a.edit('x.md', 'z'); b.edit('x.md', 'z'); sync(a, b); same(a, b); assert.ok(!Object.keys(a.files).some(p => p.startsWith('05-衝突/'))); });
t('兩台同時改不同內容 → 兩版都留', () => {
  const a = device('A'), b = device('B'); a.edit('02-知識/s/x.md', '原本'); sync(a, b);
  a.edit('02-知識/s/x.md', 'A 改的'); b.edit('02-知識/s/x.md', 'B 改的'); sync(a, b); same(a, b);
  const all = Object.values(a.files); assert.ok(all.includes('A 改的') && all.includes('B 改的'));
  assert.strictEqual(Object.keys(a.files).filter(p => p.startsWith('05-衝突/')).length, 1);
});
t('一台刪、另一台改 → 留改過的', () => { const a = device('A'), b = device('B'); a.edit('x.md', '1'); sync(a, b); a.remove('x.md'); b.edit('x.md', '重要的修改'); sync(a, b); same(a, b); assert.strictEqual(a.files['x.md'], '重要的修改'); });
t('另一台沒改過 → 刪除會同步', () => { const a = device('A'), b = device('B'); a.edit('x.md', '1'); sync(a, b); a.remove('x.md'); sync(a, b); same(a, b); assert.ok(!('x.md' in b.files)); });
t('三台輪流改、離線很久再合併', () => {
  const a = device('A'), b = device('B'), c = device('C');
  a.edit('x.md', '1'); sync(a, b); sync(b, c);
  for (let i = 0; i < 30; i++) c.edit('x.md', 'c' + i);   // C 離線改很多次
  b.edit('y.md', 'b'); sync(a, b); sync(b, c); sync(a, c); sync(a, b);
  same(a, b); same(b, c); assert.strictEqual(a.files['x.md'], 'c29'); assert.ok(!Object.keys(a.files).some(p => p.startsWith('05-衝突/')), '不該有假衝突'); assert.strictEqual(c.files['y.md'], 'b');
});
t('一台刪、另一台改，之後再刪 → 刪除會同步', () => { const a = device('A'), b = device('B'); a.edit('x.md', '1'); sync(a, b); a.remove('x.md'); b.edit('x.md', '2'); sync(a, b); b.remove('x.md'); sync(a, b); same(a, b); assert.ok(!('x.md' in a.files)); });
console.log(`同步規則測試全部通過（${n} 項）`);
