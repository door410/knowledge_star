// 體檢 11/21：別台（雲端 .knsync）送來的檔案路徑，不能跑出資料夾、不能蓋掉 .sync／.回收桶 這些隱藏檔
// 執行：node tests/health-paths.test.cjs
const assert = require('node:assert'), C = require('../sync-core.js');
const clk = C.clock('me', { ms: 0, c: 0 });
const bad = ['../逃出去.md', '02-知識/../../逃出去.md', '.sync/meta.json', '.回收桶/x.json', '/絕對.md', 'C:/x.md', '02-知識/a\\..\\..\\x.md', '02-知識//空.md', ''];
const remote = {};
for (const p of bad) remote[p] = { v: '00000000a.000.other', vv: { other: 1 }, k: 'x', t: '壞' };
remote['02-知識/正常.md'] = { v: '00000000a.000.other', vv: { other: 1 }, k: 'y', t: '好' };
const { acts, next } = C.merge({}, () => undefined, remote, clk, 'me');
const paths = acts.map(a => a.path);
assert.deepStrictEqual(paths, ['02-知識/正常.md'], '只應該寫入正常的路徑，實際會寫入：' + JSON.stringify(paths));
assert.deepStrictEqual(Object.keys(next), ['02-知識/正常.md']);
console.log('✓ 別台送來的危險路徑會被略過（正常路徑照常同步）');
