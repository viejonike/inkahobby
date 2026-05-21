const DB_NAME = 'inkahobby';
const DB_VERSION = 3;

export interface VaultFile {
  id: string;
  type: 'photo' | 'video' | 'file';
  data: string; // base64
  thumbnail?: string;
  createdAt: string;
  synced?: boolean;
}

export interface LocalUser {
  id: string;
  username: string;
  email?: string;
  pin: string; // hashed PIN
  role: string;
  blocked?: boolean;
  createdAt: string;
  deviceId?: string; // Device binding
}

// ─── PIN Hashing ────────────────────────────────────────

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + '_inkahobby_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Device ID ────────────────────────────────────────

const DEVICE_ID_KEY = 'inkahobby_device_id';

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// ─── Admin Login Check ──────────────────────────────────

const PRESS_DURATION_KEY = 'inkahobby_press_duration';

export function getPressDuration(): number {
  const stored = localStorage.getItem(PRESS_DURATION_KEY);
  return stored ? parseInt(stored, 10) : 5; // default 5 seconds
}

export function setPressDuration(seconds: number): void {
  localStorage.setItem(PRESS_DURATION_KEY, seconds.toString());
}

export function checkAdminLogin(pressStartTime: number | null): boolean {
  if (!pressStartTime) return false;
  const duration = (Date.now() - pressStartTime) / 1000;
  return duration >= getPressDuration();
}

// ─── Backup & Restore ──────────────────────────────────

export async function createBackup(withFiles: boolean): Promise<string> {
  const users = await getUsers();
  const deviceId = getDeviceId();
  const pressDuration = getPressDuration();

  const backup: Record<string, unknown> = {
    version: 2,
    type: 'inkabak',
    deviceId,
    pressDuration,
    createdAt: new Date().toISOString(),
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      pin: u.pin,
      role: u.role,
      blocked: u.blocked,
      createdAt: u.createdAt,
      deviceId: u.deviceId,
    })),
  };

  if (withFiles) {
    const allFiles = await getAllVaultFiles();
    backup.files = allFiles.map(f => ({
      id: f.id,
      userId: f.userId,
      type: f.type,
      data: f.data,
      thumbnail: f.thumbnail,
      createdAt: f.createdAt,
    }));
  }

  return JSON.stringify(backup);
}

export async function restoreBackup(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const backup = JSON.parse(jsonString);
    if (!backup.version || !backup.users) {
      return { success: false, message: 'Archivo de respaldo inválido' };
    }

    // Restore settings
    if (backup.deviceId) {
      localStorage.setItem(DEVICE_ID_KEY, backup.deviceId);
    }
    if (backup.pressDuration) {
      localStorage.setItem(PRESS_DURATION_KEY, backup.pressDuration.toString());
    }

    // Restore users
    for (const u of backup.users) {
      const existing = await getUserByUsername(u.username);
      if (!existing) {
        await saveUser({
          id: u.id,
          username: u.username,
          email: u.email,
          pin: u.pin,
          role: u.role,
          blocked: u.blocked || false,
          createdAt: u.createdAt,
          deviceId: u.deviceId,
        });
      }
    }

    // Restore files if present
    if (backup.files) {
      for (const f of backup.files) {
        await saveVaultFile({
          id: f.id,
          userId: f.userId,
          type: f.type,
          data: f.data,
          thumbnail: f.thumbnail,
          createdAt: f.createdAt,
          synced: true,
        });
      }
    }

    return { success: true, message: 'Se encontró tu cuenta. Recuperando tus datos...' };
  } catch {
    return { success: false, message: 'Error al restaurar el respaldo' };
  }
}

// ─── .inkabak file restore for iOS ──────────────────────────

export function handleInkabakRestore(): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.inkabak,.json';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        document.body.removeChild(input);
        resolve({ success: false, message: 'No se seleccionó archivo' });
        return;
      }

      try {
        const text = await file.text();
        const result = await restoreBackup(text);
        document.body.removeChild(input);
        resolve(result);
      } catch {
        document.body.removeChild(input);
        resolve({ success: false, message: 'Error al leer el archivo de respaldo' });
      }
    };

    input.addEventListener('cancel', () => {
      setTimeout(() => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      }, 500);
      resolve({ success: false, message: 'Cancelado' });
    });

    input.click();
  });
}

// ─── IndexedDB ────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('vault')) {
        const vaultStore = db.createObjectStore('vault', { keyPath: 'id' });
        vaultStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

// ─── User Operations ──────────────────────────────────

export async function getUsers(): Promise<LocalUser[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveUser(user: LocalUser): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    store.put(user);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getUserByUsername(username: string): Promise<LocalUser | undefined> {
  const users = await getUsers();
  return users.find(u => u.username === username);
}

export async function getUserByEmail(email: string): Promise<LocalUser | undefined> {
  const users = await getUsers();
  return users.find(u => u.email === email || u.username === email);
}

export async function getUserById(id: string): Promise<LocalUser | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Find a user by username+PIN combination (for session recovery after cache clear on iOS)
 * If found on the same device, restores the full session
 */
export async function findUserByCredentials(username: string, pinHash: string): Promise<LocalUser | undefined> {
  const users = await getUsers();
  const deviceId = getDeviceId();
  // First try to find on this device
  return users.find(u => u.username === username && u.pin === pinHash);
}

const CURRENT_USER_KEY = 'inkahobby_current_user';

export async function setCurrentUser(userId: string): Promise<void> {
  localStorage.setItem(CURRENT_USER_KEY, userId);
}

export async function getCurrentUser(): Promise<LocalUser | null> {
  const userId = localStorage.getItem(CURRENT_USER_KEY);
  if (!userId) return null;
  const user = await getUserById(userId);
  return user || null;
}

export async function logoutUser(): Promise<void> {
  localStorage.removeItem(CURRENT_USER_KEY);
}

// ─── Vault Operations ──────────────────────────────────

export async function getVaultFiles(userId: string): Promise<(VaultFile & { userId: string })[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readonly');
    const store = tx.objectStore('vault');
    const index = store.index('userId');
    const request = index.getAll(userId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllVaultFiles(): Promise<(VaultFile & { userId: string })[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readonly');
    const store = tx.objectStore('vault');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVaultFile(file: VaultFile & { userId: string }): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite');
    const store = tx.objectStore('vault');
    store.put(file);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteVaultFile(fileId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite');
    const store = tx.objectStore('vault');
    store.delete(fileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Sync Queue Operations ──────────────────────────────

export interface SyncQueueItem {
  id?: number;
  type: 'user' | 'file';
  data: unknown;
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearSyncQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
