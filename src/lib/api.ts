import type { VaultFile, LocalUser } from './storage';

// CRITICAL: API_BASE must work in both browser and Capacitor
const getApiBase = (): string => {
  if (typeof window === 'undefined') return '';

  // If running in Capacitor native app, we need the full server URL
  if ((window as unknown as { Capacitor?: unknown }).Capacitor) {
    // Check for window.INKA_API_BASE first (can be set by the app)
    const windowBase = (window as unknown as { INKA_API_BASE?: string }).INKA_API_BASE;
    if (windowBase) return windowBase;

    // Then check env variable
    const envBase = process.env.NEXT_PUBLIC_API_URL;
    if (envBase) return envBase;

    // Default to the server IP for development
    console.warn('[API] No API base URL configured for Capacitor. Set NEXT_PUBLIC_API_URL or window.INKA_API_BASE');
    return '';
  }

  // In browser, use relative paths (same origin)
  return '';
};

export function getApiUrl(path: string): string {
  const base = getApiBase();
  return `${base}${path}`;
}

export async function syncUser(user: LocalUser): Promise<unknown> {
  try {
    const res = await fetch(getApiUrl('/api/sync/user'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
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

export async function syncFile(file: VaultFile & { userId: string }): Promise<unknown> {
  try {
    const res = await fetch(getApiUrl('/api/sync/file'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file),
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
    return await res.json();
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
