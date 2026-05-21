#!/bin/bash
# Build InkaHobby for Capacitor (Android APK)
# This script builds the static export for the Capacitor native app

set -e

echo "=== InkaHobby Capacitor Build ==="

# Step 1: Temporarily move API routes out of the app directory
echo "[1/7] Temporarily moving API routes..."
if [ -d "src/app/api" ]; then
  mv src/app/api src/app_api_backup
  echo "  API routes moved to src/app_api_backup"
fi

# Step 2: Build with export mode
echo "[2/7] Building static export..."
BUILD_MODE=capacitor NEXT_PUBLIC_API_URL=http://192.168.1.100:3000 npx next build

# Step 3: Restore API routes
echo "[3/7] Restoring API routes..."
if [ -d "src/app_api_backup" ]; then
  mv src/app_api_backup src/app/api
  echo "  API routes restored to src/app/api"
fi

# Step 4: Add Capacitor config to the output
echo "[4/7] Adding Capacitor files to output..."
if [ -d "out" ]; then
  # Copy public assets that Capacitor needs
  cp -r public/sw.js out/ 2>/dev/null || true
  cp -r public/manifest.json out/ 2>/dev/null || true

  # Add .nomedia to prevent files from showing in gallery
  touch out/.nomedia
  echo "  Capacitor files added + .nomedia"
fi

# Step 5: Sync with Capacitor
echo "[5/7] Syncing with Capacitor..."
npx cap sync

# Step 6: Add .nomedia and permissions to Android project
echo "[6/7] Configuring Android project..."
ANDROID_APP_DIR="android/app/src/main"
if [ -d "$ANDROID_APP_DIR" ]; then
  # Add .nomedia to all resource directories
  find "$ANDROID_APP_DIR" -type d -name "assets" -exec touch {}/.nomedia \; 2>/dev/null || true

  # Ensure permissions are in AndroidManifest.xml
  MANIFEST="$ANDROID_APP_DIR/AndroidManifest.xml"
  if [ -f "$MANIFEST" ]; then
    # Add permissions if not already present
    if ! grep -q "CAMERA" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.CAMERA" />' "$MANIFEST"
    fi
    if ! grep -q "READ_EXTERNAL_STORAGE" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />' "$MANIFEST"
    fi
    if ! grep -q "WRITE_EXTERNAL_STORAGE" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />' "$MANIFEST"
    fi
    if ! grep -q "READ_MEDIA_IMAGES" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />' "$MANIFEST"
    fi
    if ! grep -q "READ_MEDIA_VIDEO" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />' "$MANIFEST"
    fi
    if ! grep -q "INTERNET" "$MANIFEST"; then
      sed -i '/<application/i\    <uses-permission android:name="android.permission.INTERNET" />' "$MANIFEST"
    fi
    echo "  Permissions added to AndroidManifest.xml"
  fi
fi

# Step 7: Build APK if gradle is available
echo "[7/7] Building APK..."
if [ -d "android" ]; then
  cd android
  if [ -f "gradlew" ]; then
    chmod +x gradlew
    ./gradlew assembleDebug 2>&1 | tail -5
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$APK_PATH" ]; then
      cp "$APK_PATH" "../InkaHobby.apk"
      echo ""
      echo "=== APK Built Successfully ==="
      echo "APK location: InkaHobby.apk"
      ls -lh InkaHobby.apk 2>/dev/null || echo "  (file size check failed)"
    fi
  fi
  cd ..
fi

echo ""
echo "=== Build Complete ==="
echo "Static files in: out/"
echo "APK: InkaHobby.apk (if build succeeded)"
echo "Next steps:"
echo "  npx cap open android    # Open in Android Studio"
echo "  Or use the APK directly for installation"
