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

  const handleLogin = async (username: string, pin: string) => {
    setError('');
    try {
      // First check IndexedDB
      const localUser = await getUserByUsername(username);
      if (localUser) {
        if (localUser.pin === pin) {
          await setCurrentUser(localUser.id);
          setCurrentUserState(localUser);
          if (localUser.role === 'superadmin') {
            setScreen('superadmin');
          } else if (localUser.role === 'admin') {
            setScreen('admin');
          } else {
            setScreen('vault');
          }
          return;
        } else {
          setError('PIN incorrecto');
          return;
        }
      }

      // If not found locally, check server
      try {
        const res = await fetch(`/api/users`);
        if (res.ok) {
          const users = await res.json();
          const serverUser = users.find(
            (u: any) => u.username === username && u.pin === pin
          );
          if (serverUser) {
            const localUser: LocalUser = {
              id: serverUser.id,
              username: serverUser.username,
              pin: serverUser.pin,
              role: serverUser.role,
              createdAt: serverUser.createdAt,
            };
            await saveUser(localUser);
            await setCurrentUser(localUser.id);
            setCurrentUserState(localUser);
            if (localUser.role === 'superadmin') {
              setScreen('superadmin');
            } else if (localUser.role === 'admin') {
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
    } catch (err) {
      setError('Error al iniciar sesión');
    }
  };

  const handleAdminLogin = async (username: string, pin: string) => {
    setError('');
    try {
      // Check locally first
      const localUser = await getUserByUsername(username);
      if (localUser) {
        if (localUser.pin === pin && (localUser.role === 'admin' || localUser.role === 'superadmin')) {
          await setCurrentUser(localUser.id);
          setCurrentUserState(localUser);
          if (localUser.role === 'superadmin') {
            setScreen('superadmin');
          } else {
            setScreen('admin');
          }
          return;
        } else if (localUser.pin !== pin) {
          setError('PIN incorrecto');
          return;
        } else {
          setError('No tienes permisos de administrador');
          return;
        }
      }

      // Check server
      try {
        const res = await fetch(`/api/users`);
        if (res.ok) {
          const users = await res.json();
          const serverUser = users.find(
            (u: any) => u.username === username && u.pin === pin
          );
          if (serverUser && (serverUser.role === 'admin' || serverUser.role === 'superadmin')) {
            const localUser: LocalUser = {
              id: serverUser.id,
              username: serverUser.username,
              pin: serverUser.pin,
              role: serverUser.role,
              createdAt: serverUser.createdAt,
            };
            await saveUser(localUser);
            await setCurrentUser(localUser.id);
            setCurrentUserState(localUser);
            if (localUser.role === 'superadmin') {
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
    } catch (err) {
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

      // Create user locally
      const newUser: LocalUser = {
        id: crypto.randomUUID(),
        username,
        pin,
        role: 'user',
        createdAt: new Date().toISOString(),
      };

      await saveUser(newUser);
      await addToSyncQueue({ type: 'user', data: newUser });
      await setCurrentUser(newUser.id);
      setCurrentUserState(newUser);

      // Sync to server
      syncUser(newUser).catch(() => {});
      processQueue().catch(() => {});

      setScreen('vault');
    } catch (err) {
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
    <div className="min-h-screen bg-gray-900">
      <AnimatePresence mode="wait">
        {screen === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center bg-gray-900"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              >
                <span className="text-2xl font-bold text-white">IH</span>
              </motion.div>
              <p className="text-gray-400 text-sm">Cargando InkaHobby...</p>
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
