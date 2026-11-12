#!/usr/bin/env bash
# 發佈到本倉庫的 Releases（公開，免登入下載）
source "$(dirname "$0")/lib.sh"
TAG="v${APP_VERSION_NAME}"
export GH_TOKEN="$GITHUB_TOKEN"
step "發佈 $TAG" gh release create "$TAG" out/knowledge-star.apk out/knowledge-star-setup.exe \
  --repo "$GITHUB_REPOSITORY" --title "知識網 ${APP_VERSION_NAME}" --notes "自動建置 #${GITHUB_RUN_NUMBER}" --latest
echo "下載頁：https://github.com/$GITHUB_REPOSITORY/releases/latest" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
