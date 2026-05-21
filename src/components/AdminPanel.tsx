'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Users,
  FileText,
  Image as ImageIcon,
  Video,
  ArrowLeft,
  Download,
  Trash2,
  ChevronRight,
  Clock,
  LogOut,
  Eye,
  BarChart3,
  RefreshCw,
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
  pin: string;
  role: string;
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
  const [view, setView] = useState<'dashboard' | 'users' | 'files'>('dashboard');

  const loadDataRef = useRef(false);
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, filesData] = await Promise.all([fetchUsers(), fetchFiles()]);
      setUsers(usersData);
      setFiles(filesData);
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

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {view !== 'dashboard' && (
            <button
              onClick={() => {
                setView('dashboard');
                setSelectedUserId(null);
              }}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-amber-400" />
            <h1 className="text-white font-semibold">
              {isSuperAdmin ? 'Super Admin' : 'Panel Admin'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={loadData}
            className="text-gray-400 hover:text-white h-8 w-8 p-0"
          >
            <RefreshCw size={16} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onLogout}
            className="text-gray-400 hover:text-white h-8 w-8 p-0"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw size={24} className="text-amber-400 animate-spin" />
            </div>
          ) : view === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="p-3 text-center">
                    <Users size={20} className="text-amber-400 mx-auto mb-1" />
                    <p className="text-white font-bold text-lg">{users.length}</p>
                    <p className="text-gray-500 text-[10px]">Usuarios</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="p-3 text-center">
                    <ImageIcon size={20} className="text-green-400 mx-auto mb-1" />
                    <p className="text-white font-bold text-lg">{totalPhotos}</p>
                    <p className="text-gray-500 text-[10px]">Fotos</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="p-3 text-center">
                    <Video size={20} className="text-orange-400 mx-auto mb-1" />
                    <p className="text-white font-bold text-lg">{totalVideos}</p>
                    <p className="text-gray-500 text-[10px]">Videos</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm">Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <button
                    onClick={() => setView('users')}
                    className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Users size={16} className="text-amber-400" />
                      <span className="text-gray-300 text-sm">Ver Usuarios</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => setView('files')}
                    className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-green-400" />
                      <span className="text-gray-300 text-sm">Ver Archivos</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-600" />
                  </button>
                </CardContent>
              </Card>

              {/* Recent Users */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm">Usuarios Recientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {users.slice(0, 10).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setView('files');
                        }}
                        className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {u.username.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-left">
                            <p className="text-white text-sm">{u.username}</p>
                            <p className="text-gray-500 text-xs">
                              {u._count?.files || 0} archivos
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              u.role === 'superadmin'
                                ? 'border-red-500 text-red-400'
                                : u.role === 'admin'
                                ? 'border-amber-500 text-amber-400'
                                : 'border-gray-600 text-gray-400'
                            }`}
                          >
                            {u.role}
                          </Badge>
                          <ChevronRight size={14} className="text-gray-600" />
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : view === 'users' ? (
            <motion.div
              key="users"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Users size={16} className="text-amber-400" />
                    Todos los Usuarios ({users.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setView('files');
                        }}
                        className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {u.username.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-left">
                            <p className="text-white text-sm font-medium">{u.username}</p>
                            <p className="text-gray-500 text-xs">
                              {u._count?.files || 0} archivos ·{' '}
                              {new Date(u.createdAt).toLocaleDateString('es')}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            u.role === 'superadmin'
                              ? 'border-red-500 text-red-400'
                              : u.role === 'admin'
                              ? 'border-amber-500 text-amber-400'
                              : 'border-gray-600 text-gray-400'
                          }`}
                        >
                          {u.role}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : view === 'files' ? (
            <motion.div
              key="files"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {selectedUserId && (
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-sm">
                    Archivos de{' '}
                    <span className="text-white font-medium">
                      {users.find((u) => u.id === selectedUserId)?.username || 'Usuario'}
                    </span>
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedUserId(null)}
                    className="text-gray-400 hover:text-white text-xs h-7"
                  >
                    Ver todos
                  </Button>
                </div>
              )}

              {filteredFiles.length === 0 ? (
                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="py-12 text-center">
                    <FileText size={32} className="text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No hay archivos sincronizados</p>
                    <p className="text-gray-600 text-xs mt-1">
                      Los archivos aparecerán cuando los usuarios los exporten
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {filteredFiles.map((file, i) => (
                    <motion.button
                      key={file.id}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelectedFile(file)}
                      className="aspect-square rounded-lg overflow-hidden relative bg-gray-800"
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
                            <Video size={20} className="text-orange-400" />
                          ) : (
                            <ImageIcon size={20} className="text-gray-600" />
                          )}
                        </div>
                      )}
                      {file.type === 'video' && (
                        <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                          <Video size={8} className="text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                        <p className="text-white text-[8px] truncate">{file.user.username}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* File Viewer Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-between">
              <span>{selectedFile?.type === 'photo' ? 'Foto' : 'Video'}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => selectedFile && downloadFile(selectedFile)}
                  className="text-green-400 hover:text-green-300 h-8 w-8 p-0"
                >
                  <Download size={16} />
                </Button>
              </div>
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
            <div className="mt-2 text-center">
              <p className="text-gray-500 text-xs">
                Usuario: {selectedFile?.user.username} ·{' '}
                {selectedFile?.createdAt
                  ? new Date(selectedFile.createdAt).toLocaleString('es')
                  : ''}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
