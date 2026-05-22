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
  Download,
  RefreshCw,
  LogOut,
  Ban,
  Check,
  FileText,
  Crown,
  Wifi,
  WifiOff,
  Cloud,
  Search,
  Play,
  Trash2,
} from 'lucide-react';
import type { LocalUser } from '@/lib/storage';
import { fetchUsers, fetchFiles } from '@/lib/api';
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

type CategoryFilter = 'Todos' | 'Fotos' | 'Videos' | 'Archivos';

export default function AdminPanel({ user, onLogout, onAutoLock }: AdminPanelProps) {
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [files, setFiles] = useState<ServerFile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  // Sync is invisible - no UI indicator
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('Todos');
  const [showViewer, setShowViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const lastActivityRef = useRef<number>(Date.now());

  // Auto-lock after inactivity
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
      // Filter out admin and superadmin - only show regular users
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
    const handleOnline = () => {
      setIsOnline(true);
      loadData(true);
    };
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
      if (navigator.onLine) loadData(false); // Silent refresh - no loading spinner
    }, 15000); // Refresh every 15s silently
    return () => clearInterval(interval);
  }, [loadData]);

  // Filter users by search
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get files for selected user with category filter
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

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    try {
      await fetch('/api/sync/user', {
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
      await fetch(`/api/files?id=${fileId}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      console.error('Error deleting file:', err);
    }
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

  // Convert server files for gallery viewer
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
              onClick={() => {
                setSelectedUserId(null);
                setCategoryFilter('Todos');
              }}
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
            <RefreshCw size={18} />
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
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="text-[#e94560] animate-spin" />
          </div>
        ) : !selectedUserId ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <Users size={20} className="text-[#e94560] mx-auto mb-1" />
                <p className="text-white font-bold text-lg">{users.length}</p>
                <p className="text-white/30 text-[10px]">Usuarios</p>
              </div>
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <ImageIcon size={20} className="text-green-400 mx-auto mb-1" />
                <p className="text-white font-bold text-lg">{totalPhotos}</p>
                <p className="text-white/30 text-[10px]">Fotos</p>
              </div>
              <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 text-center">
                <Video size={20} className="text-purple-400 mx-auto mb-1" />
                <p className="text-white font-bold text-lg">{totalVideos}</p>
                <p className="text-white/30 text-[10px]">Videos</p>
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
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-[#1a1a2e]/50 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {u.username.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{u.username}</p>
                        {u.blocked && (
                          <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded-md">
                            Bloqueado
                          </span>
                        )}
                      </div>
                      <p className="text-white/30 text-xs">
                        {u._count?.files || 0} archivos · {new Date(u.createdAt).toLocaleDateString('es')}
                      </p>
                    </div>
                  </div>
                  <ArrowLeft size={16} className="text-white/20 rotate-180" />
                </button>
              ))}
              {filteredUsers.length === 0 && searchQuery && (
                <p className="text-white/30 text-sm text-center py-8">No se encontraron usuarios</p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* User Info Header */}
            <div className="flex items-center justify-between">
              <p className="text-white/50 text-sm">
                Archivos de{' '}
                <span className="text-white font-medium">
                  {users.find((u) => u.id === selectedUserId)?.username || 'Usuario'}
                </span>
              </p>
              {users.find((u) => u.id === selectedUserId)?.blocked ? (
                <button
                  onClick={() => handleBlockUser(selectedUserId, false)}
                  className="flex items-center gap-1.5 text-green-400 text-xs"
                >
                  <Check size={14} />
                  Desbloquear
                </button>
              ) : (
                <button
                  onClick={() => handleBlockUser(selectedUserId, true)}
                  className="flex items-center gap-1.5 text-red-400 text-xs"
                >
                  <Ban size={14} />
                  Bloquear
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    categoryFilter === cat
                      ? 'bg-[#e94560]/20 text-[#e94560]'
                      : 'text-white/40 hover:text-white/60'
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
                <p className="text-white/30 text-sm">No hay archivos</p>
                <p className="text-white/20 text-xs mt-1">Los archivos exportados sin internet se sincronizarán al conectar</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {filteredUserFiles.map((file, i) => (
                  <motion.button
                    key={file.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => {
                      setViewerIndex(i);
                      setShowViewer(true);
                    }}
                    className="aspect-square overflow-hidden relative bg-[#1a1a2e]"
                  >
                    {file.thumbnail ? (
                      <img src={file.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {file.type === 'video' ? (
                          <Video size={20} className="text-white/30" />
                        ) : file.type === 'photo' ? (
                          <ImageIcon size={20} className="text-white/30" />
                        ) : (
                          <FileText size={20} className="text-white/30" />
                        )}
                      </div>
                    )}
                    {file.type === 'video' && (
                      <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                        <Play size={8} className="text-white" />
                      </div>
                    )}
                    {!file.synced && (
                      <div className="absolute bottom-1 right-1 bg-yellow-500/60 rounded-full p-0.5">
                        <Cloud size={8} className="text-white" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Gallery Viewer */}
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
