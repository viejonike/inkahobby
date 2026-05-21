'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LoginScreen from '@/components/LoginScreen';
import UserRegistration from '@/components/UserRegistration';
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
} from '@/lib/storage';
import { syncUser } from '@/lib/api';
import type { LocalUser } from '@/lib/storage';

type Screen = 'loading' | 'login' | 'register' | 'vault' | 'admin' | 'superadmin' | 'help';

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [currentUser, setCurrentUserState] = useState<LocalUser | null>(null);
  const [error, setError] = useState('');
  const { processQueue } = useSync();
  useServiceWorker();

  // Check for existing user on mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          // Check if user is blocked - refresh from server
          try {
            const res = await fetch('/api/users');
            if (res.ok) {
              const serverUsers = await res.json() as Array<{ id: string; username: string; pin: string; role: string; blocked?: boolean; email?: string; createdAt: string }>;
              const serverUser = serverUsers.find((u) => u.id === user.id || u.username === user.username);
              if (serverUser) {
                // Update local user data from server
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

                if (updatedUser.blocked) {
                  await logoutUser();
                  setError('Cuenta bloqueada');
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
            setError('Cuenta bloqueada');
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
    fetch('/api/seed', { method: 'POST' }).catch(() => {});
  }, []);

  // Process sync queue on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      processQueue().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [processQueue]);

  // Login with email (username) + password (PIN)
  // Admin and superadmin use the SAME login form
  const handleLogin = async (email: string, password: string) => {
    setError('');
    try {
      const hashedPassword = await hashPin(password);

      // First check IndexedDB
      const localUser = await getUserByUsername(email);
      if (localUser) {
        if (localUser.blocked) {
          setError('Cuenta bloqueada. Tu cuenta ha sido suspendida. Contacta al soporte.');
          return;
        }
        if (localUser.pin === hashedPassword) {
          await setCurrentUser(localUser.id);
          setCurrentUserState(localUser);

          // Try to sync with server to get latest role/blocked status
          try {
            const res = await fetch('/api/users');
            if (res.ok) {
              const serverUsers = await res.json() as Array<{ id: string; username: string; pin: string; role: string; blocked?: boolean; email?: string; createdAt: string }>;
              const serverUser = serverUsers.find((u) => u.username === email);
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
                setCurrentUserState(updatedUser);

                if (updatedUser.blocked) {
                  await logoutUser();
                  setError('Cuenta bloqueada.');
                  setScreen('login');
                  return;
                }

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
            // Server unavailable, use local data
          }

          if (localUser.role === 'superadmin') {
            setScreen('superadmin');
          } else if (localUser.role === 'admin') {
            setScreen('admin');
          } else {
            setScreen('vault');
          }
          return;
        } else {
          setError('Contraseña incorrecta');
          return;
        }
      }

      // If not found locally, check server
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const users = await res.json() as Array<{ id: string; username: string; pin: string; role: string; blocked?: boolean; email?: string; createdAt: string }>;
          const serverUser = users.find(
            (u) => (u.username === email || u.email === email) && u.pin === hashedPassword
          );
          if (serverUser) {
            if (serverUser.blocked) {
              setError('Cuenta bloqueada. Tu cuenta ha sido suspendida. Contacta al soporte.');
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
            } else if (localUserData.role === 'admin') {
              setScreen('admin');
            } else {
              setScreen('vault');
            }
            return;
          }
        }
      } catch {
        // Server not available, continue with local check
      }

      setError('Usuario no encontrado');
    } catch {
      setError('Error al iniciar sesión');
    }
  };

  // Admin login via long-press help button (alternative access)
  const handleAdminLogin = async (username: string, pin: string) => {
    setError('');
    try {
      const hashedPin = await hashPin(pin);

      // Check locally first
      const localUser = await getUserByUsername(username);
      if (localUser) {
        if (localUser.pin === hashedPin && (localUser.role === 'admin' || localUser.role === 'superadmin')) {
          await setCurrentUser(localUser.id);
          setCurrentUserState(localUser);
          if (localUser.role === 'superadmin') {
            setScreen('superadmin');
          } else {
            setScreen('admin');
          }
          return;
        } else if (localUser.pin !== hashedPin) {
          setError('PIN incorrecto');
          return;
        } else {
          setError('No tienes permisos de administrador');
          return;
        }
      }

      // Check server
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const users = await res.json() as Array<{ id: string; username: string; pin: string; role: string; blocked?: boolean; email?: string; createdAt: string }>;
          const serverUser = users.find(
            (u) => u.username === username && u.pin === hashedPin
          );
          if (serverUser && (serverUser.role === 'admin' || serverUser.role === 'superadmin')) {
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
          } else if (serverUser) {
            setError('No tienes permisos de administrador');
            return;
          }
        }
      } catch {
        // Server not available
      }

      setError('Credenciales de administrador inválidas');
    } catch {
      setError('Error de acceso');
    }
  };

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

      // Create user locally
      const newUser: LocalUser = {
        id: crypto.randomUUID(),
        username,
        pin: hashedPin,
        role: 'user',
        blocked: false,
        createdAt: new Date().toISOString(),
      };

      await saveUser(newUser);
      await addToSyncQueue({ type: 'user', data: newUser });
      await setCurrentUser(newUser.id);
      setCurrentUserState(newUser);

      // Try to sync to server immediately
      syncUser(newUser).catch(() => {});
      processQueue().catch(() => {});

      setScreen('vault');
    } catch {
      setError('Error al crear la cuenta');
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUserState(null);
    setScreen('login');
    setError('');
  };

  const handleAutoLock = async () => {
    await logoutUser();
    setCurrentUserState(null);
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
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LoginScreen
              onLogin={handleLogin}
              onRegister={() => {
                setError('');
                setScreen('register');
              }}
              onAdminLogin={handleAdminLogin}
              onHelp={() => setScreen('help')}
              error={error}
            />
          </motion.div>
        )}

        {screen === 'register' && (
          <motion.div key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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

        {screen === 'vault' && currentUser && (
          <motion.div key="vault" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <VaultScreen
              user={currentUser}
              onLogout={handleLogout}
              onAutoLock={handleAutoLock}
            />
          </motion.div>
        )}

        {screen === 'admin' && currentUser && (
          <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AdminPanel
              user={currentUser}
              onLogout={handleLogout}
              isSuperAdmin={false}
            />
          </motion.div>
        )}

        {screen === 'superadmin' && currentUser && (
          <motion.div key="superadmin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SuperAdminPanel
              user={currentUser}
              onLogout={handleLogout}
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
      </AnimatePresence>
    </div>
  );
}
