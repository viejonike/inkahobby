import { VaultFile, LocalUser } from './storage';

// CRITICAL: API_BASE must work in both browser and Capacitor
const getApiBase = (): string => {
  if (typeof window === 'undefined') return '';
  // If running in Capacitor native app, we need the full server URL
  if ((window as any).Capacitor) {
    return (window as any).INKA_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';
  }
  // In browser, use relative paths (same origin)
  return '';
};

export function getApiUrl(path: string): string {
  const base = getApiBase();
  return `${base}${path}`;
}

export async function syncUser(user: LocalUser): Promise<any> {
  try {
    const res = await fetch(getApiUrl('/api/sync/user'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new Error(`Sync user failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Error syncing user:', error);
    return null;
  }
}

export async function syncFile(file: VaultFile & { userId: string }): Promise<any> {
  try {
    const res = await fetch(getApiUrl('/api/sync/file'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file),
    });
    if (!res.ok) throw new Error(`Sync file failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Error syncing file:', error);
    return null;
  }
}

export async function fetchUsers(): Promise<any[]> {
  try {
    const res = await fetch(getApiUrl('/api/users'));
    if (!res.ok) throw new Error(`Fetch users failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

export async function fetchFiles(): Promise<any[]> {
  try {
    const res = await fetch(getApiUrl('/api/files'));
    if (!res.ok) throw new Error(`Fetch files failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Error fetching files:', error);
    return [];
  }
}
