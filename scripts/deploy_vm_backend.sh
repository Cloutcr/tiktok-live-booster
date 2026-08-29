#!/usr/bin/env bash
# Deploy TikTok Live Booster Backend to Hetzner VM (195.201.128.72) on Port 3005
set -e

VM_IP="195.201.128.72"
SSH_KEY="$HOME/.ssh/fgos_hetzner"
REMOTE_PATH="/opt/tiktok-live-booster"

echo "=== [1/4] Packaging TikTok Booster Backend ==="
tar -czf /tmp/tiktok_backend.tar.gz -C backend package.json server.js ecosystem.config.js

echo "=== [2/4] Uploading to Hetzner VM ($VM_IP) ==="
ssh -i "$SSH_KEY" root@"$VM_IP" "mkdir -p $REMOTE_PATH/backend"
scp -i "$SSH_KEY" /tmp/tiktok_backend.tar.gz root@"$VM_IP":$REMOTE_PATH/
scp -i "$SSH_KEY" .env service_account.json root@"$VM_IP":$REMOTE_PATH/

echo "=== [3/4] Extracting & Installing Dependencies on VM ==="
ssh -i "$SSH_KEY" root@"$VM_IP" "
  cd $REMOTE_PATH/backend && \
  tar -xzf $REMOTE_PATH/tiktok_backend.tar.gz -C $REMOTE_PATH/backend && \
  npm install --production && \
  pm2 startOrReload ecosystem.config.js --only tiktok-booster-api && \
  pm2 save
"

echo "=== [4/4] Verifying Process & Port 3005 ==="
ssh -i "$SSH_KEY" root@"$VM_IP" "
  pm2 list | grep tiktok-booster-api
  ss -tlnp | grep ':3005'
  curl -s http://localhost:3005/api/health
"

echo -e "\n[SUCCESS] TikTok Booster Backend is LIVE on Hetzner VM (Port 3005)!"
