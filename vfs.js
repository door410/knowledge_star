// ===== App 版的「知識網資料」（06 第 40 輪）=====
// 資料存在這台裝置裡：Windows＝文件\知識網資料（一樣是 Markdown，Obsidian 也打得開）；Android＝App 私有空間。
// 對外提供和瀏覽器「資料夾」一樣的介面（getDirectoryHandle、getFileHandle、entries…），其他程式不用改。
// 每次寫入／刪除會通知同步（sync.js）；刪除的檔案先放進回收桶（.回收桶，保留 60 天）。
(() => {
const N = window.knNative;                                                     // Windows（electron/preload.cjs）
const CAP = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());   // Android
const DEV = /[?&]vfs=1/.test(location.search);                                 // 開發預覽：瀏覽器裡模擬 App
if (!N && !CAP && !DEV) return;

// ---------- 存到哪裡（driver：list／write／remove）----------
function capDriver() {
  const F = Capacitor.Plugins.Filesystem, D = 'DATA', BASE = '知識網資料';
  const full = p => BASE + '/' + p;
  async function walk(dir, out) {
    let r; try { r = await F.readdir({ path: dir ? full(dir) : BASE, directory: D }); } catch (e) { return; }
    for (const f of r.files) { const p = dir ? dir + '/' + f.name : f.name; if (f.type === 'directory') await walk(p, out); else out.push({ p, mtime: +f.mtime || Date.now() }); }
  }
  return {
    async list() {
      const L = [], res = []; await walk('', L);
      for (let i = 0; i < L.length; i += 32) res.push(...await Promise.all(L.slice(i, i + 32).map(async x => ({ path: x.p, mtime: x.mtime, text: (await F.readFile({ path: full(x.p), directory: D, encoding: 'utf8' })).data }))));
      return res;
    },
    write: (p, t) => F.writeFile({ path: full(p), directory: D, data: t, encoding: 'utf8', recursive: true }),
    remove: p => F.deleteFile({ path: full(p), directory: D }).catch(() => {}),
  };
}
function idbDriver() {
  const db = new Promise((res, rej) => { const o = indexedDB.open('kn-vfs', 1); o.onupgradeneeded = () => o.result.createObjectStore('f'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
  const tx = (mode, fn) => db.then(d => new Promise((res, rej) => { const t = d.transaction('f', mode), r = fn(t.objectStore('f')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
  return {
    async list() { const keys = await tx('readonly', s => s.getAllKeys()), vals = await tx('readonly', s => s.getAll()); return keys.map((k, i) => ({ path: k, ...vals[i] })); },
    write: (p, t) => tx('readwrite', s => s.put({ text: t, mtime: Date.now() }, p)),
    remove: p => tx('readwrite', s => s.delete(p)),
  };
}
const driver = N ? { list: () => N.vfs.list(), write: (p, t) => N.vfs.write(p, t), remove: p => N.vfs.remove(p) } : CAP ? capDriver() : idbDriver();
window.KNAPP = N ? 'win' : CAP ? 'android' : 'dev';
document.documentElement.classList.add('app', 'app-' + window.KNAPP);

// ---------- 記憶體裡的檔案表（讀取都從這裡，很快；寫入同時存到裝置）----------
const files = new Map(), dirs = new Set(), hooks = [];
const err = (name, m) => { const e = new Error(m); e.name = name; return e; };
const join = (a, b) => a ? a + '/' + b : b;
const hidden = p => p.split('/').some(s => s.startsWith('.'));
const dirExists = p => !p || dirs.has(p) || [...files.keys()].some(k => k.startsWith(p + '/'));
let chain = Promise.resolve();
const serial = fn => (chain = chain.then(fn, fn));   // 寫入一個接一個，不會互相蓋掉
const TRASH = '.回收桶/';

async function put(p, text, remote) {
  const old = files.get(p);
  if (old && old.text === text) return;
  await serial(() => driver.write(p, text));
  files.set(p, { text, mtime: Date.now() });
  if (!hidden(p)) hooks.forEach(f => f('put', p, text, remote, old ? old.text : null));
}
async function del(p, remote) {
  const old = files.get(p); if (!old) return;
  if (!hidden(p)) { const t = Date.now(); await putRaw(TRASH + t.toString(36) + Math.random().toString(36).slice(2, 6) + '.json', JSON.stringify({ path: p, text: old.text, at: t, remote: !!remote })); }
  await serial(() => driver.remove(p));
  files.delete(p);
  if (!hidden(p)) hooks.forEach(f => f('del', p, null, remote, old.text));
}
async function putRaw(p, text) { await serial(() => driver.write(p, text)); files.set(p, { text, mtime: Date.now() }); }
async function delRaw(p) { await serial(() => driver.remove(p)); files.delete(p); }

class FileH {
  constructor(p) { this.kind = 'file'; this.path = p; this.name = p.split('/').pop(); }
  async getFile() {
    const f = files.get(this.path); if (!f) throw err('NotFoundError', this.name);
    return { name: this.name, lastModified: f.mtime, size: f.text.length, type: '', text: async () => f.text, arrayBuffer: async () => new TextEncoder().encode(f.text).buffer };
  }
  async createWritable() {
    const parts = [], p = this.path;
    return {
      async write(d) {
        if (d && d.type === 'write') d = d.data;
        if (typeof d === 'string') parts.push(d);
        else if (d instanceof Blob) parts.push(await d.text());
        else if (d) parts.push(new TextDecoder().decode(d));
      },
      close: () => put(p, parts.join('')), abort: async () => {},
    };
  }
  async isSameEntry(o) { return !!o && o.path === this.path && o.kind === 'file'; }
  async queryPermission() { return 'granted'; } async requestPermission() { return 'granted'; }
}
class DirH {
  constructor(p) { this.kind = 'directory'; this.path = p; this.name = p ? p.split('/').pop() : '知識網資料'; }
  async getDirectoryHandle(n, o = {}) {
    const p = join(this.path, n);
    if (files.has(p)) throw err('TypeMismatchError', n);
    if (!dirExists(p)) { if (!o.create) throw err('NotFoundError', n); dirs.add(p); }
    return new DirH(p);
  }
  async getFileHandle(n, o = {}) {
    const p = join(this.path, n);
    if (!files.has(p)) { if (dirExists(p) && p) throw err('TypeMismatchError', n); if (!o.create) throw err('NotFoundError', n); }
    return new FileH(p);   // create：等第一次寫入才真的建立
  }
  async removeEntry(n, o = {}) {
    const p = join(this.path, n);
    if (files.has(p)) return del(p);
    const sub = [...files.keys()].filter(k => k.startsWith(p + '/'));
    if (!sub.length && !dirs.has(p)) throw err('NotFoundError', n);
    if (sub.length && !o.recursive) throw err('InvalidModificationError', n + ' 不是空的');
    for (const k of sub) await del(k);
    [...dirs].forEach(d => { if (d === p || d.startsWith(p + '/')) dirs.delete(d); });
  }
  async *entries() {
    const pre = this.path ? this.path + '/' : '', seen = new Set();
    for (const k of [...files.keys(), ...dirs]) {
      if (!k.startsWith(pre)) continue;
      const rest = k.slice(pre.length); if (!rest || rest.startsWith('.')) continue;
      const i = rest.indexOf('/'), n = i < 0 ? rest : rest.slice(0, i);
      if (seen.has(n)) continue; seen.add(n);
      yield [n, i < 0 && files.has(k) ? new FileH(pre + n) : new DirH(pre + n)];
    }
  }
  async *keys() { for await (const [n] of this.entries()) yield n; }
  async *values() { for await (const [, x] of this.entries()) yield x; }
  [Symbol.asyncIterator]() { return this.entries(); }
  async resolve(x) { if (!x) return null; if (x.path === this.path) return []; const pre = this.path ? this.path + '/' : ''; return x.path.startsWith(pre) ? x.path.slice(pre.length).split('/') : null; }
  async isSameEntry(o) { return !!o && o.path === this.path && o.kind === 'directory'; }
  async queryPermission() { return 'granted'; } async requestPermission() { return 'granted'; }
}

// ---------- 開始：把裝置裡的檔案全部讀進來 ----------
async function loadAll() {
  const L = await driver.list(); files.clear();
  L.forEach(f => { if (!/\.tmp$/.test(f.path)) files.set(f.path, { text: f.text, mtime: f.mtime || Date.now() }); });
  // 回收桶只留 60 天
  const old = Date.now() - 60 * 864e5;
  for (const k of [...files.keys()]) if (k.startsWith(TRASH)) { try { if (JSON.parse(files.get(k).text).at < old) await delRaw(k); } catch (e) {} }
}
const ready = loadAll();

// Windows：在別的程式（例如 Obsidian）改了資料夾，回到知識網時讀進來
async function rescan() {
  const L = await driver.list(), now = new Map(L.map(f => [f.path, f])), changed = [];
  for (const [p, f] of now) { if (hidden(p) || /\.tmp$/.test(p)) continue; const o = files.get(p); if (!o || o.text !== f.text) { files.set(p, { text: f.text, mtime: f.mtime || Date.now() }); changed.push(p); hooks.forEach(h => h('put', p, f.text, null, o ? o.text : null)); } }
  for (const p of [...files.keys()]) if (!hidden(p) && !now.has(p)) { const o = files.get(p); files.delete(p); changed.push(p); hooks.forEach(h => h('del', p, null, null, o.text)); }
  return changed;
}

window.KNVFS = {
  root: new DirH(''), ready, put, del, rescan,
  onChange: f => hooks.push(f),
  list: () => [...files.keys()].filter(p => !hidden(p)),
  get: p => (files.get(p) || {}).text,
  raw: { get: p => (files.get(p) || {}).text, put: putRaw, del: delRaw, list: pre => [...files.keys()].filter(k => k.startsWith(pre)) },
  trash: () => [...files.keys()].filter(k => k.startsWith(TRASH)).map(k => { try { return { key: k, ...JSON.parse(files.get(k).text) }; } catch (e) { return null; } }).filter(Boolean).sort((a, b) => b.at - a.at),
  native: N || null,
};
})();
