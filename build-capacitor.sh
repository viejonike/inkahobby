#!/bin/bash
# Build InkaHobby for Capacitor (Android APK)
# This script builds the static export for the Capacitor native app

set -e

echo "=== InkaHobby Capacitor Build ==="

# Step 1: Temporarily move API routes out of the app directory
echo "[1/5] Temporarily moving API routes..."
if [ -d "src/app/api" ]; then
  mv src/app/api src/app_api_backup
  echo "  API routes moved to src/app_api_backup"
fi

# Step 2: Build with export mode
echo "[2/5] Building static export..."
BUILD_MODE=capacitor npx next build

# Step 3: Restore API routes
echo "[3/5] Restoring API routes..."
if [ -d "src/app_api_backup" ]; then
  mv src/app_api_backup src/app/api
  echo "  API routes restored to src/app/api"
fi

# Step 4: Add Capacitor config to the output
echo "[4/5] Adding Capacitor files to output..."
if [ -d "out" ]; then
  # Copy public assets that Capacitor needs
  cp -r public/sw.js out/ 2>/dev/null || true
  cp -r public/manifest.json out/ 2>/dev/null || true
  echo "  Capacitor files added"
fi

# Step 5: Sync with Capacitor
echo "[5/5] Syncing with Capacitor..."
npx cap sync

echo ""
echo "=== Build Complete ==="
echo "Static files in: out/"
echo "Next steps:"
echo "  npx cap open android    # Open in Android Studio"
echo "  Then build APK from Android Studio"
