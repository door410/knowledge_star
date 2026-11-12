#!/usr/bin/env bash
# Android 安裝檔：需要 Secrets ANDROID_KEYSTORE_BASE64／ANDROID_KEYSTORE_PASSWORD
source "$(dirname "$0")/lib.sh"
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
if [ -z "${KS_B64:-}" ] || [ -z "${KS_PW:-}" ]; then
  echo "### ❌ 尚未設定 Android 簽章 Secrets，為避免日後無法更新，不產生未簽章安裝檔" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 1
fi
KS="${RUNNER_TEMP:-/tmp}/release.keystore"
echo "$KS_B64" | base64 -d > "$KS"
export ANDROID_KEYSTORE_FILE="$KS" ANDROID_KEYSTORE_PASSWORD="$KS_PW"
step_retry "安裝套件" npm ci
step "建置畫面" npm run build
step "同步 Android 專案" npx cap sync android
# 原生程式（Google 登入外掛、MainActivity）放在 native/android/，建置時複製到 Android 專案
step "加入原生程式" bash -c 'mkdir -p android/app/src/main/java/tw/door410/knowledgestar && cp native/android/*.java android/app/src/main/java/tw/door410/knowledgestar/'
chmod +x android/gradlew
step_retry "下載 Gradle" bash -c "cd android && ./gradlew --version --no-daemon"
NET="-Dorg.gradle.internal.http.socketTimeout=180000 -Dorg.gradle.internal.http.connectionTimeout=180000 -Dorg.gradle.internal.repository.max.retries=6 -Dorg.gradle.internal.repository.initial.backoff=2000"
step_retry "建置 APK" bash -c "cd android && ./gradlew assembleRelease --no-daemon $NET"
cp android/app/build/outputs/apk/release/app-release.apk out/knowledge-star.apk
rm -f "$KS"
