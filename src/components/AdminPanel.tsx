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
  Layers,
} from 'lucide-react';
import type { LocalUser } from '@/lib/storage';
import { fetchUsers, fetchFiles } from '@/lib/api';

interface AdminPanelProps {
  user: LocalUser;
  onLogout: () => void;
  isSuperAdmin?: boolean;
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

export default function AdminPanel({ user, onLogout, isSuperAdmin }: AdminPanelProps) {
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [files, setFiles] = useState<ServerFile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<ServerFile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDataRef = useRef(false);
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, filesData] = await Promise.all([fetchUsers(), fetchFiles()]);
      setUsers(usersData as ServerUser[]);
      setFiles(filesData as ServerFile[]);
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loadDataRef.current) {
      loadDataRef.current = true;
      const timer = setTimeout(() => { loadData(); }, 0);
      return () => clearTimeout(timer);
    }
  }, [loadData]);

  const filteredFiles = selectedUserId
    ? files.filter((f) => f.userId === selectedUserId)
    : files;

  const totalPhotos = files.filter((f) => f.type === 'photo').length;
  const totalVideos = files.filter((f) => f.type === 'video').length;

  const downloadFile = (file: ServerFile) => {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = `${file.type}_${file.user.username}_${file.id.slice(0, 8)}.${file.type === 'photo' ? 'jpg' : 'mp4'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <h1 className="text-white font-semibold">
              {isSuperAdmin ? 'Super Admin' : 'Panel de control'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
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

            {/* Users List */}
            <div>
              <p className="text-white/50 text-sm mb-3">Los usuarios registrados aparecerán aquí automáticamente</p>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {users.map((u) => (
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
                          {u._count?.files || 0} archivos · {u.role}
                        </p>
                      </div>
                    </div>
                    <ArrowLeft size={16} className="text-white/20 rotate-180" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
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

            {filteredFiles.length === 0 ? (
              <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl py-12 text-center">
                <FileText size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No hay archivos</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {filteredFiles.map((file, i) => (
                  <motion.button
                    key={file.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedFile(file)}
                    className="aspect-square overflow-hidden relative bg-[#1a1a2e]"
                  >
                    {file.thumbnail ? (
                      <img
                        src={file.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {file.type === 'video' ? (
                          <Video size={20} className="text-white/30" />
                        ) : (
                          <ImageIcon size={20} className="text-white/30" />
                        )}
                      </div>
                    )}
                    {file.type === 'video' && (
                      <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                        <Video size={8} className="text-white" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* File Viewer Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="bg-[#0f0f1a] border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-between">
              <span>{selectedFile?.type === 'photo' ? 'Foto' : 'Video'}</span>
              <button
                onClick={() => selectedFile && downloadFile(selectedFile)}
                className="text-white/40 hover:text-white/70 transition-colors p-1"
              >
                <Download size={18} />
              </button>
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            {selectedFile?.type === 'photo' ? (
              <img
                src={selectedFile.data}
                alt=""
                className="w-full rounded-lg max-h-[70vh] object-contain"
              />
            ) : (
              <video
                src={selectedFile?.data}
                controls
                className="w-full rounded-lg max-h-[70vh]"
              />
            )}
            <p className="text-white/30 text-xs mt-2 text-center">
              Usuario: {selectedFile?.user.username} ·{' '}
              {selectedFile?.createdAt
                ? new Date(selectedFile.createdAt).toLocaleString('es')
                : ''}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
