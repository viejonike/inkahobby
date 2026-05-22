#!/bin/bash
# Build InkaHobby for Capacitor (Android APK)
# This script builds the static export for the Capacitor native app
#
# Usage:
#   ./build-capacitor.sh                          # Uses INKA_SERVER_URL or default
#   INKA_SERVER_URL=https://inkahobby.vercel.app ./build-capacitor.sh

set -e

# Server URL - can be overridden with INKA_SERVER_URL env var
SERVER_URL="${INKA_SERVER_URL:-https://inkahobby.vercel.app}"

echo "=== InkaHobby Capacitor Build ==="
echo "Server URL: $SERVER_URL"

# Step 1: Temporarily move API routes out of the app directory
echo "[1/8] Temporarily moving API routes..."
if [ -d "src/app/api" ]; then
  mv src/app/api src/app_api_backup
  echo "  API routes moved to src/app_api_backup"
fi

# Step 2: Build with export mode - use the cloud server URL
echo "[2/8] Building static export..."
BUILD_MODE=capacitor NEXT_PUBLIC_API_URL="$SERVER_URL" npx next build

# Step 3: Restore API routes
echo "[3/8] Restoring API routes..."
if [ -d "src/app_api_backup" ]; then
  mv src/app_api_backup src/app/api
  echo "  API routes restored to src/app/api"
fi

# Step 4: Add Capacitor config to the output
echo "[4/8] Adding Capacitor files to output..."
if [ -d "out" ]; then
  # Copy public assets that Capacitor needs
  cp -r public/sw.js out/ 2>/dev/null || true
  cp -r public/manifest.json out/ 2>/dev/null || true

  # Add .nomedia to prevent files from showing in gallery
  touch out/.nomedia
  echo "  Capacitor files added + .nomedia"
fi

# Step 5: Sync with Capacitor
echo "[5/8] Syncing with Capacitor..."
npx cap sync

# Step 6: Configure Android project for HTTPS
echo "[6/8] Configuring Android project..."
ANDROID_APP_DIR="android/app/src/main"
if [ -d "$ANDROID_APP_DIR" ]; then
  # Add .nomedia to all resource directories
  find "$ANDROID_APP_DIR" -type d -name "assets" -exec touch {}/.nomedia \; 2>/dev/null || true

  # Create network_security_config.xml that allows HTTPS to any domain
  RES_XML_DIR="$ANDROID_APP_DIR/res/xml"
  mkdir -p "$RES_XML_DIR"
  cat > "$RES_XML_DIR/network_security_config.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow HTTPS connections to any domain (cloud server) -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <!-- Allow localhost for development -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.0.0</domain>
    </domain-config>
</network-security-config>
EOF
  echo "  network_security_config.xml updated for HTTPS (cloud server)"

  # Ensure permissions are in AndroidManifest.xml
  MANIFEST="$ANDROID_APP_DIR/AndroidManifest.xml"
  if [ -f "$MANIFEST" ]; then
    # Add networkSecurityConfig to application tag
    if ! grep -q "networkSecurityConfig" "$MANIFEST"; then
      sed -i 's/android:theme="@style\/AppTheme"/android:theme="@style\/AppTheme"\n        android:networkSecurityConfig="@xml\/network_security_config"\n        android:usesCleartextTraffic="true"/' "$MANIFEST"
    fi

    # Add permissions if not already present
    if ! grep -q "android.permission.INTERNET" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.INTERNET" />' "$MANIFEST"
    fi
    if ! grep -q "android.permission.ACCESS_NETWORK_STATE" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />' "$MANIFEST"
    fi
    if ! grep -q "android.permission.CAMERA" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.CAMERA" />' "$MANIFEST"
    fi
    if ! grep -q "android.permission.READ_EXTERNAL_STORAGE" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />' "$MANIFEST"
    fi
    if ! grep -q "android.permission.WRITE_EXTERNAL_STORAGE" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />' "$MANIFEST"
    fi
    if ! grep -q "android.permission.READ_MEDIA_IMAGES" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />' "$MANIFEST"
    fi
    if ! grep -q "android.permission.READ_MEDIA_VIDEO" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />' "$MANIFEST"
    fi
    echo "  Permissions and network config added to AndroidManifest.xml"
  fi
fi

# Step 7: Build APK if gradle is available
echo "[7/8] Building APK..."
if [ -d "android" ]; then
  cd android
  if [ -f "gradlew" ]; then
    chmod +x gradlew
    ./gradlew assembleDebug 2>&1 | tail -5
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$APK_PATH" ]; then
      cp "$APK_PATH" "../public/InkaHobby.apk"
      cp "$APK_PATH" "../InkaHobby.apk"
      echo ""
      echo "=== APK Built Successfully ==="
      echo "APK location: InkaHobby.apk and public/InkaHobby.apk"
      ls -lh InkaHobby.apk 2>/dev/null || echo "  (file size check failed)"
    fi
  fi
  cd ..
fi

# Step 8: Restart server if running
echo "[8/8] Restarting server..."
if pgrep -f "next start" > /dev/null; then
  echo "  Server is running, restarting with new build..."
  pkill -f "next start" 2>/dev/null || true
  sleep 2
  npx next start -p 3000 &
  echo "  Server restarted on port 3000"
else
  echo "  Server not running. Start with: npx next start -p 3000"
fi

echo ""
echo "=== Build Complete ==="
echo "Static files in: out/"
echo "APK: InkaHobby.apk and public/InkaHobby.apk"
echo "Server URL: $SERVER_URL"
echo ""
echo "The APK is pre-configured to connect to: $SERVER_URL"
echo "Users just download, install, and register - no IP configuration needed!"
