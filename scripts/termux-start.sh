#!/usr/bin/env bash
# ==============================================================================
# KAIZEN Trader — One-Command Termux Local Engine & Embedded DB Launcher
# Usage inside Termux on Android:
#   cd ~/Kaizen-trader-
#   bash scripts/termux-start.sh
# ==============================================================================

set -e

echo "========================================================"
echo "  改 KAIZEN TRADER — TERMUX LOCAL ENGINE & APP RUNNER"
echo "========================================================"

# 1. Verify Node.js is installed in Termux
if ! command -v node >/dev/null 2>&1; then
  echo "[KAIZEN] Node.js not found. Installing nodejs-lts in Termux..."
  pkg update -y && pkg install -y nodejs-lts git
fi

echo "[KAIZEN] Node version: $(node -v)"

# 2. Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "[KAIZEN] Installing dependencies (first-time setup)..."
  npm install --no-audit --no-fund
fi

# 3. Ensure .env exists with a default local MONGODB_URI so login/sessions work out of the box
if [ ! -f ".env" ]; then
  echo "[KAIZEN] Creating default .env file for Termux local testing..."
  cat << 'EOF' > .env
PORT=3000
NODE_ENV=development
SESSION_SECRET=kaizen-termux-local-secret-2026
MONGODB_URI=mongodb://127.0.0.1:27017/kaizen
EOF
fi

# Load .env variables
export $(grep -v '^#' .env | xargs 2>/dev/null || true)
export PORT=${PORT:-3000}
export MONGODB_URI=${MONGODB_URI:-mongodb://127.0.0.1:27017/kaizen}

# 4. If MONGODB_URI points to 127.0.0.1 / localhost, launch the embedded Termux DB automatically
if echo "$MONGODB_URI" | grep -Eq "127\.0\.0\.1|localhost"; then
  echo "[KAIZEN] Starting embedded Termux database engine (127.0.0.1:27017)..."
  node scripts/termux-mongo-lite.js &
  MONGO_LITE_PID=$!
  trap "kill $MONGO_LITE_PID 2>/dev/null || true" EXIT
  sleep 1
fi

echo ""
echo "--------------------------------------------------------"
echo "  KAIZEN is LIVE on your phone!"
echo "  -> Open in phone browser:  http://localhost:${PORT}"
echo "  -> Pre-loaded Test Login:  dennis@kaizen.test"
echo "  -> Pre-loaded Password:    kaizen123"
echo "     (Includes 10 logged sessions on AUDJPY, Japan 225, EURUSD, XAUUSD"
echo "      so your Official Trader Certificate & PDF Dossier is unlocked!)"
echo "  -> Press Ctrl + C anytime to stop the server."
echo "--------------------------------------------------------"
echo ""

exec node server.js
