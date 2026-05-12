#!/usr/bin/env bash
set -euo pipefail

cd /mnt/d/NUS_Bachelor/Study/Y2S2/VIZA-monorepo/travel-agent/travel-agent-chatbot

source ~/.nvm/nvm.sh
nvm use 20 >/dev/null

echo "node: $(node -v)"
echo "pnpm: $(pnpm -v)"

node - <<'JS'
const { createRequire } = require('node:module');

function check(name) {
  try {
    require(name);
    console.log(`OK ${name}`);
  } catch (error) {
    console.log(`FAIL ${name}`);
    console.log(String(error && error.message ? error.message : error));
  }
}

check('@tailwindcss/oxide-linux-x64-gnu');
check('@tailwindcss/oxide');
check('lightningcss-linux-x64-gnu');
check('lightningcss');

try {
  const oxideRequire = createRequire(
    '/mnt/d/NUS_Bachelor/Study/Y2S2/VIZA-monorepo/travel-agent/travel-agent-chatbot/node_modules/.pnpm/@tailwindcss+oxide@4.2.4/node_modules/@tailwindcss/oxide/index.js'
  );
  const resolved = oxideRequire.resolve('@tailwindcss/oxide-linux-x64-gnu');
  console.log(`RESOLVE_OK ${resolved}`);
} catch (error) {
  console.log('RESOLVE_FAIL @tailwindcss/oxide-linux-x64-gnu from oxide context');
  console.log(String(error && error.message ? error.message : error));
}
JS
