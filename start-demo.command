#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"

DEMO_NODE="$(command -v node || true)"
if [ -z "$DEMO_NODE" ]; then
  for candidate in \
    "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" \
    "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node"; do
    if [ -x "$candidate" ]; then
      DEMO_NODE="$candidate"
      break
    fi
  done
fi
if [ -z "$DEMO_NODE" ]; then
  echo "Для запуска нужен Node.js 22.22.2+ (ветка 22) или 24.15+ (ветка 24)."
  read -r -p "Нажмите Enter для выхода. "
  exit 1
fi
"$DEMO_NODE" server/scripts/demo.js
