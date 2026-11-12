#!/usr/bin/env bash
# Windows 安裝檔：Google 連線設定從 Secrets 產生（不放進公開的程式碼）
source "$(dirname "$0")/lib.sh"
if [ -z "${GOOGLE_DESKTOP_ID:-}" ] || [ -z "${GOOGLE_DESKTOP_SECRET:-}" ]; then
  echo "### ❌ 尚未設定 Secrets GOOGLE_DESKTOP_ID／GOOGLE_DESKTOP_SECRET，電腦版會不能同步" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 1
fi
printf 'module.exports = { clientId: %s, clientSecret: %s };\n' "\"$GOOGLE_DESKTOP_ID\"" "\"$GOOGLE_DESKTOP_SECRET\"" > electron/google-client.cjs
step_retry "安裝套件" npm ci
step_retry "下載 Electron 執行檔" node node_modules/electron/install.js
step "確認 Electron 執行檔" test -f node_modules/electron/dist/electron.exe
step "Windows 測試" npm test
step "建置畫面" npm run build
export DEBUG="electron-builder,@electron/get*"
RETRIES=2 step_retry "打包安裝檔" npx electron-builder --win --publish never "-c.extraMetadata.version=${APP_VERSION_NAME:-0.1.0}"
cp release/knowledge-star-setup.exe out/
rm -f electron/google-client.cjs
