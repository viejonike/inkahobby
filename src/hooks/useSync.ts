'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  getSyncQueue,
  removeSyncQueueItem,
  clearSyncQueue,
  addToSyncQueue,
} from '@/lib/storage';
import { syncUser, syncFile } from '@/lib/api';
import type { LocalUser, VaultFile } from '@/lib/storage';

export function useSync() {
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processQueue = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
      const queue = await getSyncQueue();
      if (queue.length === 0) return;

      for (const item of queue) {
        try {
          if (item.type === 'user') {
            await syncUser(item.data as LocalUser);
          } else if (item.type === 'file') {
            await syncFile(item.data as VaultFile & { userId: string });
          }
          if (item.id) {
            await removeSyncQueueItem(item.id);
          }
        } catch (err) {
          console.error('Failed to sync item:', item.id, err);
        }
      }
    } catch (error) {
      console.error('Error processing sync queue:', error);
    }
  }, []);

  useEffect(() => {
    // Process queue on mount
    processQueue();

    // Set up interval for periodic sync
    syncIntervalRef.current = setInterval(processQueue, 30000); // Every 30 seconds

    // Sync when coming back online
    const handleOnline = () => {
      processQueue();
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

  return { processQueue };
}
