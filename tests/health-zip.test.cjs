// 體檢 11/21：備份檔超過 zip 格式上限（65,535 個檔）時，不能默默少檔，要明確報錯
// 執行：node tests/health-zip.test.cjs
const assert = require('node:assert'), Z = require('../zip.js');
(async () => {
  const files = Array.from({ length: 70000 }, (_, i) => ({ path: `知識網資料/02-知識/${i}.md`, text: '' }));
  let bytes;
  try { bytes = Z.zip(files); } catch (e) { console.log('✓ 超過 zip 上限時明確報錯：' + e.message); return; }
  const back = await Z.unzip(bytes);
  assert.strictEqual(back.length, files.length, `備份默默少了 ${files.length - back.length} 個檔（共 ${files.length} 個，只讀回 ${back.length} 個）`);
  console.log('✓ 70000 個檔完整讀回');
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
