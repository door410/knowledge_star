// 由 tests/health-import.cjs 啟動，在 Windows 版裡按「匯入舊的知識網資料夾」，檢查被蓋掉的現有檔有沒有進回收桶（M3）
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 50 && !(window.KN && KN.root && window.knSyncPane); i++) await wait(200);
  const V = KNVFS, out = {}, k = 'M3 匯入舊的知識網資料夾：被蓋掉的現有檔要進回收桶';
  window.confirm = () => true;
  try {
    await V.ready;
    await V.put('03-我的/同名.md', '現在的版本');
    await knSyncPane();
    const b = KN.pbody.querySelector('#bold'); if (!b) { out[k] = '測試本身出錯：沒有匯入按鈕（不是 Windows 版？）'; return out; }
    b.click();
    for (let i = 0; i < 50 && V.get('03-我的/同名.md') !== '舊資料夾的版本'; i++) await wait(200);
    if (V.get('03-我的/同名.md') !== '舊資料夾的版本') out[k] = '測試本身出錯：沒有匯入';
    else if (V.get('02-知識/2026-01-01 舊來源/舊點.md') == null) out[k] = '測試本身出錯：02-知識 沒有匯入';
    else out[k] = V.trash().some(t => t.path === '03-我的/同名.md' && t.text === '現在的版本') ? 'ok' : '現在的版本被蓋掉，回收桶裡沒有';
  } catch (e) { out[k] = '測試本身出錯：' + e.message; }
  return out;
})()
