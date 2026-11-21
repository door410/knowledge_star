// 體檢用：開真正的 Windows 版主程式，但「選資料夾」視窗直接回答測試準備的資料夾（KN_IMPORT_DIR）。
// 資料都放在 KN_TEST_DIR（暫存資料夾），不碰真正的「文件＼知識網資料」。由 tests/health-import.cjs 啟動。
const { dialog } = require('electron');
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [process.env.KN_IMPORT_DIR] });
require('../electron/main.cjs');
