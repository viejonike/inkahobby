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

      // Sync all users first
      for (const item of userItems) {
        try {
          const userData = item.data as LocalUser;
          const result = await syncUser(userData);
          if (result) {
            if (item.id) {
              await removeSyncQueueItem(item.id);
            }
          }
        } catch (err) {
          console.error('[Sync] Failed to sync user:', item.id, err);
        }
      }

      // Then sync files
      for (const item of fileItems) {
        try {
          const fileData = item.data as VaultFile & { userId: string };
          const result = await syncFile(fileData);
          if (result) {
            if (item.id) {
              await removeSyncQueueItem(item.id);
            }
          }
        } catch (err) {
          console.error('[Sync] Failed to sync file:', item.id, err);
        }
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
    // Process queue on mount (if online)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      // Delay initial sync to let the app load first
      const timer = setTimeout(() => {
        processQueue();
      }, 2000);
      // Clean up timer on unmount
      const cleanupTimer = () => clearTimeout(timer);
      // Don't return here - we need to set up the interval too!
    }

    // Set up interval for periodic sync (every 15 seconds - invisible, no UI)
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
