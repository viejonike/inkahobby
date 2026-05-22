'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  getSyncQueue,
  removeSyncQueueItem,
  addToSyncQueue,
  getCurrentUser,
  getVaultFileData,
  getVaultFiles,
  markVaultFileSynced,
  resetAllVaultSyncStatus,
} from '@/lib/storage';
import { syncUser, syncFile, getApiUrl } from '@/lib/api';
import type { LocalUser, VaultFile } from '@/lib/storage';

// localStorage key for tracking sync state across app restarts
const SYNC_REQUESTED_KEY = 'inkahobby_sync_requested';
const LAST_SYNC_USER_KEY = 'inkahobby_last_sync_user';

// Track consecutive failures to implement backoff
const SYNC_FAIL_COUNT_KEY = 'inkahobby_sync_fail_count';

export function useSync() {
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);
  const lastSyncCheckRef = useRef(0);
  const mountedRef = useRef(true);

  /**
   * Get the persisted sync requested state from localStorage.
   * This persists across app restarts (critical for iOS PWA).
   */
  const getPersistedSyncState = useCallback((): boolean => {
    try {
      return localStorage.getItem(SYNC_REQUESTED_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  /**
   * Persist the sync requested state to localStorage.
   */
  const setPersistedSyncState = useCallback((value: boolean): void => {
    try {
      localStorage.setItem(SYNC_REQUESTED_KEY, value.toString());
    } catch {}
  }, []);

  /**
   * Get/set consecutive failure count for backoff
   */
  const getFailCount = useCallback((): number => {
    try {
      return parseInt(localStorage.getItem(SYNC_FAIL_COUNT_KEY) || '0', 10);
    } catch {
      return 0;
    }
  }, []);

  const incrementFailCount = useCallback((): void => {
    try {
      const count = getFailCount() + 1;
      localStorage.setItem(SYNC_FAIL_COUNT_KEY, count.toString());
    } catch {}
  }, []);

  const resetFailCount = useCallback((): void => {
    try {
      localStorage.removeItem(SYNC_FAIL_COUNT_KEY);
    } catch {}
  }, []);

  /**
   * Main sync process - rewritten for maximum reliability on APK and PWA
   *
   * Flow:
   * 1. Sync user data to server (so server knows this user exists)
   * 2. Check if admin has requested file sync for this user
   * 3. Detect state changes (sync requested → not requested → requested again)
   *    and reset file sync statuses when admin re-requests sync
   * 4. If syncRequested: read ALL local vault files and upload any that aren't synced yet
   * 5. If not syncRequested: do nothing (files stay local)
   */
  const processQueue = useCallback(async () => {
    // Don't run if already syncing
    if (isSyncingRef.current) return;

    // Check if online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[Sync] Offline, skipping sync');
      return;
    }

    isSyncingRef.current = true;
    let syncSucceeded = false;

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        isSyncingRef.current = false;
        return;
      }

      console.log(`[Sync] Starting sync for user: ${currentUser.username}`);

      // ─── Step 1: Sync user to server ──────────────────────
      // Make sure the server knows this user exists
      let serverUserId = currentUser.id;
      let userSynced = false;
      try {
        const deviceId = typeof window !== 'undefined' ? localStorage.getItem('inkahobby_device_id') || '' : '';
        const result = await syncUser({ ...currentUser, deviceId } as LocalUser & { deviceId: string });
        if (result) {
          userSynced = true;
          const serverUser = result as { syncRequested?: boolean; id?: string };
          if (serverUser.syncRequested) {
            setPersistedSyncState(true);
          }
          // Track the server-side user ID for file registration
          if (serverUser.id) {
            serverUserId = serverUser.id;
          }
          console.log(`[Sync] User synced. Server ID: ${serverUserId}, syncRequested: ${serverUser.syncRequested}`);
        }
      } catch (err) {
        console.error('[Sync] Failed to sync user:', err);
      }

      // Also process any user items in the sync queue
      const queue = await getSyncQueue();
      const userItems = queue.filter(item => item.type === 'user');
      for (const item of userItems) {
        try {
          const userData = item.data as LocalUser;
          const deviceId = typeof window !== 'undefined' ? localStorage.getItem('inkahobby_device_id') || '' : '';
          const result = await syncUser({ ...userData, deviceId } as LocalUser & { deviceId: string });
          if (result) {
            const serverUser = result as { syncRequested?: boolean };
            if (serverUser.syncRequested) {
              setPersistedSyncState(true);
            }
            if (item.id) {
              await removeSyncQueueItem(item.id);
            }
          }
        } catch (err) {
          console.error('[Sync] Failed to sync queue user item:', err);
        }
      }

      // ─── Step 2: Check if admin requested file sync ──────
      let adminRequestedSync = getPersistedSyncState();

      // Always check with server (don't rely only on cached value)
      // Check every time (not throttled) for more reliable sync on APK/PWA
      const now = Date.now();
      // Only throttle to 5 seconds (was 10) for faster sync response
      if (now - lastSyncCheckRef.current > 5000) {
        lastSyncCheckRef.current = now;
        try {
          const res = await fetch(getApiUrl('/api/sync/check'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username }),
          });
          if (res.ok) {
            const data = await res.json();
            adminRequestedSync = data.syncRequested === true;
            console.log(`[Sync] Server sync check: syncRequested=${adminRequestedSync}`);
          } else {
            console.warn(`[Sync] Sync check failed: ${res.status}`);
          }
        } catch (err) {
          console.warn('[Sync] Cannot reach server for sync check:', err);
          // Can't reach server - use cached value
        }
      }

      // ─── Step 3: Detect state transitions and reset file sync ──
      // This is the KEY FIX for iPhone PWA: detect when syncRequested
      // changes from false to true (even across app restarts)
      const previousSyncState = getPersistedSyncState();

      if (!adminRequestedSync) {
        // Admin hasn't requested sync - files stay local
        // If files were previously synced (admin desynced), reset their sync status
        // so they can be re-uploaded when admin syncs again
        if (previousSyncState) {
          // Was synced before, now it's not → admin desynced
          console.log('[Sync] Admin desynced. Resetting local file sync status.');
          await resetAllVaultSyncStatus(currentUser.id);
          setPersistedSyncState(false);
        }
        // Still process and remove old file items from queue
        const fileItems = queue.filter(item => item.type === 'file');
        for (const item of fileItems) {
          if (item.id) {
            await removeSyncQueueItem(item.id);
          }
        }
        isSyncingRef.current = false;
        // Even if no files to sync, the connection worked
        syncSucceeded = true;
        return;
      }

      // Admin requested sync - check if this is a NEW request
      // (changed from false to true since last check)
      if (!previousSyncState) {
        // Sync was just requested (was false, now true)
        // Reset ALL file sync statuses so they get re-uploaded
        console.log('[Sync] Admin JUST requested sync. Resetting file sync statuses for re-upload.');
        await resetAllVaultSyncStatus(currentUser.id);
      }
      // Always persist the current state
      setPersistedSyncState(true);

      // Also persist the current user for sync tracking
      try {
        localStorage.setItem(LAST_SYNC_USER_KEY, currentUser.id);
      } catch {}

      // ─── Step 4: Admin requested sync - upload ALL unsynced files ──
      console.log('[Sync] Admin requested file sync. Uploading files...');

      // Get ALL vault file for this user (not just from queue)
      const allFiles = await getVaultFiles(currentUser.id);
      const unsyncedFiles = allFiles.filter(f => !f.synced);

      if (unsyncedFiles.length === 0) {
        // No files to sync, but check if queue has items to clean up
        const fileItems = queue.filter(item => item.type === 'file');
        for (const item of fileItems) {
          if (item.id) {
            await removeSyncQueueItem(item.id);
          }
        }
        isSyncingRef.current = false;
        syncSucceeded = true;
        console.log('[Sync] No unsynced files. All synced.');
        return;
      }

      console.log(`[Sync] Found ${unsyncedFiles.length} unsynced files to upload`);

      // Upload each unsynced file
      for (const file of unsyncedFiles) {
        try {
          // Read actual file data (handles Capacitor Filesystem paths)
          let fileData = file.data;
          const isNativeFile = (file as any)._isNativeFile && fileData && !fileData.startsWith('data:');
          
          if (isNativeFile) {
            console.log(`[Sync] Reading native file: ${file.id.slice(0, 8)}... (path: ${fileData.slice(0, 50)})`);
            try {
              fileData = await getVaultFileData(file);
            } catch (readErr) {
              console.error('[Sync] Failed to read file from filesystem:', readErr);
              continue; // Skip this file
            }
          }

          if (!fileData || fileData.length === 0) {
            console.warn('[Sync] Skipping empty file:', file.id);
            continue;
          }

          // Determine if data is base64 data URI or raw base64
          // For Cloudinary upload, we need the full data URI (data:image/...;base64,...)
          // If the data doesn't start with 'data:', try to construct a data URI
          if (!fileData.startsWith('data:')) {
            // Try to determine MIME type from file type metadata
            const mimeMap: Record<string, string> = {
              photo: 'image/jpeg',
              video: 'video/mp4',
              file: 'application/octet-stream',
              jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
              mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', bin: 'application/octet-stream',
            };
            
            // Use file.type first (more reliable), then fall back to extension
            const mime = mimeMap[file.type] || 'application/octet-stream';
            fileData = `data:${mime};base64,${fileData}`;
          }

          console.log(`[Sync] Uploading file: ${file.id.slice(0, 8)}... (type: ${file.type}, data size: ${fileData.length})`);

          const payload = {
            id: file.id,
            userId: serverUserId, // Use the server-side user ID for correct file association
            username: currentUser.username,
            type: file.type,
            data: fileData,
            thumbnail: file.thumbnail || undefined,
            createdAt: file.createdAt,
          };

          const result = await syncFile(payload as VaultFile & { userId: string; username?: string });
          
          if (result) {
            const syncResult = result as { notRequested?: boolean };
            if (syncResult.notRequested) {
              // Admin no longer wants sync - stop
              console.log('[Sync] Admin no longer requests sync. Stopping file upload.');
              setPersistedSyncState(false);
              break;
            }
            // Mark file as synced locally so we don't re-upload
            await markVaultFileSynced(file.id);
            syncSucceeded = true;
            console.log(`[Sync] File synced and marked: ${file.id.slice(0, 8)}...`);
          } else {
            // syncFile returned null - this means the upload failed
            // Don't mark as synced - will retry on next sync cycle
            console.warn(`[Sync] File upload returned null (failed): ${file.id.slice(0, 8)}... - will retry`);
          }
        } catch (err) {
          console.error('[Sync] Failed to sync file:', file.id, err);
          // Don't mark as synced - will retry next cycle
        }
      }

      // Clean up the sync queue
      const remainingQueue = await getSyncQueue();
      const fileItems = remainingQueue.filter(item => item.type === 'file');
      for (const item of fileItems) {
        if (item.id) {
          await removeSyncQueueItem(item.id);
        }
      }

    } catch (error) {
      console.error('[Sync] Error processing sync:', error);
    } finally {
      isSyncingRef.current = false;
      
      // Track success/failure for backoff
      if (syncSucceeded) {
        resetFailCount();
      } else {
        incrementFailCount();
      }
    }
  }, [getPersistedSyncState, setPersistedSyncState, getFailCount, incrementFailCount, resetFailCount]);

  // Add item to sync queue (for use by other components)
  const queueItem = useCallback(async (type: 'user' | 'file', data: unknown) => {
    await addToSyncQueue({ type, data });
    // Try to process immediately if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      processQueue();
    }
  }, [processQueue]);

  useEffect(() => {
    mountedRef.current = true;

    // Get dynamic sync interval based on failure count (exponential backoff)
    const getSyncInterval = (): number => {
      const failCount = getFailCount();
      if (failCount === 0) return 10000; // 10 seconds when healthy
      if (failCount === 1) return 15000; // 15 seconds
      if (failCount === 2) return 30000; // 30 seconds
      if (failCount <= 4) return 60000; // 1 minute
      return 120000; // 2 minutes max backoff
    };

    // Initial sync after 2 seconds (let the app load first)
    const initialTimer = setTimeout(() => {
      if (mountedRef.current) processQueue();
    }, 2000);

    // Set up interval for periodic sync with dynamic interval
    const startInterval = () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      syncIntervalRef.current = setInterval(() => {
        if (mountedRef.current) processQueue();
        // Restart interval with potentially new backoff time
        startInterval();
      }, getSyncInterval());
    };
    startInterval();

    // Sync when coming back online
    const handleOnline = () => {
      console.log('[Sync] Back online, triggering sync');
      // Small delay to let connection stabilize
      setTimeout(() => {
        if (mountedRef.current) processQueue();
      }, 1000);
    };

    // Sync when Service Worker triggers background sync
    const handleSWSync = () => {
      console.log('[Sync] Background sync event from Service Worker');
      if (mountedRef.current) processQueue();
    };

    // Sync when app becomes visible (user opens the app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset the sync check timer so we always check immediately on visibility
        lastSyncCheckRef.current = 0;
        // Immediate sync when user opens the app
        console.log('[Sync] App became visible, triggering sync');
        if (mountedRef.current) processQueue();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('inkahobby-sync', handleSWSync);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      mountedRef.current = false;
      clearTimeout(initialTimer);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('inkahobby-sync', handleSWSync);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [processQueue, getFailCount]);

  return { processQueue, queueItem };
}
