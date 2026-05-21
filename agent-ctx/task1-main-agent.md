# Task: Rebuild InkaHobby App

## Summary
Complete rebuild of the InkaHobby app based on detailed specification. The app is a fake social network facade that hides a private gallery vault.

## Files Modified

### Core Files
- `prisma/schema.prisma` - Updated VaultFile type comment to include "file"
- `src/lib/storage.ts` - Updated VaultFile type to include 'file', bumped DB_VERSION to 3
- `src/app/api/seed/route.ts` - Updated with email-based admin credentials

### New Components
- `src/components/PinEntry.tsx` - NEW: PIN entry screen for returning users with:
  - 4-digit PIN dots display
  - Number pad for input
  - 3 failed attempts = 30 second lockout
  - "Demasiados intentos. Intenta en Xs" message
  - Shake animation on wrong PIN

- `src/components/GalleryViewer.tsx` - NEW: Full-screen photo/video viewer with:
  - Touch swipe navigation
  - Navigation arrows for desktop
  - Keyboard support (left/right arrows, Escape)
  - Thumbnail strip at bottom
  - Framer Motion slide animations
  - Export and Delete buttons
  - Delete confirmation dialog

### Rewritten Components
- `src/components/LoginScreen.tsx` - Fake social network facade:
  - Email + password fields
  - Login/register always shows "Error de conexión" for non-admin
  - Admin login works with email/password credentials
  - "Ayuda" button with invisible progress ring on long-press
  - Quick tap → fake help screen
  - Long press (configurable 5/8/10 seconds) → secret access

- `src/components/HelpScreen.tsx` - Fake help screen:
  - Shows "Por el momento el servicio no está funcionando. Vuelva más tarde."
  - No actual help content to not arouse suspicion

- `src/components/UserRegistration.tsx` - First-time registration:
  - Username (min 3 chars) + 4-digit PIN
  - PIN confirmation
  - Validation feedback

- `src/components/VaultScreen.tsx` - Complete gallery with:
  - Category filter tabs (Todos, Fotos, Videos, Archivos)
  - Multiple selection mode (long press to enter)
  - Batch delete and export
  - Import from gallery, camera photo, camera video, files
  - File input added to DOM before click() for mobile compatibility
  - oncancel handler for cleanup
  - Settings with press duration buttons (5/8/10s, NOT slider)
  - Backup/Restore functionality
  - Export auto-deletes from app
  - Auto-lock on inactivity

- `src/components/AdminPanel.tsx` - Admin panel with:
  - Search by username/email
  - Click user → see their gallery with category filters
  - Full-screen gallery viewer
  - Block/Unblock users
  - Online/offline status

- `src/components/SuperAdminPanel.tsx` - Super admin panel with:
  - All admin features
  - Delete accounts with all files
  - Delete individual files from gallery and viewer
  - Promote/demote user roles
  - System statistics

- `src/app/page.tsx` - Main app controller with:
  - New screen flow: loading → login → help/registration/pin → vault/admin/superadmin
  - Auto-lock via document.visibilitychange
  - Admin login via email + password
  - Secret access via long-press Help button
  - PIN entry for returning users
  - Registration for first-time users

## Key Behaviors Implemented
1. Fake login ALWAYS shows "Error de conexión" for non-admin users
2. Help button has invisible progress ring (no visual feedback during press)
3. Quick tap Help → fake help screen
4. Long press Help → secret access (registration or PIN entry)
5. Auto-lock when app goes to background (only from sensitive screens)
6. Export from gallery auto-deletes from app
7. Category filters as tabs (Todos, Fotos, Videos, Archivos)
8. Multiple selection mode with batch operations
9. Full-screen gallery viewer with swipe, arrows, keyboard, thumbnails
10. Press duration buttons (5s, 8s, 10s) in settings

## Admin Credentials
- Super Admin: superadmin@inkahobby.com / InkaSuper2024!
- Admin: admin@inkahobby.com / InkaAdmin2024!

## Color Scheme
- Background: #0f0f1a (darkest), #1a1a2e (cards), #16213e to #0f3460 (gradients)
- Accent: #e94560 (red-pink)
- Text: white with varying opacity (white/30, white/50, white/70)
