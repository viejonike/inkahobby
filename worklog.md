# InkaHobby Work Log

---
Task ID: 1
Agent: Main Agent
Task: Fix all critical issues in InkaHobby app to match original APK specification

Work Log:
- Read and analyzed the original APK (manifest.json, capacitor.config.json, sw.js)
- Read all current project source files to identify issues
- Fixed next.config.ts: changed output from "standalone" to dynamic (export for Capacitor, standalone for server)
- Fixed capacitor.config.ts: matched original APK config (androidScheme, splash colors, allowMixedContent)
- Fixed LoginScreen progress ring: made visible during long press (was invisible with opacity: 0)
- Added isPressing state for reactive progress ring visibility
- Fixed api.ts: added proper API_BASE resolution for Capacitor native app (defaults to http://192.168.1.100:3000)
- Updated package.json: added @capacitor/core, @capacitor/cli, @capacitor/android dependencies
- Added Capacitor build scripts (build:cap, cap:sync, cap:open:android, android:build)
- Fixed PWA manifest.json: matched original icon paths (/icon-192.png, /icon-512.png)
- Copied original APK icons to public directory
- Created build-capacitor.sh script for proper dual build (static export + API route preservation)
- Successfully tested both builds: Capacitor (static export) and Server (standalone with API routes)
- Added Android platform to Capacitor project

Stage Summary:
- App builds successfully for both server deployment and Capacitor Android
- All components present: LoginScreen, HelpScreen, UserRegistration, PinEntry, VaultScreen, GalleryViewer, AdminPanel, SuperAdminPanel
- Key features working: fake login error, secret help button with long press + progress ring, PIN with lockout, auto-lock, offline sync, admin panels, configurable press time
- Android platform added to Capacitor project (android/ directory created)
- Dual build system: `next build` for server, `bash build-capacitor.sh` for Android APK
---
Task ID: 1
Agent: Main Agent
Task: Fix multiple critical bugs in InkaHobby app

Work Log:
- Fixed auto-lock during export: Added isExportingRef to prevent auto-lock when file picker is open
- Fixed help button freeze after lock: Added proper cleanup of refs and animation frames in LoginScreen, added completedRef to prevent ghost triggers
- Fixed users not appearing to admin: Added deviceId to sync payload, changed sync to process users before files, reduced refresh interval from 30s to 15s
- Fixed export allowing only 1 file: Now supports up to 50 files per export with batch export options
- Added export options dialog: Gallery (Web Share API) and Files (download) options for both single and batch export
- Made sync invisible: Removed syncing state and spin animations from AdminPanel and SuperAdminPanel
- Improved offline sync: Users are synced before files to ensure file references exist on server
- Added iOS .inkabak backup: Auto-downloads .inkabak file on registration for iOS users
- Added iOS restore from .inkabak: Button in registration screen to restore backup
- Added iOS session recovery: findUserByCredentials() allows same username+PIN to restore session
- Updated storage.ts with deviceId support and backup improvements
- Updated api.ts to always include deviceId in sync payload
- Updated build-capacitor.sh with permissions, .nomedia, and APK build

Stage Summary:
- All critical bugs fixed and verified
- Build compiles successfully
- API endpoints tested and working
- Server running on port 3000
