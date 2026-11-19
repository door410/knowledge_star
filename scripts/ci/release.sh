#!/usr/bin/env bash
# 發佈到本倉庫的 Releases（公開，免登入下載）：無 AI 版、AI 版各一組手機＋電腦安裝檔
source "$(dirname "$0")/lib.sh"
TAG="v${APP_VERSION_NAME}"
export GH_TOKEN="$GITHUB_TOKEN"
DL="https://github.com/$GITHUB_REPOSITORY/releases/latest/download"
NOTES="$(printf '%s\n' \
  "## 無 AI 版（推薦）" \
  "完全沒有 AI 功能：貼上文章，自己在原文上選字變成知識點。" \
  "- 手機：[knowledge-star-noai.apk]($DL/knowledge-star-noai.apk)" \
  "- 電腦：[knowledge-star-noai-setup.exe]($DL/knowledge-star-noai-setup.exe)" \
  "" \
  "## AI 版" \
  "可以把文章複製給 AI 拆，再把回答貼回來；有問答、導覽、圈選整理。" \
  "- 手機：[knowledge-star.apk]($DL/knowledge-star.apk)" \
  "- 電腦：[knowledge-star-setup.exe]($DL/knowledge-star-setup.exe)" \
  "" \
  "兩個版本的資料完全相通、一樣用 Google 雲端硬碟同步。同一台裝置只會有一個知識網：裝另一個版本會直接換過去，資料保留。" \
  "" \
  "自動建置 #${GITHUB_RUN_NUMBER}")"
step "發佈 $TAG" gh release create "$TAG" out/knowledge-star-noai.apk out/knowledge-star-noai-setup.exe out/knowledge-star.apk out/knowledge-star-setup.exe \
  --repo "$GITHUB_REPOSITORY" --title "知識網 ${APP_VERSION_NAME}" --notes "$NOTES" --latest
echo "下載頁：https://github.com/$GITHUB_REPOSITORY/releases/latest" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
