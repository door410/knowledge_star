// 體檢用的 Electron 主程式：開「網頁預覽版」（沒有 Windows 原生功能，資料存在瀏覽器自己的資料庫，和 Android 一樣檔名可以有 < >），
// 跑 tests/health-browser.js，把結果印成一行「KNTEST {...}」後結束。由 tests/health-browser.cjs 啟動，不碰真正的資料。
const { app, BrowserWindow } = require('electron'), path = require('path'), fs = require('fs');
app.setPath('userData', process.env.KN_TEST_DIR);
app.whenReady().then(() => {
  const w = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } });
  w.webContents.once('did-finish-load', async () => {
    try { console.log('KNTEST ' + JSON.stringify(await w.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'health-browser.js'), 'utf8')))); }
    catch (e) { console.log('KNTEST-FAIL ' + e.message); }
    app.exit(0);
  });
  w.loadFile(path.join(__dirname, '..', 'www', 'index.html'), { query: { vfs: '1' } });   // vfs=1：開發預覽，在瀏覽器裡模擬 App
});
