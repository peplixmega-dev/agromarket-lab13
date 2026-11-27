#!/bin/bash
set -e
cd -- "$(dirname -- "$0")/client"
TEST_NODE="$(command -v node || true)"
if [ -z "$TEST_NODE" ]; then
  for candidate in \
    "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" \
    "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node"; do
    if [ -x "$candidate" ]; then TEST_NODE="$candidate"; break; fi
  done
fi
if [ -z "$TEST_NODE" ]; then
  echo "Нужен Node.js 22.22.2+ (ветка 22) или 24.15+ (ветка 24)."
  exit 1
fi
export PATH="$(dirname -- "$TEST_NODE"):$PATH"
"$TEST_NODE" ../server/scripts/test-local.js
"$TEST_NODE" node_modules/vitest/vitest.mjs run --coverage
"$TEST_NODE" node_modules/eslint/bin/eslint.js .
"$TEST_NODE" node_modules/@playwright/test/cli.js test
