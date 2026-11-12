// 備份檔測試：中文檔名、空檔、大檔都能存回原樣
const assert = require('node:assert'), Z = require('../zip.js');
(async () => {
  const files = [{ path: '知識網資料/02-知識/2026-11-13 測試/原文.md', text: '---\n標題: 測試\n---\n中文內容 ✓ 😀' }, { path: '知識網資料/00-收件匣/空.md', text: '' }, { path: '知識網資料/03-我的/大.md', text: '長'.repeat(300000) }];
  const back = await Z.unzip(Z.zip(files));
  assert.deepStrictEqual(back, files);
  console.log('備份檔測試通過');
})().catch(e => { console.error(e); process.exit(1); });
