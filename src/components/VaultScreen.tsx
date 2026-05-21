'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Home,
  Lock,
  User,
  Plus,
  Trash2,
  Download,
  X,
  Image as ImageIcon,
  Video,
  Heart,
  MessageCircle,
  Share2,
  Camera,
  ChevronRight,
  Star,
  Clock,
  LogOut,
} from 'lucide-react';
import type { LocalUser, VaultFile } from '@/lib/storage';
import { saveVaultFile, getVaultFiles, deleteVaultFile, addToSyncQueue } from '@/lib/storage';

interface VaultScreenProps {
  user: LocalUser;
  onLogout: () => void;
  onAutoLock: () => void;
}

// Fake social feed posts for disguise
const fakePosts = [
  {
    id: '1',
    user: 'María Artesana',
    avatar: '🎨',
    text: '¡Terminé mi nueva pintura al óleo! Me tardé 3 semanas pero valió la pena 🖌️',
    likes: 42,
    comments: 7,
    time: 'hace 2h',
    image: null,
  },
  {
    id: '2',
    user: 'Carlos Fotografía',
    avatar: '📷',
    text: 'Amanecer en la montaña. La paciencia es la clave de la buena fotografía 🏔️',
    likes: 89,
    comments: 15,
    time: 'hace 4h',
    image: null,
  },
  {
    id: '3',
    user: 'Ana Lectura',
    avatar: '📚',
    text: 'Recomendación del día: "Cien años de soledad" - García Márquez. ¿Quién más la ha leído?',
    likes: 56,
    comments: 23,
    time: 'hace 6h',
    image: null,
  },
  {
    id: '4',
    user: 'Diego Jardinería',
    avatar: '🌱',
    text: 'Mi jardín de suculentas va creciendo hermoso. ¡Cualquier consejo es bienvenido!',
    likes: 34,
    comments: 11,
    time: 'hace 8h',
    image: null,
  },
];

type Tab = 'feed' | 'vault' | 'profile';

