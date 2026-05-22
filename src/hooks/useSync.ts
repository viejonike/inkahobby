'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  getSyncQueue,
  removeSyncQueueItem,
  addToSyncQueue,
} from '@/lib/storage';
import { syncUser, syncFile, getApiUrl } from '@/lib/api';
import type { LocalUser, VaultFile } from '@/lib/storage';

export function useSync() {
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);
  const syncRequestedRef = useRef(false); // Whether admin requested file sync

  const processQueue = useCallback(async () => {
    // Don't run if already syncing
    if (isSyncingRef.current) return;

    // Check if online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    isSyncingRef.current = true;

    try {
      const queue = await getSyncQueue();
      if (queue.length === 0) {
        isSyncingRef.current = false;
        return;
      }

      // Process users first, then files (files depend on users being synced)
      const userItems = queue.filter(item => item.type === 'user');
      const fileItems = queue.filter(item => item.type === 'file');

      // Sync all users first - and check if admin requested file sync
      let adminRequestedSync = false;
      for (const item of userItems) {
        try {
          const userData = item.data as LocalUser;
          const result = await syncUser(userData);
          if (result) {
            // Check if admin requested sync for this user
            const serverUser = result as { syncRequested?: boolean };
            if (serverUser.syncRequested) {
              adminRequestedSync = true;
            }
            if (item.id) {
              await removeSyncQueueItem(item.id);
            }
          }
        } catch (err) {
          console.error('[Sync] Failed to sync user:', item.id, err);
        }
      }

      // Update the ref
      syncRequestedRef.current = adminRequestedSync;

      // Only sync files if admin requested it OR if we couldn't check
      // If we couldn't reach the server, try syncing files anyway as fallback
      if (adminRequestedSync || userItems.length === 0) {
        // Sync files only when admin requested, or if no user items were in queue
        // (meaning user was already synced before and we're just processing file queue)
        if (!adminRequestedSync && userItems.length === 0) {
          // Check server for syncRequested status
          try {
            const res = await fetch(getApiUrl('/api/sync/check'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
            if (res.ok) {
              const data = await res.json();
              if (!data.syncRequested) {
                // Admin hasn't requested sync - skip files
                console.log('[Sync] Admin has not requested file sync. Files stay local.');
                isSyncingRef.current = false;
                return;
              }
              adminRequestedSync = true;
              syncRequestedRef.current = true;
            }
          } catch {
            // Can't check server - try syncing files anyway as fallback
          }
        }

        if (adminRequestedSync) {
          console.log('[Sync] Admin requested file sync. Uploading files...');
          // Then sync files
          for (const item of fileItems) {
            try {
              const fileData = item.data as VaultFile & { userId: string };
              const result = await syncFile(fileData);
              if (result) {
                const syncResult = result as { notRequested?: boolean };
                if (syncResult.notRequested) {
                  // Admin no longer wants sync - stop processing files
                  console.log('[Sync] Admin no longer requests sync. Stopping file upload.');
                  break;
                }
                if (item.id) {
                  await removeSyncQueueItem(item.id);
                }
              }
            } catch (err) {
              console.error('[Sync] Failed to sync file:', item.id, err);
            }
          }
        }
      } else {
        console.log('[Sync] Admin has not requested file sync. Files stay local.');
      }
    } catch (error) {
      console.error('[Sync] Error processing sync queue:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Add item to sync queue (for use by other components)
  const queueItem = useCallback(async (type: 'user' | 'file', data: unknown) => {
    await addToSyncQueue({ type, data });
    // Try to process immediately if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      processQueue();
    }
  }, [processQueue]);

  useEffect(() => {
    // Initial sync after 2 seconds (let the app load first)
    const initialTimer = setTimeout(() => {
      processQueue();
    }, 2000);

    // Set up interval for periodic sync (every 15 seconds)
    syncIntervalRef.current = setInterval(processQueue, 15000);

    // Sync when coming back online
    const handleOnline = () => {
      // Small delay to let connection stabilize
      setTimeout(() => {
        processQueue();
      }, 1000);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      clearTimeout(initialTimer);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [processQueue]);

  return { processQueue, queueItem, syncRequestedRef };
}
