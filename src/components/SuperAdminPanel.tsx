'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Shield,
  Users,
  Trash2,
  RefreshCw,
  LogOut,
  Crown,
  UserCog,
  AlertTriangle,
  Ban,
  Check,
  Layers,
  Wifi,
  WifiOff,
  Cloud,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import type { LocalUser } from '@/lib/storage';
import { fetchUsers, fetchFiles } from '@/lib/api';

interface SuperAdminPanelProps {
  user: LocalUser;
  onLogout: () => void;
}

interface ServerUser {
  id: string;
  username: string;
  email?: string;
  pin: string;
  role: string;
  blocked?: boolean;
  createdAt: string;
  _count?: { files: number };
}

interface ServerFile {
  id: string;
  userId: string;
  type: string;
  data: string;
  thumbnail: string | null;
  createdAt: string;
  synced: boolean;
  user: { username: string };
}

export default function SuperAdminPanel({ user, onLogout }: SuperAdminPanelProps) {
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [files, setFiles] = useState<ServerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [promoteUser, setPromoteUser] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setSyncing(true);
    try {
      const [usersData, filesData] = await Promise.all([fetchUsers(), fetchFiles()]);
      setUsers(usersData as ServerUser[]);
      setFiles(filesData as ServerFile[]);
    } catch (err) {
      console.error('Error loading data:', err);
    }
    setLoading(false);
    setSyncing(false);
  }, []);

  useEffect(() => {
    loadData();

    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      loadData(); // Refresh when coming online - this is when offline users/files sync
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  // Auto-refresh every 30 seconds to pick up synced data
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) {
        loadData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleDeleteUser = async (userId: string) => {
    try {
      await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
      await loadData();
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    try {
      const u = users.find((u) => u.id === userId);
      if (!u) return;
      await fetch('/api/sync/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...u, blocked }),
      });
      await loadData();
    } catch (err) {
      console.error('Error blocking user:', err);
    }
  };

  const handlePromoteUser = async (userId: string, newRole: string) => {
    try {
      const u = users.find((u) => u.id === userId);
      if (!u) return;
      await fetch('/api/sync/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...u, role: newRole }),
      });
      await loadData();
      setPromoteUser(null);
    } catch (err) {
      console.error('Error promoting user:', err);
    }
  };

  const totalUsers = users.length;
  const adminUsers = users.filter((u) => u.role === 'admin').length;
  const regularUsers = users.filter((u) => u.role === 'user').length;
  const totalFiles = files.length;
  const totalPhotos = files.filter((f) => f.type === 'photo').length;
  const totalVideos = files.filter((f) => f.type === 'video').length;
  const unsyncedFiles = files.filter((f) => !f.synced).length;

  const userFiles = selectedUserId
    ? files.filter((f) => f.userId === selectedUserId)
    : [];

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1a2e] border-b border-white/10 px-4 py-3 shrink-0 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {selectedUserId && (
            <button
              onClick={() => setSelectedUserId(null)}
              className="text-white/50 hover:text-white/70"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center">
              <Crown size={14} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">Super Admin</h1>
              <p className="text-[#e94560]/60 text-[10px]">Control Total · {user.username}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px]">
            {isOnline ? (
              <Wifi size={12} className="text-green-400" />
            ) : (
              <WifiOff size={12} className="text-red-400" />
            )}
            <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <button
            onClick={loadData}
            className="text-white/30 hover:text-white/60 transition-colors p-2"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onLogout}
            className="text-white/30 hover:text-white/60 transition-colors p-2"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="text-[#e94560] animate-spin" />
          </div>
        ) : selectedUserId ? (
          /* Selected User Files View */
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
              <p className="text-white font-medium">
                {users.find((u) => u.id === selectedUserId)?.username || 'Usuario'}
              </p>
              <p className="text-white/40 text-xs">
                {userFiles.length} archivos · {userFiles.filter(f => f.type === 'photo').length} fotos · {userFiles.filter(f => f.type === 'video').length} videos
              </p>
            </div>

            {userFiles.length === 0 ? (
              <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl py-12 text-center">
                <Layers size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No hay archivos</p>
                <p className="text-white/20 text-xs mt-1">Las exportaciones sin internet se sincronizarán al conectar</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {userFiles.map((file, i) => (
                  <motion.div
                    key={file.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="aspect-square overflow-hidden relative bg-[#1a1a2e]"
                  >
                    {file.thumbnail ? (
                      <img src={file.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {file.type === 'video' ? (
                          <Video size={20} className="text-white/30" />
                        ) : (
                          <ImageIcon size={20} className="text-white/30" />
                        )}
                      </div>
                    )}
                    {!file.synced && (
                      <div className="absolute top-1 right-1 bg-yellow-500/60 rounded-full p-0.5">
                        <Cloud size={8} className="text-white" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <>
            {/* System Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <Users size={20} className="text-[#e94560] mx-auto mb-1" />
                <p className="text-white font-bold text-xl">{totalUsers}</p>
                <p className="text-white/30 text-[10px]">Total Usuarios</p>
              </div>
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <Layers size={20} className="text-green-400 mx-auto mb-1" />
                <p className="text-white font-bold text-xl">{totalFiles}</p>
                <p className="text-white/30 text-[10px]">Total Archivos</p>
              </div>
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <ImageIcon size={20} className="text-blue-400 mx-auto mb-1" />
                <p className="text-white font-bold text-xl">{totalPhotos}</p>
                <p className="text-white/30 text-[10px]">Fotos</p>
              </div>
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <Video size={20} className="text-purple-400 mx-auto mb-1" />
                <p className="text-white font-bold text-xl">{totalVideos}</p>
                <p className="text-white/30 text-[10px]">Videos</p>
              </div>
            </div>

            {/* Sync Status */}
            <div className="bg-[#1a1a2e] border border-white/5 rounded-xl p-3 flex items-center gap-3">
              <Cloud size={16} className={isOnline ? 'text-green-400' : 'text-yellow-400'} />
              <div className="flex-1">
                <p className="text-white/70 text-xs font-medium">
                  {isOnline
                    ? unsyncedFiles > 0
                      ? `${unsyncedFiles} archivos pendientes de sincronizar`
                      : 'Todos los datos sincronizados'
                    : 'Sin conexión - los datos se sincronizarán al conectar'}
                </p>
                <p className="text-white/30 text-[10px]">
                  Los usuarios y archivos registrados sin internet aparecerán aquí al conectarse
                </p>
              </div>
            </div>

            {/* Role Stats */}
            <div className="flex gap-2">
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-2 flex-1 text-center">
                <Shield size={14} className="text-purple-400 mx-auto mb-0.5" />
                <p className="text-white font-bold text-sm">{adminUsers}</p>
                <p className="text-white/30 text-[9px]">Admins</p>
              </div>
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-2 flex-1 text-center">
                <UserCog size={14} className="text-blue-400 mx-auto mb-0.5" />
                <p className="text-white font-bold text-sm">{regularUsers}</p>
                <p className="text-white/30 text-[9px]">Usuarios</p>
              </div>
            </div>

            {/* User Management */}
            <div>
              <p className="text-white/50 text-sm mb-3">
                Los usuarios registrados aparecerán aquí automáticamente
              </p>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#1a1a2e]/50 border border-white/5"
                  >
                    <button
                      onClick={() => setSelectedUserId(u.id)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {u.username.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium">{u.username}</p>
                          {u.role === 'superadmin' && (
                            <Crown size={12} className="text-[#e94560]" />
                          )}
                          {u.role === 'admin' && (
                            <Shield size={10} className="text-blue-400" />
                          )}
                          {u.blocked && (
                            <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded-md">
                              Bloqueado
                            </span>
                          )}
                        </div>
                        <p className="text-white/30 text-xs">
                          {u._count?.files || 0} archivos · {u.role} ·{' '}
                          {new Date(u.createdAt).toLocaleDateString('es')}
                        </p>
                      </div>
                    </button>
                    {u.role !== 'superadmin' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleBlockUser(u.id, !u.blocked)}
                          className="h-8 w-8 p-0 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
                          title={u.blocked ? 'Desbloquear' : 'Bloquear'}
                        >
                          {u.blocked ? (
                            <Check size={14} className="text-green-400" />
                          ) : (
                            <Ban size={14} className="text-white/30" />
                          )}
                        </button>
                        <button
                          onClick={() => setPromoteUser(u.id)}
                          className="h-8 w-8 p-0 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
                          title="Cambiar rol"
                        >
                          <Shield size={14} className="text-[#e94560]/60" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u.id)}
                          className="h-8 w-8 p-0 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} className="text-red-400/60" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-[#1a1a2e] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              ¿Eliminar usuario?
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/50 text-sm">
            Esta acción no se puede deshacer. Todos sus archivos serán eliminados permanentemente.
          </p>
          <DialogFooter className="gap-2 mt-4">
            <button
              onClick={() => setConfirmDelete(null)}
              className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={() => confirmDelete && handleDeleteUser(confirmDelete)}
              className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium"
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote User Dialog */}
      <Dialog open={!!promoteUser} onOpenChange={() => setPromoteUser(null)}>
        <DialogContent className="bg-[#1a1a2e] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield size={18} className="text-[#e94560]" />
              Cambiar Rol de Usuario
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/50 text-sm mb-4">
            Selecciona el nuevo rol para{' '}
            <span className="text-white font-medium">
              {users.find((u) => u.id === promoteUser)?.username || 'este usuario'}
            </span>
          </p>
          <div className="space-y-2">
            <button
              onClick={() => promoteUser && handlePromoteUser(promoteUser, 'admin')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#e94560] to-[#c23152] text-white font-medium text-sm flex items-center justify-center gap-2"
            >
              <Shield size={16} />
              Promover a Admin
            </button>
            <button
              onClick={() => promoteUser && handlePromoteUser(promoteUser, 'user')}
              className="w-full py-3 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <UserCog size={16} />
              Degradar a Usuario
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