export default function VaultScreen({ user, onLogout, onAutoLock }: VaultScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [vaultVisible, setVaultVisible] = useState(false);
  const [files, setFiles] = useState<(VaultFile & { userId: string })[]>([]);
  const [selectedFile, setSelectedFile] = useState<(VaultFile & { userId: string }) | null>(null);
  const [avatarTaps, setAvatarTaps] = useState(0);
  const avatarTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Auto-lock after 5 minutes of inactivity
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

  const loadFiles = useCallback(async () => {
    const vaultFiles = await getVaultFiles(user.id);
    setFiles(vaultFiles);
  }, [user.id]);

  // Load vault files
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Handle 3 taps on avatar to reveal vault
  const handleAvatarTap = useCallback(() => {
    recordActivity();
    if (avatarTapTimer.current) clearTimeout(avatarTapTimer.current);

    setAvatarTaps((prev) => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        setVaultVisible(true);
        setActiveTab('vault');
        return 0;
      }
      return newCount;
    });

    avatarTapTimer.current = setTimeout(() => {
      setAvatarTaps(0);
    }, 1000);
  }, [recordActivity]);

  // Add file to vault
  const handleAddFile = async (type: 'photo' | 'video') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'photo' ? 'image/*' : 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;

        // Generate thumbnail
        let thumbnail: string | undefined;
        if (type === 'photo') {
          thumbnail = base64; // For photos, use same as thumbnail
        } else {
          // For videos, generate a simple thumbnail
          thumbnail = await generateVideoThumbnail(file);
        }

        const vaultFile: VaultFile & { userId: string } = {
          id: crypto.randomUUID(),
          type,
          data: base64,
          thumbnail,
          createdAt: new Date().toISOString(),
          synced: false,
          userId: user.id,
        };

        await saveVaultFile(vaultFile);
        await addToSyncQueue({ type: 'file', data: vaultFile });
        await loadFiles();
      };
      reader.readAsDataURL(file);
    };
    input.click();
    setShowAddMenu(false);
  };

  // Generate video thumbnail
  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration / 2);
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const scale = Math.min(200 / video.videoWidth, 200 / video.videoHeight);
          const w = video.videoWidth * scale;
          const h = video.videoHeight * scale;
          ctx.drawImage(video, (200 - w) / 2, (200 - h) / 2, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        } else {
          resolve('');
        }
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
      setTimeout(() => resolve(''), 5000); // Timeout fallback
    });
  };

  // Delete file
  const handleDeleteFile = async (fileId: string) => {
    await deleteVaultFile(fileId);
    await loadFiles();
    setSelectedFile(null);
  };

  // Export file (add to sync queue for admin viewing)
  const handleExportFile = async (file: VaultFile & { userId: string }) => {
    await addToSyncQueue({ type: 'file', data: { ...file, synced: true } });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col" onClick={recordActivity} onTouchStart={recordActivity}>
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={handleAvatarTap} className="focus:outline-none">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">
                {user.username.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </button>
          <div>
            <h1 className="text-white font-semibold text-base">InkaHobby</h1>
            <p className="text-gray-400 text-xs">
              {vaultVisible ? 'Mi Colección' : 'Explorar'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {vaultVisible && (
            <Button
              size="sm"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="bg-amber-500 hover:bg-amber-600 text-black h-9 w-9 p-0"
            >
              <Plus size={18} />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onLogout}
            className="text-gray-400 hover:text-white h-9 w-9 p-0"
          >
            <LogOut size={18} />
          </Button>
        </div>
      </div>

      {/* Add File Menu */}
      <AnimatePresence>
        {showAddMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 right-4 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden"
          >
            <button
              onClick={() => handleAddFile('photo')}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-gray-700/50 transition-colors text-white"
            >
              <ImageIcon size={18} className="text-amber-400" />
              <span className="text-sm">Agregar Foto</span>
            </button>
            <button
              onClick={() => handleAddFile('video')}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-gray-700/50 transition-colors text-white"
            >
              <Video size={18} className="text-orange-400" />
              <span className="text-sm">Agregar Video</span>
            </button>
            <button
              onClick={() => {
                // Camera capture
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.capture = 'environment';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    const base64 = event.target?.result as string;
                    const vaultFile: VaultFile & { userId: string } = {
                      id: crypto.randomUUID(),
                      type: 'photo',
                      data: base64,
                      thumbnail: base64,
                      createdAt: new Date().toISOString(),
                      synced: false,
                      userId: user.id,
                    };
                    await saveVaultFile(vaultFile);
                    await addToSyncQueue({ type: 'file', data: vaultFile });
                    await loadFiles();
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
                setShowAddMenu(false);
              }}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-gray-700/50 transition-colors text-white"
            >
              <Camera size={18} className="text-green-400" />
              <span className="text-sm">Tomar Foto</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'feed' && !vaultVisible && (
            <motion.div
              key="feed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4 space-y-4"
            >
              {fakePosts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="bg-gray-800/50 border-gray-700/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-lg">
                          {post.avatar}
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{post.user}</p>
                          <p className="text-gray-500 text-xs">{post.time}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-600" />
                      </div>
                      <p className="text-gray-300 text-sm mb-3">{post.text}</p>
                      <div className="flex items-center gap-6 text-gray-500">
                        <button className="flex items-center gap-1.5 text-xs hover:text-red-400 transition-colors">
                          <Heart size={14} />
                          <span>{post.likes}</span>
                        </button>
                        <button className="flex items-center gap-1.5 text-xs hover:text-blue-400 transition-colors">
                          <MessageCircle size={14} />
                          <span>{post.comments}</span>
                        </button>
                        <button className="flex items-center gap-1.5 text-xs hover:text-green-400 transition-colors">
                          <Share2 size={14} />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}

          {(activeTab === 'vault' || vaultVisible) && (
            <motion.div
              key="vault"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <Star size={16} className="text-amber-400" />
                <h2 className="text-white font-semibold text-sm">Mis Favoritos</h2>
                <span className="text-gray-500 text-xs ml-auto">{files.length} elementos</span>
              </div>

              {files.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-800 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <Lock size={24} className="text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">Tu colección está vacía</p>
                  <p className="text-gray-600 text-xs mt-1">Toca + para agregar elementos</p>
                  <Button
                    onClick={() => setShowAddMenu(true)}
                    className="mt-4 bg-amber-500 hover:bg-amber-600 text-black"
                    size="sm"
                  >
                    <Plus size={16} className="mr-1" />
                    Agregar
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {files.map((file, i) => (
                    <motion.div
                      key={file.id}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="aspect-square rounded-lg overflow-hidden relative group cursor-pointer bg-gray-800"
                      onClick={() => setSelectedFile(file)}
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
                            <Video size={24} className="text-orange-400" />
                          ) : (
                            <ImageIcon size={24} className="text-gray-600" />
                          )}
                        </div>
                      )}
                      {file.type === 'video' && (
                        <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                          <Video size={10} className="text-white" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'profile' && !vaultVisible && (
            <motion.div
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4"
            >
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardContent className="p-6 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {user.username.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-white text-lg font-semibold">{user.username}</h3>
                  <p className="text-gray-400 text-sm mt-1">Miembro de InkaHobby</p>

                  <div className="flex justify-center gap-8 mt-6">
                    <div className="text-center">
                      <p className="text-white font-bold">{files.length}</p>
                      <p className="text-gray-500 text-xs">Favoritos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold">12</p>
                      <p className="text-gray-500 text-xs">Publicaciones</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold">48</p>
                      <p className="text-gray-500 text-xs">Seguidores</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={onLogout}
                    className="mt-6 border-gray-600 text-gray-300 hover:bg-gray-700/50"
                  >
                    <LogOut size={16} className="mr-2" />
                    Cerrar Sesión
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* File Viewer Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-between">
              <span>
                {selectedFile?.type === 'photo' ? 'Foto' : 'Video'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => selectedFile && handleExportFile(selectedFile)}
                  className="text-amber-400 hover:text-amber-300 h-8 w-8 p-0"
                >
                  <Download size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => selectedFile && handleDeleteFile(selectedFile.id)}
                  className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                >
                  <Trash2 size={16} />
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
            <p className="text-gray-500 text-xs mt-2 text-center">
              <Clock size={10} className="inline mr-1" />
              {selectedFile?.createdAt
                ? new Date(selectedFile.createdAt).toLocaleString('es')
                : ''}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700/50 px-2 pb-safe">
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => {
              recordActivity();
              if (!vaultVisible) setActiveTab('feed');
              else setActiveTab('feed');
            }}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${
              activeTab === 'feed' && !vaultVisible
                ? 'text-amber-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Home size={20} />
            <span className="text-[10px]">Inicio</span>
          </button>

          <button
            onClick={() => {
              recordActivity();
              if (vaultVisible) setActiveTab('vault');
              else {
                // Try to reveal vault
                handleAvatarTap();
                handleAvatarTap();
                handleAvatarTap();
              }
            }}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${
              vaultVisible || activeTab === 'vault'
                ? 'text-amber-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Star size={20} />
            <span className="text-[10px]">Favoritos</span>
          </button>

          <button
            onClick={() => {
              recordActivity();
              if (!vaultVisible) setActiveTab('profile');
            }}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${
              activeTab === 'profile' && !vaultVisible
                ? 'text-amber-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <User size={20} />
            <span className="text-[10px]">Perfil</span>
          </button>
        </div>
      </div>
    </div>
  );
}
