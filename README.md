# 知識網

個人知識工具：把文章、AI 回答拆成知識點，長成一張看得見關聯的圖。手動為主，免費 AI（Gemini）只是加速鍵。

## 安裝（手機和電腦）
到 **[下載頁](https://github.com/door410/knowledge_star/releases/latest)**：
- 手機（Android）：下載 `knowledge-star.apk` → 打開安裝（第一次會問「允許安裝不明來源的應用程式」，按允許）
- 電腦（Windows）：下載 `knowledge-star-setup.exe` → 雙擊安裝 → 桌面出現「知識網」
- 舊的知識網資料：電腦版「設定 → 同步與備份 → 匯入舊的知識網資料夾」，選舊的「知識網資料」資料夾
- 同步：每台都在「設定 → 同步與備份 → 連接 Google 雲端硬碟」，登入同一個帳號

## 資料放在哪、怎麼保護
| | 位置 |
|---|---|
| 電腦 | 文件\知識網資料（Markdown，Obsidian 打得開） |
| 手機 | App 自己的空間（解除安裝會刪掉，但雲端和備份都有） |
| 雲端 | Google 雲端硬碟「知識網同步（請勿手動修改）」：每台裝置一個檔，每個檔都是完整的一份 |
| 備份 | 每週自動一次（留 8 份）：電腦＝文件\知識網備份；手機＝Documents／知識網備份。.zip 裡就是 Markdown 資料夾 |

- 兩台同時改同一個點：兩版都留（另一版在「同步與備份」裡，可以改用）
- 一台刪、另一台改：留改過的
- 刪掉的東西：「整理 → 紀錄與復原」、「同步與備份 → 回收桶」（留 60 天）

## 給接手的 Claude
- 結構：`知識網.html`＋各功能 js（原本的網頁版，直接用瀏覽器開也能用）；App 多了 `vfs.js`（資料存在裝置、介面和瀏覽器資料夾一樣）、`sync-core.js`（合併規則，`npm test` 測）、`sync.js`（雲端硬碟同步、備份、回收桶、畫面）、`zip.js`
- Android：Capacitor（`android/`、原生程式在 `native/android/`）；Windows：Electron（`electron/`）
- 推到 `main` → GitHub Actions 測試、建置、發佈到 Releases（步驟在 `scripts/ci/`）
- Secrets：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`（簽章檔正本在 Door 雲端硬碟「知識工具／App簽章（不可刪）」）、`GOOGLE_DESKTOP_ID`、`GOOGLE_DESKTOP_SECRET`
- 預覽：`python -m http.server` 後開 `知識網.html?vfs=1`（模擬 App，不能同步）
- 決定紀錄：Door 雲端硬碟「知識工具／06 問答紀錄.md」第 40 輪起

## 做到哪
- [x] 刪掉示範點、評估成績表
- [x] App 存檔層、雲端同步、備份還原、回收桶、匯入舊資料夾
- [x] 手機版面、返回鍵、編輯表單
- [x] 自動建置 APK＋Windows 安裝檔
- [ ] Door 實機試用（手機安裝、電腦安裝、兩台同步）
- [ ] MCP 改讀「文件\知識網資料」（電腦版 App 的資料位置）
