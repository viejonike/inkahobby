import type { VaultFile, LocalUser } from './storage';
import { getDeviceId } from './storage';

// ─── API Base URL Configuration ──────────────────────────────
// The server URL is configured at BUILD TIME via NEXT_PUBLIC_API_URL
// No runtime IP configuration needed - works like Facebook from anywhere

// HARDCODED FALLBACK: If NEXT_PUBLIC_API_URL wasn't embedded at build time,
// we use this hardcoded URL. This ensures the APK ALWAYS can reach the server.
const HARDCODED_SERVER_URL = 'https://inkahobby.vercel.app';

/**
 * Check if we're running in a Capacitor native app (APK)
 */
function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;

  // Method 1: Official Capacitor native platform detection
  try {
    const win = window as any;
    if (win.Capacitor && typeof win.Capacitor.isNativePlatform === 'function' && win.Capacitor.isNativePlatform()) {
      return true;
    }
  } catch {}

  // Method 2: Check if running in Capacitor WebView by origin
  try {
    const origin = window.location.origin;
    if (origin === 'https://localhost' || window.location.protocol === 'file:') {
      return true;
    }
  } catch {}

  return false;
}

/**
 * Get the API base URL.
 * - In Capacitor (Android APK): Uses NEXT_PUBLIC_API_URL, then localStorage, then hardcoded fallback
 * - In browser (same origin): Uses empty string (relative paths to same server)
 *
 * Multiple fallback methods for MAXIMUM reliability on APK:
 * 1. process.env.NEXT_PUBLIC_API_URL (embedded at build time)
 * 2. localStorage 'inkahobby_api_url' (set during registration)
 * 3. HARDCODED_SERVER_URL (always available as last resort)
 */
const getApiBase = (): string => {
  if (typeof window === 'undefined') return '';

  // In browser (same origin), use relative paths
  if (!isCapacitorNative()) {
    return '';
  }

  // ─── We're in Capacitor native app (APK) ───
  // Try multiple sources for the server URL

  // Source 1: Build-time environment variable
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase) {
    const url = envBase.replace(/\/+$/, '');
    // Also store in localStorage as backup
    try { localStorage.setItem('inkahobby_api_url', url); } catch {}
    console.log('[API] Using build-time URL:', url);
    return url;
  }

  // Source 2: Previously stored URL in localStorage
  try {
    const storedUrl = localStorage.getItem('inkahobby_api_url');
    if (storedUrl) {
      console.log('[API] Using stored URL:', storedUrl);
      return storedUrl.replace(/\/+$/, '');
    }
  } catch {}

  // Source 3: HARDCODED fallback - ALWAYS works even if build was wrong
  console.log('[API] Using hardcoded server URL fallback:', HARDCODED_SERVER_URL);
  try { localStorage.setItem('inkahobby_api_url', HARDCODED_SERVER_URL); } catch {}
  return HARDCODED_SERVER_URL;
};

export function getApiUrl(path: string): string {
  const base = getApiBase();
  return `${base}${path}`;
}

/**
 * Test connectivity to the server.
 * Returns true if the server is reachable.
 */
export async function testServerConnection(): Promise<{ ok: boolean; url: string; error?: string }> {
  const url = getApiUrl('/api');
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
    return { ok: res.ok, url };
  } catch (err: any) {
    return { ok: false, url, error: err?.message || 'Unknown error' };
  }
}

// ─── Cloudinary Direct Upload ──────────────────────────────

/**
 * Upload a file directly to Cloudinary (bypasses server 4.5MB body limit)
 * 1. Get signed upload params from our server
 * 2. Upload directly to Cloudinary from the client
 * 3. Register the file in our database
 */
