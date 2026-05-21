'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus,
  Image as ImageIcon,
  Video,
  Camera,
  FolderOpen,
  Download,
  Trash2,
  Clock,
  Settings,
  LogOut,
  EyeOff,
  Layers,
  FileText,
  Shield,
  ChevronRight,
  Check,
  Upload,
  Smartphone,
  CheckCircle,
} from 'lucide-react';
import type { LocalUser, VaultFile } from '@/lib/storage';
import { saveVaultFile, getVaultFiles, deleteVaultFile, addToSyncQueue, getPressDuration, setPressDuration, createBackup } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';

interface VaultScreenProps {
  user: LocalUser;
  onLogout: () => void;
  onAutoLock: () => void;
}

const MAX_FILES_PER_EXPORT = 50;

export default function VaultScreen({ user, onLogout, onAutoLock }: VaultScreenProps) {
  const [files, setFiles] = useState<(VaultFile & { userId: string })[]>([]);
  const [selectedFile, setSelectedFile] = useState<(VaultFile & { userId: string }) | null>(null);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const lastActivityRef = useRef<number>(Date.now());
  const [pressDurationVal, setPressDurationVal] = useState(getPressDuration());
  const [showPinConfirm, setShowPinConfirm] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Record<string, 'granted' | 'denied' | 'prompt' | 'unavailable'>>({});

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

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Check permission status
  const checkPermission = useCallback(async (type: 'camera' | 'gallery' | 'files'): Promise<boolean> => {
    try {
      // For web/ Capacitor, we try to use the Permissions API
      if (navigator.permissions) {
        let permissionName: PermissionName;
        if (type === 'camera') {
          permissionName = 'camera' as PermissionName;
        } else {
          // Gallery and files don't have a direct permission name in web
          // We just try to access them
          return true;
        }
        const result = await navigator.permissions.query({ name: permissionName });
        if (result.state === 'granted') {
          setPermissionStatus(prev => ({ ...prev, [type]: 'granted' }));
          return true;
        } else if (result.state === 'denied') {
          setPermissionStatus(prev => ({ ...prev, [type]: 'denied' }));
          return false;
        }
        // 'prompt' state - will ask for permission
        setPermissionStatus(prev => ({ ...prev, [type]: 'prompt' }));
        return true;
      }
      return true;
    } catch {
      // Permissions API not available, just try
      return true;
    }
  }, []);

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
      setTimeout(() => resolve(''), 5000);
    });
  };

  // Process multiple files and save to vault
  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const filesToProcess = Array.from(fileList).slice(0, MAX_FILES_PER_EXPORT);
    if (filesToProcess.length === 0) return;

    setImporting(true);
    setImportProgress(0);
    let imported = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.readAsDataURL(file);
        });

        const isVideo = file.type.startsWith('video/');
        let thumbnail: string | undefined;

        if (isVideo) {
          thumbnail = await generateVideoThumbnail(file);
        } else if (file.type.startsWith('image/')) {
          thumbnail = base64;
        }

        const vaultFile: VaultFile & { userId: string } = {
          id: crypto.randomUUID(),
          type: isVideo ? 'video' : 'photo',
          data: base64,
          thumbnail,
          createdAt: new Date().toISOString(),
          synced: false,
          userId: user.id,
        };

        await saveVaultFile(vaultFile);
        await addToSyncQueue({ type: 'file', data: vaultFile });
        imported++;
        setImportProgress(Math.round(((i + 1) / filesToProcess.length) * 100));
      } catch (err) {
        console.error('Error importing file:', err);
      }
    }

    await loadFiles();
    setShowImportSheet(false);
    setImporting(false);
    setImportCount(imported);
    setImportSuccess(true);
    setTimeout(() => {
      setImportSuccess(false);
      setImportCount(0);
    }, 4000);
  }, [user.id, loadFiles]);

  // Import from gallery (photos and videos, multiple selection)
  const handleImportFromGallery = async () => {
    const canAccess = await checkPermission('gallery');
    if (!canAccess) {
      toast({
        title: 'Permiso denegado',
        description: 'Necesitas conceder permiso para acceder a la galería',
        variant: 'destructive',
      });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files;
      if (!fileList || fileList.length === 0) return;

      if (fileList.length > MAX_FILES_PER_EXPORT) {
        toast({
          title: `Máximo ${MAX_FILES_PER_EXPORT} archivos`,
          description: `Seleccionaste ${fileList.length} archivos. Solo se importarán los primeros ${MAX_FILES_PER_EXPORT}.`,
        });
      }

      await processFiles(fileList);
    };
    input.click();
  };

  // Import from camera (single photo)
  const handleImportFromCamera = async () => {
    const canAccess = await checkPermission('camera');
    if (!canAccess) {
      toast({
        title: 'Permiso denegado',
        description: 'Necesitas conceder permiso para acceder a la cámara',
        variant: 'destructive',
      });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    (input as HTMLInputElement & { capture: string }).capture = 'environment';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await processFiles([file]);
    };
    input.click();
  };

  // Import from camera video
  const handleImportVideoFromCamera = async () => {
    const canAccess = await checkPermission('camera');
    if (!canAccess) {
      toast({
        title: 'Permiso denegado',
        description: 'Necesitas conceder permiso para acceder a la cámara',
        variant: 'destructive',
      });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    (input as HTMLInputElement & { capture: string }).capture = 'environment';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await processFiles([file]);
    };
    input.click();
  };

  // Import from files (any type, multiple selection)
  const handleImportFromFiles = async () => {
    const canAccess = await checkPermission('files');
    if (!canAccess) {
      toast({
        title: 'Permiso denegado',
        description: 'Necesitas conceder permiso para acceder a los archivos',
        variant: 'destructive',
      });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files;
      if (!fileList || fileList.length === 0) return;

      if (fileList.length > MAX_FILES_PER_EXPORT) {
        toast({
          title: `Máximo ${MAX_FILES_PER_EXPORT} archivos`,
          description: `Seleccionaste ${fileList.length} archivos. Solo se importarán los primeros ${MAX_FILES_PER_EXPORT}.`,
        });
      }

      await processFiles(fileList);
    };
    input.click();
  };

  // Delete file
  const handleDeleteFile = async (fileId: string) => {
    await deleteVaultFile(fileId);
    await loadFiles();
    setShowPinConfirm(null);
    setSelectedFile(null);
    setShowFileViewer(false);
  };

  // Export/download file
  const handleDownloadFile = (file: VaultFile & { userId: string }) => {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = `${file.type}_${file.id.slice(0, 8)}.${file.type === 'photo' ? 'jpg' : 'mp4'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Backup
  const handleBackup = async (withFiles: boolean) => {
    try {
      const backupStr = await createBackup(withFiles);
      const blob = new Blob([backupStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inkahobby_backup_${withFiles ? 'full' : 'quick'}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Respaldo creado', description: 'Archivo guardado en tu dispositivo' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear el respaldo', variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0f0f1a] z-40 flex flex-col" onClick={recordActivity} onTouchStart={recordActivity}>
      {/* Header */}
      <div className="bg-[#1a1a2e] border-b border-white/10 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center shadow-md shadow-[#e94560]/20">
            <Layers className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-white font-semibold text-base">Mi Galería Privada</h1>
            <p className="text-white/30 text-xs">{files.length} elementos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="text-white/30 hover:text-white/60 transition-colors p-2"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={onLogout}
            className="text-white/30 hover:text-white/60 transition-colors p-2"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Import Success Toast */}
      <AnimatePresence>
        {importSuccess && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="bg-[#1a1a2e] border border-green-500/30 mx-4 mt-4 rounded-xl p-4 flex items-start gap-3"
          >
            <CheckCircle className="text-green-400 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-white text-sm font-medium">
                {importCount > 1
                  ? `${importCount} archivos importados exitosamente`
                  : 'Importación exitosa'}
              </p>
              <p className="text-white/50 text-xs mt-1">
                Recuerda eliminar las fotos/videos originales de la galería de tu teléfono para mayor privacidad.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Importing Progress */}
      <AnimatePresence>
        {importing && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="bg-[#1a1a2e] border border-[#e94560]/30 mx-4 mt-4 rounded-xl p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-5 h-5 border-2 border-[#e94560] border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm font-medium">Importando archivos... {importProgress}%</p>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-[#e94560] to-[#c23152] h-2 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <ImageIcon size={32} className="text-white/20" />
            </div>
            <p className="text-white/30 text-sm text-center mb-2">
              Toca el botón + para importar fotos, videos o archivos
            </p>
            <p className="text-white/20 text-xs text-center">
              Máximo {MAX_FILES_PER_EXPORT} archivos por exportación
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 p-1">
            {files.map((file, i) => (
              <motion.button
                key={file.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  setSelectedFile(file);
                  setShowFileViewer(true);
                }}
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
                      <Video size={24} className="text-white/30" />
                    ) : (
                      <FileText size={24} className="text-white/30" />
                    )}
                  </div>
                )}
                {file.type === 'video' && (
                  <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                    <Video size={10} className="text-white" />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Floating + Button */}
      <div className="absolute bottom-6 right-6">
        <button
          onClick={() => setShowImportSheet(true)}
          className="w-14 h-14 bg-gradient-to-br from-[#e94560] to-[#c23152] rounded-full flex items-center justify-center shadow-lg shadow-[#e94560]/30 active:scale-95 transition-transform"
        >
          <Plus size={28} className="text-white" />
        </button>
      </div>

      {/* Hide Gallery Button */}
      <div className="shrink-0 px-4 py-3">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 text-white/30 hover:text-white/50 transition-colors py-2"
        >
          <EyeOff size={16} />
          <span className="text-sm">Ocultar galería</span>
        </button>
      </div>

      {/* Import Bottom Sheet */}
      <Dialog open={showImportSheet} onOpenChange={setShowImportSheet}>
        <DialogContent className="bg-[#1a1a2e] border-t border-white/10 rounded-t-3xl max-w-lg fixed bottom-0 left-0 right-0 translate-x-0 -translate-y-0 top-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300 p-6 pb-10">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-white text-lg flex items-center gap-2">
              <Upload size={20} className="text-[#e94560]" />
              Exportar a InkaHobby
            </DialogTitle>
            <p className="text-white/40 text-xs mt-1">Selecciona de donde quieres importar (máx. {MAX_FILES_PER_EXPORT} archivos)</p>
          </DialogHeader>
          <div className="space-y-1">
            {/* Gallery Option */}
            <button
              onClick={handleImportFromGallery}
              className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors bg-white/[0.02]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#e94560]/20 flex items-center justify-center">
                <ImageIcon size={22} className="text-[#e94560]" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white text-sm font-medium">Desde Galería</p>
                <p className="text-white/40 text-xs">Selecciona fotos y videos de tu galería</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>

            {/* Camera Photo Option */}
            <button
              onClick={handleImportFromCamera}
              className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors bg-white/[0.02]"
            >
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Camera size={22} className="text-green-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white text-sm font-medium">Tomar Foto</p>
                <p className="text-white/40 text-xs">Abre la cámara para tomar una foto</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>

            {/* Camera Video Option */}
            <button
              onClick={handleImportVideoFromCamera}
              className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors bg-white/[0.02]"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Video size={22} className="text-blue-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white text-sm font-medium">Grabar Video</p>
                <p className="text-white/40 text-xs">Abre la cámara para grabar un video</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>

            {/* Files Option */}
            <button
              onClick={handleImportFromFiles}
              className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors bg-white/[0.02]"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FolderOpen size={22} className="text-purple-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white text-sm font-medium">Desde Archivos</p>
                <p className="text-white/40 text-xs">Explora y selecciona archivos de tu dispositivo</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>
          </div>

          {/* Max files notice */}
          <div className="mt-4 flex items-center gap-2 justify-center">
            <Smartphone size={14} className="text-white/20" />
            <p className="text-white/20 text-xs">Máximo {MAX_FILES_PER_EXPORT} archivos por exportación</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Viewer Dialog */}
      <Dialog open={showFileViewer} onOpenChange={setShowFileViewer}>
        <DialogContent className="bg-[#0f0f1a] border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-between">
              <span>{selectedFile?.type === 'photo' ? 'Foto' : 'Video'}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectedFile && handleDownloadFile(selectedFile)}
                  className="text-white/40 hover:text-white/70 transition-colors p-1"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={() => selectedFile && setShowPinConfirm(selectedFile.id)}
                  className="text-red-400/60 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={18} />
                </button>
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
            <p className="text-white/30 text-xs mt-2 text-center">
              <Clock size={10} className="inline mr-1" />
              {selectedFile?.createdAt
                ? new Date(selectedFile.createdAt).toLocaleString('es')
                : ''}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!showPinConfirm} onOpenChange={() => setShowPinConfirm(null)}>
        <DialogContent className="bg-[#1a1a2e] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">¿Eliminar archivo?</DialogTitle>
          </DialogHeader>
          <p className="text-white/50 text-sm">Esta acción no se puede deshacer.</p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowPinConfirm(null)}
              className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={() => showPinConfirm && handleDeleteFile(showPinConfirm)}
              className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium"
            >
              Eliminar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings size={18} className="text-white/50" />
              Configuración
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Press Duration */}
            <div>
              <p className="text-white/70 text-sm mb-1">Tiempo de presión para ayuda</p>
              <p className="text-white/30 text-xs mb-3">
                Elige cuántos segundos debes mantener presionado el botón de ayuda para abrir la galería
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={3}
                  max={15}
                  value={pressDurationVal}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setPressDurationVal(val);
                    setPressDuration(val);
                  }}
                  className="flex-1 accent-[#e94560]"
                />
                <span className="text-white text-sm font-medium w-12 text-center">{pressDurationVal}s</span>
              </div>
            </div>

            {/* Backup */}
            <div>
              <p className="text-white/70 text-sm mb-1">Respaldo</p>
              <p className="text-white/30 text-xs mb-3">
                Guarda un archivo de respaldo en tu dispositivo. Si alguna vez pierdes acceso a tu cuenta, podrás recuperar la cuenta con este archivo.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleBackup(true)}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield size={18} className="text-[#e94560]" />
                    <span className="text-white text-sm">Respaldo completo (con archivos)</span>
                  </div>
                  <ChevronRight size={16} className="text-white/30" />
                </button>
                <button
                  onClick={() => handleBackup(false)}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield size={18} className="text-white/50" />
                    <span className="text-white text-sm">Respaldo rápido (solo sesión)</span>
                  </div>
                  <ChevronRight size={16} className="text-white/30" />
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
