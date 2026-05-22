'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LoginScreen from '@/components/LoginScreen';
import UserRegistration from '@/components/UserRegistration';
import PinEntry from '@/components/PinEntry';
import VaultScreen from '@/components/VaultScreen';
import AdminPanel from '@/components/AdminPanel';
import SuperAdminPanel from '@/components/SuperAdminPanel';
import HelpScreen from '@/components/HelpScreen';
import { useSync } from '@/hooks/useSync';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import {
  getUsers,
  saveUser,
  getUserByUsername,
  getCurrentUser,
  setCurrentUser,
  logoutUser,
  addToSyncQueue,
  hashPin,
  getDeviceId,
  createBackup,
  restoreBackup,
  handleInkabakRestore,
  autoBackup,
} from '@/lib/storage';
import { syncUser, getApiUrl } from '@/lib/api';
import type { LocalUser } from '@/lib/storage';

type Screen = 'loading' | 'login' | 'help' | 'registration' | 'pin' | 'vault' | 'admin' | 'superadmin';

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [currentUser, setCurrentUserState] = useState<LocalUser | null>(null);
  const [error, setError] = useState('');
  const [localUserForPin, setLocalUserForPin] = useState<LocalUser | null>(null);
  const { processQueue } = useSync();
  useServiceWorker();

  // Ref to track if user is currently exporting (prevent auto-lock)
  const isExportingRef = useRef(false);

  // Key to force re-mount LoginScreen after auto-lock (fixes freeze bug)
  const [loginKey, setLoginKey] = useState(0);

  // Check for existing user on mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          // Check if user is blocked - refresh from server
          try {
            const res = await fetch(getApiUrl('/api/users'));
            if (res.ok) {
              const serverUsers = await res.json() as Array<{
                id: string;
                username: string;
                pin: string;
                role: string;
                blocked?: boolean;
                email?: string;
                createdAt: string;
              }>;
              const serverUser = serverUsers.find((u) => u.id === user.id || u.username === user.username);
              if (serverUser) {
                const updatedUser: LocalUser = {
                  id: serverUser.id,
                  username: serverUser.username,
                  email: serverUser.email,
                  pin: serverUser.pin,
                  role: serverUser.role,
                  blocked: serverUser.blocked,
                  createdAt: serverUser.createdAt,
                };
                await saveUser(updatedUser);
                // User confirmed on server - set flag for sync system
                try { localStorage.setItem('inkahobby_user_on_server', 'true'); } catch {}

                if (updatedUser.blocked) {
                  await logoutUser();
                  setScreen('login');
                  return;
                }

                setCurrentUserState(updatedUser);
                if (updatedUser.role === 'superadmin') {
                  setScreen('superadmin');
                } else if (updatedUser.role === 'admin') {
                  setScreen('admin');
                } else {
                  setScreen('vault');
                }
                return;
              }
            }
          } catch {
            // Server not available, use local data
          }

          if (user.blocked) {
            setScreen('login');
            return;
          }

          setCurrentUserState(user);
          if (user.role === 'superadmin') {
            setScreen('superadmin');
          } else if (user.role === 'admin') {
            setScreen('admin');
          } else {
            setScreen('vault');
          }
        } else {
          setScreen('login');
        }
      } catch {
        setScreen('login');
      }
    };
    checkUser();
  }, []);

  // Seed super admin on first load
  useEffect(() => {
    fetch(getApiUrl('/api/seed'), { method: 'POST' }).catch(() => {});
  }, []);

  // Process sync queue on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      processQueue().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [processQueue]);

  // Auto-backup on vault entry (runs once per day max)
  useEffect(() => {
    if (screen === 'vault' && currentUser) {
      autoBackup().catch(() => {});
    }
  }, [screen, currentUser]);

  // Auto-lock: detect when app goes to background and comes back
  const wasHiddenRef = useRef(false);
  const hiddenScreenRef = useRef<Screen>('login');
  const hiddenTimeRef = useRef(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Record that the page was hidden and which screen we were on
        wasHiddenRef.current = true;
        hiddenScreenRef.current = screen;
        hiddenTimeRef.current = Date.now();
      } else if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        // Page became visible again
        wasHiddenRef.current = false;
        const prevScreen = hiddenScreenRef.current;
        const timeHidden = Date.now() - hiddenTimeRef.current;
        
        // Only auto-lock if:
        // 1. User is not currently exporting (file picker open)
        // 2. We were on a sensitive screen
        // 3. The app was hidden for more than 5 minutes (allows sync to continue)
        // IMPORTANT: Keep this long enough so sync can complete while the app is backgrounded
        if (!isExportingRef.current && timeHidden > 5 * 60 * 1000 && ['vault', 'admin', 'superadmin', 'pin', 'registration'].includes(prevScreen)) {
          logoutUser().then(() => {
            setCurrentUserState(null);
            setLocalUserForPin(null);
            setLoginKey(k => k + 1); // Force re-mount LoginScreen to fix freeze
            setScreen('login');
            setError('');
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [screen]);

  // Login with email + password (for admin accounts ONLY)
  // Non-admin users ALWAYS get "Error de conexión"
  const handleLogin = async (email: string, password: string) => {
    setError('');

    // If email/password are empty (from register button), show fake error
    if (!email || !password) {
      setError('Error de conexión. No se pudo conectar al servidor. Intenta más tarde.');
      return;
    }

    try {
      const hashedPassword = await hashPin(password);

      // Check server for admin accounts (email-based login)
      try {
        const res = await fetch(getApiUrl('/api/users'));
        if (res.ok) {
          const users = await res.json() as Array<{
            id: string;
            username: string;
            email?: string;
            pin: string;
            role: string;
            blocked?: boolean;
            createdAt: string;
          }>;

          // Find user by email or username match with admin credentials
          const serverUser = users.find(
            (u) =>
              (u.email === email || u.username === email) &&
              u.pin === hashedPassword &&
              (u.role === 'admin' || u.role === 'superadmin')
          );

          if (serverUser) {
            if (serverUser.blocked) {
              setError('Cuenta bloqueada. Tu cuenta ha sido suspendida.');
              return;
            }

            const localUserData: LocalUser = {
              id: serverUser.id,
              username: serverUser.username,
              email: serverUser.email,
              pin: serverUser.pin,
              role: serverUser.role,
              blocked: serverUser.blocked,
              createdAt: serverUser.createdAt,
            };
            await saveUser(localUserData);
            await setCurrentUser(localUserData.id);
            setCurrentUserState(localUserData);

            if (localUserData.role === 'superadmin') {
              setScreen('superadmin');
            } else {
              setScreen('admin');
            }
            return;
          }
        }
      } catch {
        // Server not available
      }

      // Always show fake connection error for non-admin users
      setError('Error de conexión. No se pudo conectar al servidor. Intenta más tarde.');
    } catch {
      setError('Error de conexión. No se pudo conectar al servidor. Intenta más tarde.');
    }
  };

  // Handle long-press on Help button → Secret access
  const handleSecretAccess = async () => {
    setError('');

    // Check if user already exists locally
    const users = await getUsers();
    const regularUsers = users.filter(u => u.role === 'user');

    if (regularUsers.length > 0) {
      // User exists → go to PIN entry
      setLocalUserForPin(regularUsers[0]);
      setScreen('pin');
    } else {
      // First time → go to registration
      setScreen('registration');
    }
  };

  // Handle PIN correct
  const handlePinCorrect = async () => {
    if (!localUserForPin) return;

    // Check if blocked on server
    try {
      const res = await fetch(getApiUrl('/api/users'));
      if (res.ok) {
        const serverUsers = await res.json() as Array<{
          id: string;
          username: string;
          pin: string;
          role: string;
          blocked?: boolean;
          email?: string;
          createdAt: string;
        }>;
        const serverUser = serverUsers.find(u => u.id === localUserForPin.id || u.username === localUserForPin.username);
        if (serverUser) {
          const updatedUser: LocalUser = {
            id: serverUser.id,
            username: serverUser.username,
            email: serverUser.email,
            pin: serverUser.pin,
            role: serverUser.role,
            blocked: serverUser.blocked,
            createdAt: serverUser.createdAt,
          };
          await saveUser(updatedUser);
          // User confirmed on server - set flag for sync system
          try { localStorage.setItem('inkahobby_user_on_server', 'true'); } catch {}

          if (updatedUser.blocked) {
            setError('Cuenta bloqueada.');
            setScreen('login');
            setLocalUserForPin(null);
            return;
          }

          await setCurrentUser(updatedUser.id);
          setCurrentUserState(updatedUser);
          setLocalUserForPin(null);

          if (updatedUser.role === 'superadmin') {
            setScreen('superadmin');
          } else if (updatedUser.role === 'admin') {
            setScreen('admin');
          } else {
            setScreen('vault');
          }
          return;
        }
      }
    } catch {
      // Server not available
    }

    if (localUserForPin.blocked) {
      setError('Cuenta bloqueada.');
      setScreen('login');
      setLocalUserForPin(null);
      return;
    }

    await setCurrentUser(localUserForPin.id);
    setCurrentUserState(localUserForPin);
    setLocalUserForPin(null);
    setScreen('vault');
  };

  // Handle registration
  const handleRegister = async (username: string, pin: string) => {
    setError('');
    try {
      // Check if username exists locally
      const existing = await getUserByUsername(username);
      if (existing) {
        setError('El nombre de usuario ya existe');
        return;
      }

      const hashedPin = await hashPin(pin);
      const deviceId = getDeviceId();

      const newUser: LocalUser = {
        id: crypto.randomUUID(),
        username,
        pin: hashedPin,
        role: 'user',
        blocked: false,
        createdAt: new Date().toISOString(),
      };

      await saveUser(newUser);
      await addToSyncQueue({ type: 'user', data: { ...newUser, deviceId } });
      await setCurrentUser(newUser.id);
      setCurrentUserState(newUser);

      // Store the API URL in localStorage as backup for APK
      try {
        const apiUrl = getApiUrl('/api');
        if (apiUrl && apiUrl.startsWith('http')) {
          const baseUrl = apiUrl.replace('/api', '');
          localStorage.setItem('inkahobby_api_url', baseUrl);
        }
      } catch {}

      // Reset user-on-server flag so sync system will verify
      try { localStorage.removeItem('inkahobby_user_on_server'); } catch {}

      // Try to sync to server immediately with AGGRESSIVE RETRIES
      // This is critical for APK - the user MUST exist on the server
      // We do 5 retries with increasing delays and test connectivity first
      const syncUserWithRetry = async (retries = 5): Promise<void> => {
        for (let i = 0; i < retries; i++) {
          try {
            // Test connectivity on first attempt
            if (i === 0) {
              const apiUrl = getApiUrl('/api');
              console.log(`[Register] Testing server connectivity: ${apiUrl}`);
              try {
                const testRes = await fetch(apiUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
                console.log(`[Register] Server connectivity test: ${testRes.ok ? 'OK' : 'FAILED'} (${testRes.status})`);
              } catch (testErr) {
                console.warn('[Register] Server connectivity test failed:', testErr);
              }
            }

            const result = await syncUser({ ...newUser, deviceId } as LocalUser & { deviceId: string });
            if (result) {
              console.log(`[Register] User synced to server on attempt ${i + 1}`);
              try { localStorage.setItem('inkahobby_user_on_server', 'true'); } catch {}
              return;
            }
            console.warn(`[Register] User sync attempt ${i + 1} returned null`);
          } catch (err) {
            console.warn(`[Register] User sync attempt ${i + 1} failed:`, err);
          }
          // Wait before retry with increasing delay (1s, 2s, 3s, 4s, 5s)
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
          }
        }
        console.warn('[Register] Could not sync user to server after 5 retries. Sync will retry in background via useSync hook.');
      };

      // Run sync in background (don't block registration)
      syncUserWithRetry().catch(() => {});
      processQueue().catch(() => {});

      // Auto-download .inkabak backup for iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        try {
          const backupStr = await createBackup(true);
          const blob = new Blob([backupStr], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `inkahobby_backup_${username}.inkabak`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch {
          // Backup creation failed silently
        }
      }

      setScreen('vault');
    } catch {
      setError('Error al crear la cuenta');
    }
  };

  // Handle restore from .inkabak backup (iOS session recovery)
  const handleRestoreBackup = async () => {
    try {
      const result = await handleInkabakRestore();
      if (result.success) {
        // After restore, check if we have a user and redirect
        const user = await getCurrentUser();
        if (user) {
          setCurrentUserState(user);
          if (user.role === 'superadmin') {
            setScreen('superadmin');
          } else if (user.role === 'admin') {
            setScreen('admin');
          } else {
            setScreen('vault');
          }
        } else {
          // Try to find any user after restore
          const users = await getUsers();
          const regularUsers = users.filter(u => u.role === 'user');
          if (regularUsers.length > 0) {
            setLocalUserForPin(regularUsers[0]);
            setScreen('pin');
          }
        }
        setError('');
      } else {
        setError(result.message);
      }
    } catch {
      setError('Error al restaurar el respaldo');
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUserState(null);
    setLocalUserForPin(null);
    setLoginKey(k => k + 1); // Force re-mount to prevent freeze
    setScreen('login');
    setError('');
  };

  const handleAutoLock = async () => {
    await logoutUser();
    setCurrentUserState(null);
    setLocalUserForPin(null);
    setLoginKey(k => k + 1); // Force re-mount to prevent freeze
    setScreen('login');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a]">
      <AnimatePresence mode="wait">
        {screen === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center bg-[#0f0f1a]"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#e94560] to-[#c23152] mx-auto mb-6 flex items-center justify-center shadow-lg shadow-[#e94560]/30"
              >
                <span className="text-2xl font-bold text-white">IH</span>
              </motion.div>
              <div className="w-6 h-6 border-2 border-[#e94560] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/30 text-sm">Cargando InkaHobby...</p>
            </div>
          </motion.div>
        )}

        {screen === 'login' && (
          <motion.div key={`login-${loginKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LoginScreen
              onLogin={handleLogin}
              onHelp={() => {
                setError('');
                setScreen('help');
              }}
              onSecretAccess={handleSecretAccess}
              onRestoreBackup={handleRestoreBackup}
              error={error}
            />
          </motion.div>
        )}

        {screen === 'help' && (
          <motion.div key="help" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <HelpScreen
              onBack={() => {
                setError('');
                setScreen('login');
              }}
            />
          </motion.div>
        )}

        {screen === 'registration' && (
          <motion.div key="registration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <UserRegistration
              onRegister={handleRegister}
              onBack={() => {
                setError('');
                setScreen('login');
              }}
              error={error}
            />
          </motion.div>
        )}

        {screen === 'pin' && localUserForPin && (
          <motion.div key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PinEntry
              onPinCorrect={handlePinCorrect}
              onBack={() => {
                setError('');
                setLocalUserForPin(null);
                setScreen('login');
              }}
              correctPinHash={localUserForPin.pin}
              error={error}
            />
          </motion.div>
        )}

        {screen === 'vault' && currentUser && (
          <motion.div key="vault" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <VaultScreen
              user={currentUser}
              onLogout={handleLogout}
              onAutoLock={handleAutoLock}
              isExportingRef={isExportingRef}
            />
          </motion.div>
        )}

        {screen === 'admin' && currentUser && (
          <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AdminPanel
              user={currentUser}
              onLogout={handleLogout}
              onAutoLock={handleAutoLock}
            />
          </motion.div>
        )}

        {screen === 'superadmin' && currentUser && (
          <motion.div key="superadmin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SuperAdminPanel
              user={currentUser}
              onLogout={handleLogout}
              onAutoLock={handleAutoLock}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
