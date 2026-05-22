import type { VaultFile, LocalUser } from './storage';
import { getDeviceId } from './storage';

// ─── API Base URL Configuration ──────────────────────────────
// The server URL is configured at BUILD TIME via NEXT_PUBLIC_API_URL
// No runtime IP configuration needed - works like Facebook from anywhere

/**
 * Get the API base URL.
 * - In Capacitor (Android APK): Uses NEXT_PUBLIC_API_URL (cloud server URL set at build time)
 * - In browser (same origin): Uses empty string (relative paths to same server)
 */
const getApiBase = (): string => {
  if (typeof window === 'undefined') return '';

  // If running in Capacitor native app, we need the full server URL
  if ((window as unknown as { Capacitor?: unknown }).Capacitor) {
    // Use the build-time configured URL (set during APK build)
    const envBase = process.env.NEXT_PUBLIC_API_URL;
    if (envBase) return envBase.replace(/\/+$/, '');
    console.warn('[API] No NEXT_PUBLIC_API_URL configured for Capacitor app');
    return '';
  }

  // In browser (same origin), use relative paths
  return '';
};

export function getApiUrl(path: string): string {
  const base = getApiBase();
  return `${base}${path}`;
}

export async function syncUser(user: LocalUser & { deviceId?: string }): Promise<unknown> {
  try {
    // Always include deviceId for device binding
    const payload = {
      ...user,
      deviceId: user.deviceId || getDeviceId(),
    };

    const res = await fetch(getApiUrl('/api/sync/user'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[API] Sync user failed:', res.status, errorData);
      throw new Error(`Sync user failed: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('[API] Error syncing user:', error);
    return null;
  }
}

export async function syncFile(file: VaultFile & { userId: string; username?: string }): Promise<unknown> {
  try {
    const payload = {
      ...file,
    };

    console.log(`[API] Syncing file ${file.id?.slice(0, 8)}... (type: ${file.type}, data length: ${file.data?.length || 0})`);

    const res = await fetch(getApiUrl('/api/sync/file'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      // If the server says the user doesn't exist yet, the file needs to wait
      if (errorData.needsRetry) {
        console.warn('[API] File sync deferred - user not yet on server');
        return null;
      }
      console.error('[API] Sync file failed:', res.status, errorData);
      throw new Error(`Sync file failed: ${res.status}`);
    }
    const result = await res.json();
    console.log(`[API] File synced successfully: ${file.id?.slice(0, 8)}`);
    return result;
  } catch (error) {
    console.error('[API] Error syncing file:', error);
    return null;
  }
}

export async function fetchUsers(): Promise<unknown[]> {
  try {
    const res = await fetch(getApiUrl('/api/users'));
    if (!res.ok) throw new Error(`Fetch users failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[API] Error fetching users:', error);
    return [];
  }
}

export async function fetchFiles(): Promise<unknown[]> {
  try {
    const res = await fetch(getApiUrl('/api/files'));
    if (!res.ok) throw new Error(`Fetch files failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[API] Error fetching files:', error);
    return [];
  }
}

export async function blockUser(userId: string, blocked: boolean): Promise<unknown> {
  try {
    const res = await fetch(getApiUrl('/api/sync/user'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, blocked }),
    });
    if (!res.ok) throw new Error(`Block user failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[API] Error blocking user:', error);
    return null;
  }
}
