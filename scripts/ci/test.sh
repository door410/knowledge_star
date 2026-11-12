#!/usr/bin/env bash
# 自動測試：同步規則、備份檔、每個程式檔的語法
source "$(dirname "$0")/lib.sh"
step "同步規則與備份檔測試" npm test
step "語法檢查" bash -c 'for f in *.js electron/*.cjs; do node --check "$f" || exit 1; done'
