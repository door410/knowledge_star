// 由 tests/health-browser.cjs 啟動，在網頁預覽版裡檢查 M2、M3、S5；每項回傳 'ok' 或失敗原因
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 50 && !(window.KN && KN.root && window.knSyncPane); i++) await wait(200);
  const V = KNVFS, out = {}, bad = '<img src=x onerror="window.__xss=1">';
  window.confirm = () => true;
  const run = async (k, fn) => { window.__xss = 0; try { out[k] = await fn(); } catch (e) { out[k] = '測試本身出錯：' + e.message; } try { KN.closePane(); } catch (e) {} await wait(300); };

  await run('M2 收件匣的日期不能變成網頁元素', async () => {
    await V.put('00-收件匣/測試.md', `---\n標題: 測試\n日期: ${bad}\n---\n內容\n`);
    document.getElementById('addBtn').click(); await wait(1500);
    if (!KN.pbody.querySelector('.ibl')) return '測試本身出錯：沒看到先存著的文章';
    return KN.pbody.querySelector('.ibl img') || window.__xss ? '日期裡的 HTML 被當成網頁元素' : 'ok';
  });

  await run('M2 時光機的名稱不能變成網頁元素', async () => {
    await V.put(`04-知識網/時光機/2026-01-01 ${bad}.json`, JSON.stringify({ sources: [], topics: [], points: [], links: [] }));
    knReview('tm'); await wait(1000);
    const b = [...KN.pbody.querySelectorAll('[data-d]')].find(x => x.dataset.d.includes('img'));
    if (!b) return '測試本身出錯：沒看到那一天';
    b.click(); await wait(1500);
    let bar = document.getElementById('tmBar'), hit = !!(bar && bar.querySelector('img'));
    if (bar) { bar.querySelector('#tmcmp').click(); await wait(1500); bar = document.getElementById('tmBar'); hit = hit || !!(bar && bar.querySelector('img')); }
    if (bar) bar.remove();
    return hit || window.__xss ? '名稱裡的 HTML 被當成網頁元素' : 'ok';
  });

  await run('M3 從備份還原：被蓋掉的現有檔要進回收桶', async () => {
    await V.put('03-我的/筆記.md', '新的（這週寫的）');
    const zipBytes = KNZip.zip([{ path: '知識網資料/03-我的/筆記.md', text: '舊的' }]);
    const realClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.type !== 'file') return realClick.call(this);
      const dt = new DataTransfer(); dt.items.add(new File([zipBytes], 'b.zip')); this.files = dt.files; this.onchange();
    };
    try { await knSyncPane(); KN.pbody.querySelector('#bimp').click(); await wait(1500); } finally { HTMLInputElement.prototype.click = realClick; }
    if (V.get('03-我的/筆記.md') !== '舊的') return '測試本身出錯：沒有還原';
    return V.trash().some(t => t.path === '03-我的/筆記.md' && t.text === '新的（這週寫的）') ? 'ok' : '現在的版本被蓋掉，回收桶裡沒有';
  });

  await run('M3 回收桶救回：原位置現在的版本要進回收桶', async () => {
    await V.put('03-我的/救回.md', '舊版'); await V.del('03-我的/救回.md'); await V.put('03-我的/救回.md', '現在的版本');
    await knSyncPane();
    const i = V.trash().slice(0, 40).findIndex(t => t.path === '03-我的/救回.md' && t.text === '舊版');
    const b = KN.pbody.querySelector(`[data-tr="${i}"]`); if (!b) return '測試本身出錯：回收桶裡沒看到';
    b.click(); await wait(1500);
    if (V.get('03-我的/救回.md') !== '舊版') return '測試本身出錯：沒有救回';
    return V.trash().some(t => t.path === '03-我的/救回.md' && t.text === '現在的版本') ? 'ok' : '現在的版本被蓋掉，回收桶裡沒有（確認框卻說會進回收桶）';
  });

  await run('S5 我的想法裡有 $ 符號要原樣存下', async () => {
    const fp = '02-知識/2026-01-01 測試來源/錢.md', v = "花了 $' 和 $& 元";
    await V.put(fp, '---\nid: s5test\n主題: 測試\n子主題: 其他\n---\n# 錢\n\n說明\n\n## 為什麼拆成這個點\n\n\n## 原文出處\n> 原文\n\n## 關聯\n');
    await KN.load(true); await wait(500);
    const p = byId['s5test']; if (!p) return '測試本身出錯：找不到知識點';
    openCard(p, 'mine'); await wait(800);
    const ta = document.querySelector('textarea.mine'); if (!ta) return '測試本身出錯：沒看到我的想法';
    ta.value = v; document.querySelector('#mok').click(); await wait(1500);
    const t = V.get(fp);
    return t.includes('\n## 我的想法\n' + v + '\n') && t.split('## 關聯').length === 2 ? 'ok' : '存下來的內容不對：' + JSON.stringify(t.slice(t.indexOf('## 原文出處')));
  });

  return out;
})()
