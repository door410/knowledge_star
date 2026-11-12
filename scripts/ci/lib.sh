# CI 共用：每個步驟的輸出存檔；失敗時把最後 40 行寫進建置摘要頁（方便快速查看錯誤）
set -uo pipefail
mkdir -p out
step() {
  local name="$1"; shift
  echo "::group::$name"
  local log; log="$(mktemp)"
  "$@" 2>&1 | tee "$log"
  local code=${PIPESTATUS[0]}
  echo "::endgroup::"
  if [ "$code" -ne 0 ]; then
    { echo "### ❌ $name 失敗"; echo '```'; grep -E '✗|rror|失敗|FAIL|Timeout|exceeded|https?://' "$log" | tail -n 15; echo '--- 最後 40 行 ---'; tail -n 40 "$log"; echo '```'; } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    echo "::error::$name 失敗"
    exit "$code"
  fi
  echo "✅ $name" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

# 需要下載的步驟：遇到網路暫時錯誤（如 504）自動重試（預設 3 次，可用 RETRIES 調整）
step_retry() {
  local name="$1"; shift
  local n max="${RETRIES:-3}"
  for n in $(seq 1 "$max"); do
    if ( step "$name（第 $n 次）" "$@" ); then return 0; fi
    [ "$n" -lt "$max" ] && { echo "等待 60 秒後重試…"; sleep 60; }
  done
  exit 1
}
