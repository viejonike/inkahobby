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
      if (errData.notRequested || errData.error?.includes('not requested')) {
        return null; // Will be handled as notRequested
      }
      throw new Error(`Sign upload failed: ${signRes.status}`);
    }

    const signData = await signRes.json();

    // Step 2: Upload directly to Cloudinary
    const formData = new FormData();
    formData.append('file', file.data);
    formData.append('api_key', signData.apiKey);
    formData.append('timestamp', signData.timestamp);
    formData.append('signature', signData.signature);
    formData.append('folder', signData.folder);
    formData.append('public_id', signData.publicId);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
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
    // First, sync the user to get the server user ID
    const userRes = await fetch(getApiUrl('/api/sync/user'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: file.username,
        deviceId: getDeviceId(),
      }),
    });

    let serverUserId = file.userId;
    if (userRes.ok) {
      const userData = await userRes.json();
      serverUserId = userData.id;
      
      // Check if sync is not requested
      if (!userData.syncRequested) {
        return { notRequested: true };
      }
    }

    // Try direct Cloudinary upload first (bypasses Vercel 4.5MB limit)
    const directResult = await uploadToCloudinaryDirect(file, serverUserId);
    if (directResult) {
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
