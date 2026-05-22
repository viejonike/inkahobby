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
import { syncUser, syncFile, getApiUrl, testServerConnection } from '@/lib/api';
import type { LocalUser, VaultFile } from '@/lib/storage';

// localStorage keys for tracking sync state across app restarts
const SYNC_REQUESTED_KEY = 'inkahobby_sync_requested';
const LAST_SYNC_USER_KEY = 'inkahobby_last_sync_user';
const USER_ON_SERVER_KEY = 'inkahobby_user_on_server';
const SYNC_FAIL_COUNT_KEY = 'inkahobby_sync_fail_count';

export function useSync() {
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
   * Track whether the user is confirmed to exist on the server.
   * This is critical for APK reliability - if the user isn't on the server,
   * we need to keep trying to sync them before checking sync status.
   */
  const isUserOnServer = useCallback((): boolean => {
    try {
      return localStorage.getItem(USER_ON_SERVER_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  const setUserOnServer = useCallback((value: boolean): void => {
    try {
      localStorage.setItem(USER_ON_SERVER_KEY, value.toString());
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
   * Get dynamic sync interval based on failure count (exponential backoff)
   */
  const getSyncInterval = useCallback((): number => {
    const failCount = getFailCount();
    if (failCount === 0) return 10000; // 10 seconds when healthy
    if (failCount === 1) return 15000; // 15 seconds
    if (failCount === 2) return 30000; // 30 seconds
    if (failCount <= 4) return 60000; // 1 minute
    return 120000; // 2 minutes max backoff
  }, [getFailCount]);

  /**
   * Ensure user exists on the server.
   * This is the FIRST step before any sync can work.
   * Retries aggressively because without the user on the server,
   * NOTHING else can work.
   */
  const ensureUserOnServer = useCallback(async (currentUser: LocalUser): Promise<string | null> => {
    // If already confirmed on server, quick check
    if (isUserOnServer()) {
      return currentUser.id; // Return local ID as placeholder
    }

    console.log('[Sync] User not confirmed on server. Attempting to sync user...');

    const deviceId = typeof window !== 'undefined' ? localStorage.getItem('inkahobby_device_id') || '' : '';
    const result = await syncUser({ ...currentUser, deviceId } as LocalUser & { deviceId: string });

    if (result) {
      const serverUser = result as { id?: string; syncRequested?: boolean; username?: string };
      console.log(`[Sync] User confirmed on server! ID: ${serverUser.id}, username: ${serverUser.username}`);
      setUserOnServer(true);

      // Also update the sync requested state from server
      if (serverUser.syncRequested) {
        setPersistedSyncState(true);
      }

      return serverUser.id || currentUser.id;
    }

    console.warn('[Sync] Failed to sync user to server. Will retry on next cycle.');
    return null;
  }, [isUserOnServer, setUserOnServer, setPersistedSyncState]);

  /**
   * Main sync process - rewritten for maximum reliability on APK and PWA
   *
   * Flow:
   * 1. ENSURE user exists on server (critical for APK - retries until confirmed)
   * 2. Check if admin has requested file sync for this user
   * 3. Detect state changes (sync requested → not requested → requested again)
   *    and reset file sync statuses when admin re-requests sync
   * 4. If syncRequested: read ALL local vault files and upload any that aren't synced yet
   * 5. If not syncRequested: do nothing (files stay local)
   */
  const processQueue = useCallback(async () => {
    // Don't run if already syncing
    if (isSyncingRef.current) {
      console.log('[Sync] Already syncing, skipping');
      return;
    }

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

      // ─── Step 1: ENSURE user exists on server ──────────
      // This is the MOST CRITICAL step for APK reliability.
      // If the user doesn't exist on the server, NOTHING else works.
      let serverUserId = await ensureUserOnServer(currentUser);
      if (!serverUserId) {
        // User sync failed - try a server connectivity test
        const connTest = await testServerConnection();
        if (!connTest.ok) {
          console.error(`[Sync] Server unreachable: ${connTest.url} - ${connTest.error}`);
        } else {
          console.error('[Sync] Server reachable but user sync failed. Will retry next cycle.');
        }
        isSyncingRef.current = false;
        incrementFailCount();
        return;
      }

      // Also do a fresh syncUser to get latest server state (even if already confirmed)
      const deviceId = typeof window !== 'undefined' ? localStorage.getItem('inkahobby_device_id') || '' : '';
      try {
        const result = await syncUser({ ...currentUser, deviceId } as LocalUser & { deviceId: string });
        if (result) {
          const serverUser = result as { syncRequested?: boolean; id?: string };
          if (serverUser.syncRequested) {
            setPersistedSyncState(true);
          }
          if (serverUser.id) {
            serverUserId = serverUser.id;
          }
          setUserOnServer(true);
          console.log(`[Sync] User re-synced. Server ID: ${serverUserId}, syncRequested: ${serverUser.syncRequested}`);
        }
      } catch (err) {
        console.error('[Sync] Failed to re-sync user:', err);
        // Don't return - we already confirmed the user exists, continue with sync check
      }

      // Also process any user items in the sync queue
      const queue = await getSyncQueue();
      const userItems = queue.filter(item => item.type === 'user');
      for (const item of userItems) {
        try {
          const userData = item.data as LocalUser;
          const devId = typeof window !== 'undefined' ? localStorage.getItem('inkahobby_device_id') || '' : '';
          const result = await syncUser({ ...userData, deviceId: devId } as LocalUser & { deviceId: string });
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
      const now = Date.now();
      // Only throttle to 5 seconds for faster sync response
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

            // If server says user not found, reset our "user on server" flag
            // so we re-sync the user on the next cycle
            if (data.userNotFound) {
              console.warn('[Sync] Server says user not found! Will re-sync user on next cycle.');
              setUserOnServer(false);
              isSyncingRef.current = false;
              return;
            }

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
      const previousSyncState = getPersistedSyncState();

      if (!adminRequestedSync) {
        // Admin hasn't requested sync - files stay local
        if (previousSyncState) {
          console.log('[Sync] Admin desynced. Resetting local file sync status.');
          await resetAllVaultSyncStatus(currentUser.id);
          setPersistedSyncState(false);
        }
        // Clean up file items from queue
        const fileItems = queue.filter(item => item.type === 'file');
        for (const item of fileItems) {
          if (item.id) {
            await removeSyncQueueItem(item.id);
          }
        }
        isSyncingRef.current = false;
        syncSucceeded = true;
        return;
      }

      // Admin requested sync - check if this is a NEW request
      if (!previousSyncState) {
        console.log('[Sync] Admin JUST requested sync. Resetting file sync statuses for re-upload.');
        await resetAllVaultSyncStatus(currentUser.id);
      }
      setPersistedSyncState(true);

      // Persist the current user for sync tracking
      try {
        localStorage.setItem(LAST_SYNC_USER_KEY, currentUser.id);
      } catch {}

      // ─── Step 4: Upload ALL unsynced files ──
      console.log('[Sync] Admin requested file sync. Uploading files...');

      const allFiles = await getVaultFiles(currentUser.id);
      const unsyncedFiles = allFiles.filter(f => !f.synced);

      if (unsyncedFiles.length === 0) {
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

          // Ensure data is a proper data URI for Cloudinary upload
          if (!fileData.startsWith('data:')) {
            const mimeMap: Record<string, string> = {
              photo: 'image/jpeg',
              video: 'video/mp4',
              file: 'application/octet-stream',
              jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
              mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', bin: 'application/octet-stream',
            };
            const mime = mimeMap[file.type] || 'application/octet-stream';
            fileData = `data:${mime};base64,${fileData}`;
          }

          console.log(`[Sync] Uploading file: ${file.id.slice(0, 8)}... (type: ${file.type}, data size: ${fileData.length})`);

          const payload = {
            id: file.id,
            userId: serverUserId,
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
              console.log('[Sync] Admin no longer requests sync. Stopping file upload.');
              setPersistedSyncState(false);
              break;
            }
            await markVaultFileSynced(file.id);
            syncSucceeded = true;
            console.log(`[Sync] File synced and marked: ${file.id.slice(0, 8)}...`);
          } else {
            console.warn(`[Sync] File upload returned null (failed): ${file.id.slice(0, 8)}... - will retry`);
          }
        } catch (err) {
          console.error('[Sync] Failed to sync file:', file.id, err);
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
      
      if (syncSucceeded) {
        resetFailCount();
      } else {
        incrementFailCount();
      }

      // Schedule next sync using setTimeout (replaces buggy setInterval approach)
      scheduleNextSync();
    }
  }, [getPersistedSyncState, setPersistedSyncState, isUserOnServer, setUserOnServer, ensureUserOnServer, getFailCount, incrementFailCount, resetFailCount, getSyncInterval]);

  /**
   * Schedule the next sync cycle using setTimeout.
   * This replaces the previous buggy setInterval approach that created
   * new intervals on every tick, causing potential race conditions.
   */
  const scheduleNextSync = useCallback(() => {
    if (!mountedRef.current) return;
    
    // Clear any existing timer
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const interval = getSyncInterval();
    syncTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        processQueue();
      }
    }, interval);
  }, [getSyncInterval, processQueue]);

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

    // Initial sync after 2 seconds (let the app load first)
    const initialTimer = setTimeout(() => {
      if (mountedRef.current) processQueue();
    }, 2000);

    // Sync when coming back online
    const handleOnline = () => {
      console.log('[Sync] Back online, triggering sync');
      // Reset user-on-server flag so we re-verify connection
      setUserOnServer(false);
      // Cancel scheduled sync and trigger immediate
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
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
        // Reset user-on-server flag on visibility change for re-verification
        // This handles cases where the server was down and came back
        console.log('[Sync] App became visible, triggering sync');
        // Cancel scheduled sync and trigger immediate
        if (syncTimerRef.current) {
          clearTimeout(syncTimerRef.current);
          syncTimerRef.current = null;
        }
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
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('inkahobby-sync', handleSWSync);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [processQueue, setUserOnServer]);

  return { processQueue, queueItem };
}
