#!/usr/bin/env bash
set -euo pipefail

cd /mnt/d/NUS_Bachelor/Study/Y2S2/VIZA-monorepo/travel-agent/travel-agent-chatbot

source ~/.nvm/nvm.sh
nvm use 20 >/dev/null
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@10.32.1 --activate >/dev/null 2>&1 || true

pkill -f "next dev --webpack" || true
pkill -f "next dev --turbo" || true
rm -rf .next

nohup pnpm dev >/tmp/travel-frontend.log 2>&1 &
sleep 8

echo "FRONTEND_STARTED"
echo "LOG_PATH=/tmp/travel-frontend.log"