async function uploadToCloudinaryDirect(
  file: VaultFile & { userId: string; username?: string },
  serverUserId: string
): Promise<{ cloudinaryUrl: string; cloudinaryPublicId: string } | null> {
  try {
    // Step 1: Get signed upload params
    const folder = `inkahobby/${serverUserId}`;
    const publicId = `${file.type}_${file.id?.slice(0, 12) || Date.now()}`;

    console.log(`[API] Getting upload signature for file: ${file.id?.slice(0, 8)}... (user: ${file.username}, folder: ${folder})`);

    const signRes = await fetch(getApiUrl('/api/cloudinary/sign-upload'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder,
        publicId,
        username: file.username,
      }),
    });

    if (!signRes.ok) {
      const errData = await signRes.json().catch(() => ({}));
      if (errData.notRequested || errData.error?.includes('not requested') || errData.error?.includes('Sync not requested')) {
        console.log('[API] Admin no longer requests sync. Stopping direct upload.');
        // Return special marker so caller knows it's notRequested (not a failure)
        return { cloudinaryUrl: '', cloudinaryPublicId: '__NOT_REQUESTED__' } as any;
      }
      console.error('[API] Sign upload failed:', signRes.status, errData);
      throw new Error(`Sign upload failed: ${signRes.status}`);
    }

    const signData = await signRes.json();

    // Step 2: Upload directly to Cloudinary using URL-encoded format
    // (Cloudinary doesn't accept base64 data URI in multipart for the file parameter)
    const params = new URLSearchParams();
    params.append('file', file.data); // base64 data URI string
    params.append('api_key', signData.apiKey);
    params.append('timestamp', signData.timestamp);
    params.append('signature', signData.signature);
    params.append('folder', signData.folder);
    if (signData.publicId) {
      params.append('public_id', signData.publicId);
    }

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/auto/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!uploadRes.ok) {
      throw new Error(`Cloudinary upload failed: ${uploadRes.status}`);
    }

    const uploadData = await uploadRes.json();

    // Step 3: Register file in our database
    const registerRes = await fetch(getApiUrl('/api/sync/file-register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: file.id,
        userId: file.userId,
        username: file.username,
        type: file.type,
        cloudinaryUrl: uploadData.secure_url,
        cloudinaryPublicId: uploadData.public_id,
        thumbnailUrl: null,
        createdAt: file.createdAt,
      }),
    });

    if (!registerRes.ok) {
      const errData = await registerRes.json().catch(() => ({}));
      if (errData.notRequested) {
        return null; // notRequested - will be handled
      }
      throw new Error(`Register file failed: ${registerRes.status}`);
    }

    console.log(`[API] File uploaded to Cloudinary: ${uploadData.public_id}`);

    return {
      cloudinaryUrl: uploadData.secure_url,
      cloudinaryPublicId: uploadData.public_id,
    };
  } catch (error) {
    console.error('[API] Direct Cloudinary upload failed:', error);
    return null;
  }
}

export async function syncUser(user: LocalUser & { deviceId?: string }): Promise<unknown> {
  try {
    // Always include deviceId for device binding
    const payload = {
      ...user,
      deviceId: user.deviceId || getDeviceId(),
    };

    const apiUrl = getApiUrl('/api/sync/user');
    console.log(`[API] Syncing user: ${user.username} to ${apiUrl}`);

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[API] Sync user failed:', res.status, errorData);
      throw new Error(`Sync user failed: ${res.status}`);
    }
    const result = await res.json();
    console.log(`[API] User synced successfully: ${user.username} (server ID: ${(result as any)?.id})`);
    return result;
  } catch (error) {
    console.error('[API] Error syncing user:', error);
    return null;
  }
}

export async function syncFile(file: VaultFile & { userId: string; username?: string; pin?: string }): Promise<unknown> {
  try {
    // Try direct Cloudinary upload first (bypasses Vercel 4.5MB limit)
    // This also validates the user via username in the sign-upload request
    const directResult = await uploadToCloudinaryDirect(file, file.userId);
    if (directResult) {
      // Check for notRequested marker
      if (directResult.cloudinaryPublicId === '__NOT_REQUESTED__') {
        return { notRequested: true };
      }
      return { 
        id: file.id, 
        synced: true,
        cloudinaryUrl: directResult.cloudinaryUrl,
        cloudinaryPublicId: directResult.cloudinaryPublicId,
      };
    }

    // Fallback: try server-side upload (for small files or if direct upload fails)
    const payload = { ...file };

    console.log(`[API] Fallback: Syncing file ${file.id?.slice(0, 8)}... via server (type: ${file.type}, data length: ${file.data?.length || 0})`);

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
      if (errorData.notRequested) {
        return { notRequested: true };
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
