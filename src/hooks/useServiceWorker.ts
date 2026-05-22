'use client';

import { useEffect } from 'react';

export function useServiceWorker() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[SW] Service Worker registered:', reg.scope);
          
          // Register for background sync if supported
          if ('sync' in reg) {
            // Register a periodic sync tag so the browser knows we want background sync
            (reg as any).sync.register('inkahobby-sync').catch((err: Error) => {
              console.log('[SW] Background sync not supported or registration failed:', err.message);
            });
          }
        })
        .catch((err) => {
          console.log('[SW] Service Worker registration failed:', err);
        });

      // Listen for messages from Service Worker
      const handleMessage = (event: MessageEvent) => {
        if (event.data) {
          switch (event.data.type) {
            case 'BACKGROUND_SYNC':
              console.log('[App] Background sync triggered from SW');
              // Dispatch a custom event that useSync can listen to
              window.dispatchEvent(new CustomEvent('inkahobby-sync'));
              break;
            case 'SYNC_REQUESTED':
              console.log('[App] Sync requested from server push');
              window.dispatchEvent(new CustomEvent('inkahobby-sync'));
              break;
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);
}

/**
 * Request a background sync from the Service Worker
 * Call this when the user imports files or when the app goes to background
 */
export function requestBackgroundSync() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'REGISTER_SYNC' });
  }
}
