'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Shield,
  Users,
  Image as ImageIcon,
  Video,
  ArrowLeft,
  RefreshCw,
  LogOut,
  Ban,
  Check,
  FileText,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  Search,
  Play,
  Download,
  Loader2,
} from 'lucide-react';
import type { LocalUser } from '@/lib/storage';
import { fetchUsers, fetchFiles, getApiUrl } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import GalleryViewer from './GalleryViewer';

interface AdminPanelProps {
  user: LocalUser;
  onLogout: () => void;
  onAutoLock: () => void;
}

interface ServerUser {
  id: string;
  username: string;
  email?: string;
  pin: string;
  role: string;
  blocked?: boolean;
  syncRequested?: boolean;
  createdAt: string;
  _count?: { files: number };
}

interface ServerFile {
  id: string;
  userId: string;
  type: string;
  data: string;
  thumbnail: string | null;
  cloudinaryUrl?: string | null;
  createdAt: string;
  synced: boolean;
  user: { username: string };
}

type CategoryFilter = 'Todos' | 'Fotos' | 'Videos' | 'Archivos';

export default function AdminPanel({ user, onLogout, onAutoLock }: AdminPanelProps) {
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [files, setFiles] = useState<ServerFile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('Todos');
  const [showViewer, setShowViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);
  const [desyncingUserId, setDesyncingUserId] = useState<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current > 5 * 60 * 1000) {
        onAutoLock();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [onAutoLock]);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [usersData, filesData] = await Promise.all([fetchUsers(), fetchFiles()]);
      const regularUsers = (usersData as ServerUser[]).filter(u => u.role === 'user');
      setUsers(regularUsers);
      setFiles(filesData as ServerFile[]);
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
    if (showLoading) setLoading(false);
  }, []);

  useEffect(() => {
    loadData(true);
    setIsOnline(navigator.onLine);
    const handleOnline = () => { setIsOnline(true); loadData(true); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) loadData(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const userFiles = selectedUserId
    ? files.filter((f) => f.userId === selectedUserId)
    : [];

  const filteredUserFiles = userFiles.filter((f) => {
    switch (categoryFilter) {
      case 'Fotos': return f.type === 'photo';
      case 'Videos': return f.type === 'video';
      case 'Archivos': return f.type === 'file';
      default: return true;
    }
  });

  const totalPhotos = files.filter((f) => f.type === 'photo').length;
  const totalVideos = files.filter((f) => f.type === 'video').length;
  const syncedUsers = users.filter(u => u.syncRequested).length;

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    try {
      await fetch(getApiUrl('/api/sync/user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, blocked }),
      });
      await loadData();
    } catch (err) {
      console.error('Error blocking user:', err);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await fetch(getApiUrl(`/api/files?id=${fileId}`), { method: 'DELETE' });
      await loadData();
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  };

  // Sync user - request file sync from admin
  const handleSyncUser = async (userId: string) => {
    setSyncingUserId(userId);
    try {
      const res = await fetch(getApiUrl('/api/admin/sync-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const u = users.find(u => u.id === userId);
        toast({
          title: 'Sincronizacion solicitada',
          description: `Se ha solicitado la sincronizacion de ${u?.username}. Los archivos se subiran cuando el usuario este conectado.`,
        });
      }
      await loadData();
    } catch (err) {
      console.error('Error syncing user:', err);
      toast({ title: 'Error', description: 'No se pudo solicitar la sincronizacion', variant: 'destructive' });
    }
    setSyncingUserId(null);
  };

  // Desync user - delete cloud files
  const handleDesyncUser = async (userId: string) => {
    setDesyncingUserId(userId);
    try {
      const res = await fetch(getApiUrl('/api/admin/desync-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        const u = users.find(u => u.id === userId);
        toast({
          title: 'Desincronizado',
          description: `${u?.username}: ${data.deletedDbFiles || 0} archivos eliminados de la nube. El usuario conserva todo en su dispositivo.`,
        });
      }
      await loadData();
    } catch (err) {
      console.error('Error desyncing user:', err);
      toast({ title: 'Error', description: 'No se pudo desincronizar', variant: 'destructive' });
    }
    setDesyncingUserId(null);
  };

  const categories: CategoryFilter[] = ['Todos', 'Fotos', 'Videos', 'Archivos'];
  const getCategoryCount = (cat: CategoryFilter): number => {
    switch (cat) {
      case 'Fotos': return userFiles.filter(f => f.type === 'photo').length;
      case 'Videos': return userFiles.filter(f => f.type === 'video').length;
      case 'Archivos': return userFiles.filter(f => f.type === 'file').length;
      default: return userFiles.length;
    }
  };

  const viewerFiles = filteredUserFiles.map(f => ({
    id: f.id,
    type: f.type as 'photo' | 'video' | 'file',
    data: f.data,
    thumbnail: f.thumbnail || undefined,
    createdAt: f.createdAt,
    synced: f.synced,
    userId: f.userId,
  }));

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col" onClick={recordActivity} onTouchStart={recordActivity}>
      {/* Header */}
      <div className="bg-[#1a1a2e] border-b border-white/10 px-4 py-3 shrink-0 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {selectedUserId && (
            <button
              onClick={() => { setSelectedUserId(null); setCategoryFilter('Todos'); }}
              className="text-white/50 hover:text-white/70"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">Panel de Admin</h1>
              <p className="text-white/30 text-[10px]">Bienvenido, {user.username}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px]">
            {isOnline ? <Wifi size={12} className="text-green-400" /> : <WifiOff size={12} className="text-red-400" />}
            <span className={isOnline ? 'text-green-400' : 'text-red-400'}>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <button onClick={loadData} className="text-white/30 hover:text-white/60 transition-colors p-2">
            <RefreshCw size={18} />
          </button>
          <button onClick={onLogout} className="text-white/30 hover:text-white/60 transition-colors p-2">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="text-[#e94560] animate-spin" />
          </div>
        ) : !selectedUserId ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <Users size={20} className="text-[#e94560] mx-auto mb-1" />
                <p className="text-white font-bold text-lg">{users.length}</p>
                <p className="text-white/30 text-[10px]">Usuarios</p>
              </div>
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <Cloud size={20} className="text-blue-400 mx-auto mb-1" />
                <p className="text-white font-bold text-lg">{syncedUsers}</p>
                <p className="text-white/30 text-[10px]">Sincronizados</p>
              </div>
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <ImageIcon size={20} className="text-green-400 mx-auto mb-1" />
                <p className="text-white font-bold text-lg">{totalPhotos}</p>
                <p className="text-white/30 text-[10px]">Fotos en nube</p>
              </div>
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <Video size={20} className="text-purple-400 mx-auto mb-1" />
                <p className="text-white font-bold text-lg">{totalVideos}</p>
                <p className="text-white/30 text-[10px]">Videos en nube</p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Buscar usuario por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#e94560]/50 transition-all text-sm"
              />
            </div>

            {/* Users List */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#1a1a2e]/50 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <button
                    onClick={() => setSelectedUserId(u.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {u.username.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{u.username}</p>
                        {u.blocked && (
                          <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded-md">Bloqueado</span>
                        )}
                        {u.syncRequested && (
                          <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <Cloud size={8} /> Sincronizado
                          </span>
                        )}
                      </div>
                      <p className="text-white/30 text-xs">
                        {u._count?.files || 0} en nube · {new Date(u.createdAt).toLocaleDateString('es')}
                      </p>
                    </div>
                  </button>
                  {/* Sync/Desync button */}
                  <div className="flex items-center gap-1 ml-2">
                    {u.syncRequested ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDesyncUser(u.id); }}
                        disabled={desyncingUserId === u.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                        title="Desincronizar - borrar archivos de la nube"
                      >
                        {desyncingUserId === u.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CloudOff size={12} />
                        )}
                        Desincronizar
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSyncUser(u.id); }}
                        disabled={syncingUserId === u.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium transition-colors disabled:opacity-50"
                        title="Sincronizar - ver archivos de este usuario"
                      >
                        {syncingUserId === u.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Cloud size={12} />
                        )}
                        Sincronizar
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedUserId(u.id)}
                      className="h-8 w-8 p-0 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <ArrowLeft size={14} className="text-white/20 rotate-180" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && searchQuery && (
                <p className="text-white/30 text-sm text-center py-8">No se encontraron usuarios</p>
              )}
              {filteredUsers.length === 0 && !searchQuery && (
                <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl py-12 text-center">
                  <Users size={32} className="text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No hay usuarios registrados</p>
                  <p className="text-white/20 text-xs mt-1">Los usuarios apareceran aqui cuando se registren</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            {/* User Info Header */}
            <div className="flex items-center justify-between">
              <p className="text-white/50 text-sm">
                Archivos de <span className="text-white font-medium">{users.find((u) => u.id === selectedUserId)?.username || 'Usuario'}</span>
              </p>
              <div className="flex items-center gap-2">
                {users.find((u) => u.id === selectedUserId)?.syncRequested ? (
                  <button
                    onClick={() => handleDesyncUser(selectedUserId)}
                    disabled={desyncingUserId === selectedUserId}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {desyncingUserId === selectedUserId ? <Loader2 size={12} className="animate-spin" /> : <CloudOff size={12} />}
                    Desincronizar
                  </button>
                ) : (
                  <button
                    onClick={() => handleSyncUser(selectedUserId)}
                    disabled={syncingUserId === selectedUserId}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {syncingUserId === selectedUserId ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
                    Sincronizar
                  </button>
                )}
                {users.find((u) => u.id === selectedUserId)?.blocked ? (
                  <button onClick={() => handleBlockUser(selectedUserId, false)} className="flex items-center gap-1.5 text-green-400 text-xs">
                    <Check size={14} /> Desbloquear
                  </button>
                ) : (
                  <button onClick={() => handleBlockUser(selectedUserId, true)} className="flex items-center gap-1.5 text-red-400 text-xs">
                    <Ban size={14} /> Bloquear
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    categoryFilter === cat ? 'bg-[#e94560]/20 text-[#e94560]' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {cat} ({getCategoryCount(cat)})
                </button>
              ))}
            </div>

            {/* Files Grid */}
            {filteredUserFiles.length === 0 ? (
              <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl py-12 text-center">
                <FileText size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">
                  {users.find((u) => u.id === selectedUserId)?.syncRequested
                    ? 'Esperando archivos... El usuario necesita estar conectado a internet'
                    : 'Este usuario no esta sincronizado'}
                </p>
                <p className="text-white/20 text-xs mt-1">
                  Haz clic en "Sincronizar" para ver los archivos de este usuario
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {filteredUserFiles.map((file, i) => (
                  <motion.button
                    key={file.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => { setViewerIndex(i); setShowViewer(true); }}
                    className="aspect-square overflow-hidden relative bg-[#1a1a2e]"
                  >
                    {file.cloudinaryUrl ? (
                      <img src={file.cloudinaryUrl} alt="" className="w-full h-full object-cover" />
                    ) : file.thumbnail ? (
                      <img src={file.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {file.type === 'video' ? <Video size={20} className="text-white/30" /> :
                         file.type === 'photo' ? <ImageIcon size={20} className="text-white/30" /> :
                         <FileText size={20} className="text-white/30" />}
                      </div>
                    )}
                    {file.type === 'video' && (
                      <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                        <Play size={8} className="text-white" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {showViewer && viewerFiles.length > 0 && (
        <GalleryViewer
          files={viewerFiles}
          initialIndex={viewerIndex}
          onClose={() => setShowViewer(false)}
          onExport={() => {}}
          onDelete={handleDeleteFile}
          canDelete={false}
        />
      )}
    </div>
  );
}
