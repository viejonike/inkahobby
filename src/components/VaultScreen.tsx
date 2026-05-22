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
  Settings,
  LogOut,
  EyeOff,
  Layers,
  FileText,
  Shield,
  ChevronRight,
  Upload,
  Smartphone,
  CheckCircle,
  Check,
  X,
  Play,
  Save,
} from 'lucide-react';
import type { LocalUser, VaultFile } from '@/lib/storage';
import {
  saveVaultFile,
  getVaultFiles,
  deleteVaultFile,
  addToSyncQueue,
  getPressDuration,
  setPressDuration,
  createBackup,
} from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import GalleryViewer from './GalleryViewer';

interface VaultScreenProps {
  user: LocalUser;
  onLogout: () => void;
  onAutoLock: () => void;
  isExportingRef: React.MutableRefObject<boolean>;
}

const MAX_FILES_PER_IMPORT = 50;
const MAX_FILES_PER_EXPORT = 50;
type CategoryFilter = 'Todos' | 'Fotos' | 'Videos' | 'Archivos';

export default function VaultScreen({ user, onLogout, onAutoLock, isExportingRef }: VaultScreenProps) {
  const [files, setFiles] = useState<(VaultFile & { userId: string })[]>([]);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('Todos');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [pressDurationVal, setPressDurationVal] = useState(getPressDuration());
  const lastActivityRef = useRef<number>(Date.now());

  // Auto-lock after 5 minutes of inactivity (but not during export)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (!isExportingRef.current && now - lastActivityRef.current > 5 * 60 * 1000) {
        onAutoLock();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [onAutoLock, isExportingRef]);

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

  // Filtered files by category
  const filteredFiles = files.filter((f) => {
    switch (categoryFilter) {
      case 'Fotos':
        return f.type === 'photo';
      case 'Videos':
        return f.type === 'video';
      case 'Archivos':
        return f.type === 'file';
      default:
        return true;
    }
  });

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
    const filesToProcess = Array.from(fileList).slice(0, MAX_FILES_PER_IMPORT);
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
        const isImage = file.type.startsWith('image/');
        let thumbnail: string | undefined;
        let fileType: 'photo' | 'video' | 'file' = 'file';

        if (isVideo) {
          fileType = 'video';
          thumbnail = await generateVideoThumbnail(file);
        } else if (isImage) {
          fileType = 'photo';
          thumbnail = base64;
        }

        const vaultFile: VaultFile & { userId: string } = {
          id: crypto.randomUUID(),
          type: fileType,
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

  // File input helper for mobile compatibility
  const openFileInput = useCallback((options: {
    accept: string;
    multiple?: boolean;
    capture?: string;
  }) => {
    // Set exporting flag to prevent auto-lock while file picker is open
    isExportingRef.current = true;
    recordActivity();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept;
    if (options.multiple) input.multiple = true;
    if (options.capture) {
      (input as HTMLInputElement & { capture: string }).capture = options.capture;
    }

    // Add to DOM before click for mobile compatibility
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files;
      if (!fileList || fileList.length === 0) {
        document.body.removeChild(input);
        isExportingRef.current = false;
        return;
      }

      if (fileList.length > MAX_FILES_PER_IMPORT) {
        toast({
          title: `Máximo ${MAX_FILES_PER_IMPORT} archivos`,
          description: `Solo se importarán los primeros ${MAX_FILES_PER_IMPORT}.`,
        });
      }

      await processFiles(fileList);
      document.body.removeChild(input);
      recordActivity();
      setTimeout(() => {
        isExportingRef.current = false;
      }, 1000);
    };

    // Cleanup when user cancels file picker
    const onCancelHandler = () => {
      setTimeout(() => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
        isExportingRef.current = false;
        recordActivity();
      }, 1000);
    };
    input.addEventListener('cancel', onCancelHandler);

    input.click();
  }, [processFiles, isExportingRef, recordActivity]);

  const handleImportFromGallery = () => {
    openFileInput({ accept: 'image/*,video/*', multiple: true });
  };

  const handleImportFromCamera = () => {
    openFileInput({ accept: 'image/*', capture: 'environment' });
  };

  const handleImportVideoFromCamera = () => {
    openFileInput({ accept: 'video/*', capture: 'environment' });
  };

  const handleImportFromFiles = () => {
    openFileInput({ accept: '*/*', multiple: true });
  };

  // Delete single file
  const handleDeleteFile = async (fileId: string) => {
    await deleteVaultFile(fileId);
    await loadFiles();
    setShowDeleteConfirm(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  // Batch delete
  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      await deleteVaultFile(id);
    }
    await loadFiles();
    setSelectedIds(new Set());
    setSelectionMode(false);
    setShowDeleteConfirm(false);
  };

  // Batch export - save selected files to device
  const handleBatchExport = async (exportType: 'gallery' | 'files') => {
    const filesToExport = files.filter(f => selectedIds.has(f.id)).slice(0, MAX_FILES_PER_EXPORT);
    if (filesToExport.length === 0) return;

    isExportingRef.current = true;
    recordActivity();
    setShowExportSheet(false);

    try {
      if (exportType === 'gallery' && navigator.share) {
        // Use Web Share API - supports multiple files on modern browsers
        const shareFiles: File[] = [];
        for (const file of filesToExport) {
          try {
            const response = await fetch(file.data);
            const blob = await response.blob();
            const extension = file.type === 'photo' ? 'jpg' : file.type === 'video' ? 'mp4' : 'bin';
            const mimeType = file.type === 'photo' ? 'image/jpeg' : file.type === 'video' ? 'video/mp4' : 'application/octet-stream';
            shareFiles.push(new File([blob], `${file.type}_${file.id.slice(0, 8)}.${extension}`, { type: mimeType }));
          } catch {
            // Skip files that can't be fetched
          }
        }

        if (shareFiles.length > 0) {
          try {
            await navigator.share({
              files: shareFiles,
            });
          } catch {
            // User cancelled or share failed, fall back to download
            for (const file of shareFiles) {
              const url = URL.createObjectURL(file);
              const link = document.createElement('a');
              link.href = url;
              link.download = file.name;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        }
      } else {
        // Download multiple files
        for (const file of filesToExport) {
          const link = document.createElement('a');
          link.href = file.data;
          const extension = file.type === 'photo' ? 'jpg' : file.type === 'video' ? 'mp4' : 'bin';
          link.download = `${file.type}_${file.id.slice(0, 8)}.${extension}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          if (filesToExport.indexOf(file) < filesToExport.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      // Auto-delete from app after export
      for (const file of filesToExport) {
        await deleteVaultFile(file.id);
      }
      await loadFiles();
      setSelectedIds(new Set());
      setSelectionMode(false);

      toast({
        title: 'Exportados',
        description: `${filesToExport.length} archivo${filesToExport.length !== 1 ? 's' : ''} exportado${filesToExport.length !== 1 ? 's' : ''} y eliminado${filesToExport.length !== 1 ? 's' : ''} de la galería`,
      });
    } catch (err) {
      console.error('Error exporting files:', err);
      toast({
        title: 'Error al exportar',
        description: 'No se pudieron exportar algunos archivos',
        variant: 'destructive',
      });
    } finally {
      recordActivity();
      setTimeout(() => {
        isExportingRef.current = false;
      }, 1000);
    }
  };

  // Export single file from viewer
  const handleViewerExport = async (file: VaultFile & { userId: string }) => {
    isExportingRef.current = true;
    recordActivity();

    try {
      const extension = file.type === 'photo' ? 'jpg' : file.type === 'video' ? 'mp4' : 'bin';
      const mimeType = file.type === 'photo' ? 'image/jpeg' : file.type === 'video' ? 'video/mp4' : 'application/octet-stream';

      // Try Web Share API first (saves to gallery on mobile)
      if (navigator.share) {
        try {
          const response = await fetch(file.data);
          const blob = await response.blob();
          const webFile = new File([blob], `${file.type}_${file.id.slice(0, 8)}.${extension}`, { type: mimeType });
          await navigator.share({
            files: [webFile],
          });
        } catch {
          // Fallback to download
          const link = document.createElement('a');
          link.href = file.data;
          link.download = `${file.type}_${file.id.slice(0, 8)}.${extension}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        const link = document.createElement('a');
        link.href = file.data;
        link.download = `${file.type}_${file.id.slice(0, 8)}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Auto-delete after export
      await deleteVaultFile(file.id);
      await loadFiles();
      toast({
        title: 'Exportado',
        description: 'Archivo exportado y eliminado de la galería',
      });
    } catch {
      toast({
        title: 'Error al exportar',
        description: 'No se pudo exportar el archivo',
        variant: 'destructive',
      });
    } finally {
      recordActivity();
      setTimeout(() => {
        isExportingRef.current = false;
      }, 1000);
    }
  };

  // Long press to enter selection mode
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef(false);

  const handleItemTouchStart = (fileId: string) => {
    longPressStartRef.current = true;
    longPressTimerRef.current = setTimeout(() => {
      if (longPressStartRef.current) {
        setSelectionMode(true);
        setSelectedIds(new Set([fileId]));
      }
      longPressStartRef.current = false;
    }, 500);
  };

  const handleItemTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressStartRef.current = false;
  };

  const handleItemClick = (fileId: string, index: number) => {
    recordActivity();
    if (selectionMode) {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(fileId)) {
        newSelected.delete(fileId);
        if (newSelected.size === 0) {
          setSelectionMode(false);
        }
      } else {
        newSelected.add(fileId);
      }
      setSelectedIds(newSelected);
    } else {
      setViewerIndex(index);
      setShowViewer(true);
    }
  };

  // Backup
  const handleBackup = async (withFiles: boolean) => {
    try {
      const backupStr = await createBackup(withFiles);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const ext = isIOS ? 'inkabak' : 'json';
      const blob = new Blob([backupStr], { type: isIOS ? 'application/octet-stream' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inkahobby_backup_${withFiles ? 'full' : 'quick'}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Respaldo creado', description: 'Archivo guardado en tu dispositivo' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear el respaldo', variant: 'destructive' });
    }
  };

  // Category tabs
  const categories: CategoryFilter[] = ['Todos', 'Fotos', 'Videos', 'Archivos'];
  const getCategoryCount = (cat: CategoryFilter): number => {
    switch (cat) {
      case 'Fotos': return files.filter(f => f.type === 'photo').length;
      case 'Videos': return files.filter(f => f.type === 'video').length;
      case 'Archivos': return files.filter(f => f.type === 'file').length;
      default: return files.length;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0f0f1a] z-40 flex flex-col" onClick={recordActivity} onTouchStart={recordActivity}>
      {/* Header */}
      <div className="bg-[#1a1a2e] border-b border-white/10 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectionMode ? (
            <button
              onClick={() => {
                setSelectionMode(false);
                setSelectedIds(new Set());
              }}
              className="text-white/50 hover:text-white/70 transition-colors"
            >
              <X size={20} />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center shadow-md shadow-[#e94560]/20">
                <Layers className="text-white" size={18} />
              </div>
              <div>
                <h1 className="text-white font-semibold text-base">Mi Galería Privada</h1>
                <p className="text-white/30 text-xs">{files.length} elementos</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <button
                onClick={() => {
                  // Select all visible files
                  if (selectedIds.size === filteredFiles.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(filteredFiles.map(f => f.id)));
                  }
                }}
                className="text-white/30 hover:text-white/60 transition-colors p-2 text-xs"
              >
                {selectedIds.size === filteredFiles.length ? 'Ninguno' : 'Todos'}
              </button>
              <button
                onClick={() => setShowExportSheet(true)}
                disabled={selectedIds.size === 0}
                className="text-green-400/70 hover:text-green-400 transition-colors p-2 disabled:opacity-30"
                title="Exportar seleccionados"
              >
                <Download size={20} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedIds.size === 0}
                className="text-red-400/70 hover:text-red-400 transition-colors p-2 disabled:opacity-30"
                title="Eliminar seleccionados"
              >
                <Trash2 size={20} />
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Selection Mode Bar */}
      {selectionMode && (
        <div className="bg-[#1a1a2e]/80 border-b border-white/10 px-4 py-2">
          <p className="text-white/50 text-xs text-center">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''} (máx. {MAX_FILES_PER_EXPORT} para exportar)
          </p>
        </div>
      )}

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

      {/* Category Filter Tabs */}
      <div className="bg-[#1a1a2e]/50 border-b border-white/5 px-4 py-2 shrink-0">
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
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <ImageIcon size={32} className="text-white/20" />
            </div>
            <p className="text-white/30 text-sm text-center mb-2">
              Toca el botón + para importar fotos, videos o archivos
            </p>
            <p className="text-white/20 text-xs text-center">
              Máximo {MAX_FILES_PER_IMPORT} archivos por importación
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 p-1">
            {filteredFiles.map((file, i) => (
              <motion.button
                key={file.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                onTouchStart={() => handleItemTouchStart(file.id)}
                onTouchEnd={handleItemTouchEnd}
                onClick={() => handleItemClick(file.id, i)}
                className={`aspect-square overflow-hidden relative bg-[#1a1a2e] ${
                  selectionMode && selectedIds.has(file.id)
                    ? 'ring-2 ring-[#e94560] ring-offset-1 ring-offset-[#0f0f1a]'
                    : ''
                }`}
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
                    ) : file.type === 'photo' ? (
                      <ImageIcon size={24} className="text-white/30" />
                    ) : (
                      <FileText size={24} className="text-white/30" />
                    )}
                  </div>
                )}
                {file.type === 'video' && (
                  <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                    <Play size={10} className="text-white" />
                  </div>
                )}
                {file.type === 'file' && (
                  <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                    <FileText size={10} className="text-white" />
                  </div>
                )}
                {selectionMode && selectedIds.has(file.id) && (
                  <div className="absolute inset-0 bg-[#e94560]/20 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-[#e94560] flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Floating + Button */}
      {!selectionMode && (
        <div className="absolute bottom-6 right-6">
          <button
            onClick={() => setShowImportSheet(true)}
            className="w-14 h-14 bg-gradient-to-br from-[#e94560] to-[#c23152] rounded-full flex items-center justify-center shadow-lg shadow-[#e94560]/30 active:scale-95 transition-transform"
          >
            <Plus size={28} className="text-white" />
          </button>
        </div>
      )}

      {/* Hide Gallery Button */}
      {!selectionMode && (
        <div className="shrink-0 px-4 py-3">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 text-white/30 hover:text-white/50 transition-colors py-2"
          >
            <EyeOff size={16} />
            <span className="text-sm">Ocultar galería</span>
          </button>
        </div>
      )}

      {/* Import Bottom Sheet */}
      <Dialog open={showImportSheet} onOpenChange={setShowImportSheet}>
        <DialogContent className="bg-[#1a1a2e] border-t border-white/10 rounded-t-3xl max-w-lg fixed bottom-0 left-0 right-0 translate-x-0 -translate-y-0 top-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300 p-6 pb-10">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-white text-lg flex items-center gap-2">
              <Upload size={20} className="text-[#e94560]" />
              Importar a InkaHobby
            </DialogTitle>
            <p className="text-white/40 text-xs mt-1">Selecciona de donde quieres importar (máx. {MAX_FILES_PER_IMPORT} archivos)</p>
          </DialogHeader>
          <div className="space-y-1">
            <button
              onClick={handleImportFromGallery}
              className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors bg-white/[0.02]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#e94560]/20 flex items-center justify-center">
                <ImageIcon size={22} className="text-[#e94560]" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white text-sm font-medium">Desde Galería</p>
                <p className="text-white/40 text-xs">Selecciona fotos y videos (hasta {MAX_FILES_PER_IMPORT})</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>

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

            <button
              onClick={handleImportVideoFromCamera}
              className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors bg-white/[0.02]"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Video size={22} className="text-purple-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white text-sm font-medium">Grabar Video</p>
                <p className="text-white/40 text-xs">Abre la cámara para grabar un video</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>

            <button
              onClick={handleImportFromFiles}
              className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors bg-white/[0.02]"
            >
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <FolderOpen size={22} className="text-yellow-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white text-sm font-medium">Desde Archivos</p>
                <p className="text-white/40 text-xs">Explora y selecciona archivos (hasta {MAX_FILES_PER_IMPORT})</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 justify-center">
            <Smartphone size={14} className="text-white/20" />
            <p className="text-white/20 text-xs">Máximo {MAX_FILES_PER_IMPORT} archivos por importación</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Options Sheet - for batch export */}
      <Dialog open={showExportSheet} onOpenChange={setShowExportSheet}>
        <DialogContent className="bg-[#1a1a2e] border-t border-white/10 rounded-t-3xl max-w-lg fixed bottom-0 left-0 right-0 translate-x-0 -translate-y-0 top-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300 p-6 pb-10">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-white text-lg flex items-center gap-2">
              <Download size={20} className="text-green-400" />
              Exportar {selectedIds.size} archivo{selectedIds.size !== 1 ? 's' : ''}
            </DialogTitle>
            <p className="text-white/40 text-xs mt-1">
              Los archivos se eliminarán de InkaHobby después de exportar
            </p>
          </DialogHeader>
          <div className="space-y-1">
            <button
              onClick={() => handleBatchExport('gallery')}
              className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors bg-white/[0.02]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#e94560]/20 flex items-center justify-center">
                <ImageIcon size={22} className="text-[#e94560]" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white text-sm font-medium">Guardar en Galería</p>
                <p className="text-white/40 text-xs">Guarda las fotos/videos en la galería del teléfono</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>

            <button
              onClick={() => handleBatchExport('files')}
              className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors bg-white/[0.02]"
            >
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <FolderOpen size={22} className="text-yellow-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white text-sm font-medium">Guardar en Archivos</p>
                <p className="text-white/40 text-xs">Descarga los archivos al almacenamiento del teléfono</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 justify-center">
            <Smartphone size={14} className="text-white/20" />
            <p className="text-white/20 text-xs">Máximo {MAX_FILES_PER_EXPORT} archivos por exportación</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gallery Viewer */}
      {showViewer && filteredFiles.length > 0 && (
        <GalleryViewer
          files={filteredFiles}
          initialIndex={viewerIndex}
          onClose={() => setShowViewer(false)}
          onExport={handleViewerExport}
          onDelete={handleDeleteFile}
          canDelete={true}
          isExportingRef={isExportingRef}
        />
      )}

      {/* Delete Confirmation (batch) */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#1a1a2e] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">¿Eliminar {selectedIds.size} archivo{selectedIds.size !== 1 ? 's' : ''}?</DialogTitle>
          </DialogHeader>
          <p className="text-white/50 text-sm">Esta acción no se puede deshacer.</p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleBatchDelete}
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
                Elige cuántos segundos debes mantener presionado el botón de ayuda para acceder
              </p>
              <div className="flex items-center gap-3">
                {[5, 8, 10].map((seconds) => (
                  <button
                    key={seconds}
                    onClick={() => {
                      setPressDurationVal(seconds);
                      setPressDuration(seconds);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      pressDurationVal === seconds
                        ? 'bg-[#e94560]/20 text-[#e94560] border border-[#e94560]/50'
                        : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>

            {/* Backup */}
            <div>
              <p className="text-white/70 text-sm mb-1">Respaldo</p>
              <p className="text-white/30 text-xs mb-3">
                Guarda un archivo de respaldo en tu dispositivo para recuperar tu cuenta si pierdes acceso.
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
