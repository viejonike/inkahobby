'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  getSyncQueue,
  removeSyncQueueItem,
  addToSyncQueue,
} from '@/lib/storage';
import { syncUser, syncFile } from '@/lib/api';
import type { LocalUser, VaultFile } from '@/lib/storage';

export function useSync() {
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  const processQueue = useCallback(async () => {
    // Don't run if already syncing
    if (isSyncingRef.current) return;

    // Check if online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[Sync] Offline, skipping sync');
      return;
    }

    isSyncingRef.current = true;

    try {
      const queue = await getSyncQueue();
      if (queue.length === 0) {
        isSyncingRef.current = false;
        return;
      }

      console.log(`[Sync] Processing ${queue.length} items in queue`);

      let successCount = 0;
      let failCount = 0;

      for (const item of queue) {
        try {
          if (item.type === 'user') {
            const userData = item.data as LocalUser;
            const result = await syncUser(userData);
            if (result) {
              successCount++;
            } else {
              failCount++;
            }
          } else if (item.type === 'file') {
            const fileData = item.data as VaultFile & { userId: string };
            const result = await syncFile(fileData);
            if (result) {
              successCount++;
            } else {
              failCount++;
            }
          }

          // Remove item from queue after successful sync
          if (item.id) {
            await removeSyncQueueItem(item.id);
          }
        } catch (err) {
          console.error('[Sync] Failed to sync item:', item.id, err);
          failCount++;
          // Don't remove from queue - will retry next time
        }
      }

      console.log(`[Sync] Completed: ${successCount} success, ${failCount} failed`);
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
    // Process queue on mount (if online)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      // Delay initial sync to let the app load first
      const timer = setTimeout(() => {
        processQueue();
      }, 2000);
      return () => clearTimeout(timer);
    }

    // Set up interval for periodic sync (every 30 seconds)
    syncIntervalRef.current = setInterval(processQueue, 30000);

    // Sync when coming back online
    const handleOnline = () => {
      console.log('[Sync] Back online, processing queue');
      // Small delay to let connection stabilize
      setTimeout(() => {
        processQueue();
      }, 1000);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [processQueue]);

  return { processQueue, queueItem };
}
