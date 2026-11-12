// 在 Windows 版裡跑一次：貼 AI 回答 → 存進知識網 → 改名 → 刪掉 → 從回收桶救回 → 匯出備份內容
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 50 && !(window.KN && KN.root); i++) await wait(200);
  document.getElementById('addBtn').click(); await wait(500);
  const X = document.querySelector('#dtext');
  X.value = '{"知識點":[{"名稱":"電腦版測試","主題":"測試","子主題":"Windows","說明":"說明","理由":"理由","原文":"原文"}],"關聯":[]}';
  X.dispatchEvent(new Event('input')); await wait(200);
  document.querySelector('#next').click(); await wait(500);
  [...document.querySelectorAll('#pbody button')].find(b => b.textContent === '放進知識網').click(); await wait(1500);
  const files = KNVFS.list();
  const p = K.points[0], [dn, fn] = p._path.split('/');
  const dh = await (await KNVFS.root.getDirectoryHandle('02-知識')).getDirectoryHandle(dn);
  await dh.removeEntry(fn); await wait(300);
  const afterDel = KNVFS.list().length;
  await knSyncPane(); document.querySelector('[data-tr]').click(); await wait(800);
  return { app: window.KNAPP, files, afterDel, afterRestore: KNVFS.list().length, points: K.points.map(p => p.name), syncOn: !!document.getElementById('syncDot') };
})()
