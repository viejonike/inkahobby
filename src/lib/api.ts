import type { VaultFile, LocalUser } from './storage';
import { getDeviceId } from './storage';

// ─── Server URL Configuration ──────────────────────────────

const SERVER_URL_KEY = 'inkahobby_server_url';

/**
 * Get the configured server URL.
 * Priority:
 * 1. localStorage (user-configured from app settings)
 * 2. window.INKA_API_BASE (runtime injection)
 * 3. process.env.NEXT_PUBLIC_API_URL (build time)
 * 4. Auto-detect from current URL (same origin)
 * 5. Default fallback for Capacitor
 */
export function getServerUrl(): string {
  if (typeof window === 'undefined') return '';

  // Check localStorage first (user-configured)
  const stored = localStorage.getItem(SERVER_URL_KEY);
  if (stored) return stored;

  // Check runtime injection
  const windowBase = (window as unknown as { INKA_API_BASE?: string }).INKA_API_BASE;
  if (windowBase) return windowBase;

  // Check env variable (build time)
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase) return envBase;

  return '';
}

export function setServerUrl(url: string): void {
  if (typeof window === 'undefined') return;
  if (url.trim()) {
    // Remove trailing slash
    const cleanUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem(SERVER_URL_KEY, cleanUrl);
  } else {
    localStorage.removeItem(SERVER_URL_KEY);
  }
}

/**
 * Auto-detect server URL from the current page URL.
 * If running in Capacitor, tries to find the server on the local network.
 */
export function autoDetectServerUrl(): string {
  if (typeof window === 'undefined') return '';

  // If running in browser (not Capacitor), use same origin
  if (!(window as unknown as { Capacitor?: unknown }).Capacitor) {
    return window.location.origin;
  }

  // Running in Capacitor native app
  // Check if we have a stored URL first
  const stored = getServerUrl();
  if (stored) return stored;

  // Check runtime injection
  const windowBase = (window as unknown as { INKA_API_BASE?: string }).INKA_API_BASE;
  if (windowBase) return windowBase;

  // Check env variable
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase) return envBase;

  // Default fallback for Capacitor
  return 'http://192.168.1.100:3000';
}

// CRITICAL: API_BASE must work in both browser and Capacitor native app
const getApiBase = (): string => {
  if (typeof window === 'undefined') return '';

  // If running in Capacitor native app, we need the full server URL
  if ((window as unknown as { Capacitor?: unknown }).Capacitor) {
    return autoDetectServerUrl();
  }

  // In browser (same origin), use relative paths
  return '';
};

export function getApiUrl(path: string): string {
  const base = getApiBase();
  return `${base}${path}`;
}

/**
 * Test connection to the server
 */
export async function testServerConnection(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    if (res.ok) {
      const data = await res.json();
      if (data.message) {
        return { ok: true, message: 'Conexión exitosa al servidor' };
      }
    }
    return { ok: false, message: `Error: servidor respondió con estado ${res.status}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    if (msg.includes('timeout') || msg.includes('abort')) {
      return { ok: false, message: 'Tiempo de espera agotado. Verifica la IP y que el servidor esté corriendo.' };
    }
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return { ok: false, message: 'No se pudo conectar. Verifica que estés en la misma red WiFi y la IP sea correcta.' };
    }
    return { ok: false, message: `Error de conexión: ${msg}` };
  }
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
