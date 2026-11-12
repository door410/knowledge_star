// 給畫面用的 Windows 功能（只開放需要的；資料檔、備份、Google 登入與雲端硬碟連線）
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('knNative', {
  platform: 'win',
  vfs: { list: () => call('vfs:list'), write: (p, t) => call('vfs:write', p, t), remove: p => call('vfs:remove', p) },
  io: { saveAs: (n, b) => call('io:saveAs', n, b), autoBackup: (n, b) => call('io:autoBackup', n, b), importFolder: () => call('io:importFolder'), openDataDir: () => call('io:openDataDir') },
  google: { configured: () => call('google:configured'), signIn: () => call('google:signIn'), token: f => call('google:token', f), signOut: () => call('google:signOut'), request: r => call('google:request', r) },
});
