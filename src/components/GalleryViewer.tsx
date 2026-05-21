'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Play,
  FileText,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import type { VaultFile } from '@/lib/storage';

interface GalleryViewerProps {
  files: (VaultFile & { userId: string })[];
  initialIndex: number;
  onClose: () => void;
  onExport: (file: VaultFile & { userId: string }) => void;
  onDelete: (fileId: string) => void;
  canDelete?: boolean;
}

export default function GalleryViewer({
  files,
  initialIndex,
  onClose,
  onExport,
  onDelete,
  canDelete = true,
}: GalleryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentFile = files[currentIndex];

  const goToIndex = useCallback((newIndex: number, dir: number) => {
    if (newIndex < 0 || newIndex >= files.length) return;
    setDirection(dir);
    setCurrentIndex(newIndex);
  }, [files.length]);

  const goNext = useCallback(() => {
    if (currentIndex < files.length - 1) {
      goToIndex(currentIndex + 1, 1);
    }
  }, [currentIndex, files.length, goToIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      goToIndex(currentIndex - 1, -1);
    }
  }, [currentIndex, goToIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          goNext();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onClose]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = Date.now();
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartXRef.current || !touchStartRef.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    const elapsed = Date.now() - touchStartRef.current;

    // Only register as swipe if fast enough and far enough
    if (Math.abs(diff) > 50 && elapsed < 500) {
      if (diff > 0) {
        goNext();
      } else {
        goPrev();
      }
    }

    touchStartRef.current = null;
    touchStartXRef.current = null;
  };

  const handleExport = (file: VaultFile & { userId: string }) => {
    const link = document.createElement('a');
    link.href = file.data;
    const extension = file.type === 'photo' ? 'jpg' : file.type === 'video' ? 'mp4' : 'bin';
    link.download = `${file.type}_${file.id.slice(0, 8)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onExport(file);
  };

  const handleDelete = (fileId: string) => {
    onDelete(fileId);
    setShowDeleteConfirm(null);
    // If last file, close viewer
    if (files.length <= 1) {
      onClose();
    } else if (currentIndex >= files.length - 1) {
      goToIndex(currentIndex - 1, -1);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f1a] flex flex-col">
      {/* Top Bar */}
      <div className="bg-[#1a1a2e]/90 backdrop-blur-sm border-b border-white/10 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white/70 text-sm">
            {currentIndex + 1} / {files.length}
          </span>
          <span className="text-white/30 text-xs">
            {currentFile?.type === 'photo' ? 'Foto' : currentFile?.type === 'video' ? 'Video' : 'Archivo'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => currentFile && handleExport(currentFile)}
            className="text-white/40 hover:text-white/70 transition-colors p-2"
            title="Exportar"
          >
            <Download size={20} />
          </button>
          {canDelete && (
            <button
              onClick={() => currentFile && setShowDeleteConfirm(currentFile.id)}
              className="text-red-400/60 hover:text-red-400 transition-colors p-2"
              title="Eliminar"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors p-2"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            {currentFile?.type === 'photo' ? (
              <img
                src={currentFile.data}
                alt=""
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : currentFile?.type === 'video' ? (
              <video
                src={currentFile.data}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-lg"
              />
            ) : (
              <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-8 text-center">
                <FileText size={48} className="text-white/30 mx-auto mb-4" />
                <p className="text-white/50 text-sm">Archivo</p>
                <p className="text-white/30 text-xs mt-1">{currentFile?.id.slice(0, 12)}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows (Desktop) */}
        {currentIndex > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors z-10"
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
        )}
        {currentIndex < files.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors z-10"
          >
            <ChevronRight size={24} className="text-white" />
          </button>
        )}
      </div>

      {/* Thumbnail Strip */}
      {files.length > 1 && (
        <div className="bg-[#1a1a2e]/90 backdrop-blur-sm border-t border-white/10 py-2 px-4 shrink-0">
          <div className="flex gap-2 overflow-x-auto max-w-full justify-center">
            {files.map((file, i) => (
              <button
                key={file.id}
                onClick={() => goToIndex(i, i > currentIndex ? 1 : -1)}
                className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  i === currentIndex
                    ? 'border-[#e94560] scale-110'
                    : 'border-white/10 opacity-50 hover:opacity-80'
                }`}
              >
                {file.thumbnail ? (
                  <img src={file.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#0f0f1a] flex items-center justify-center">
                    {file.type === 'video' ? (
                      <Video size={14} className="text-white/30" />
                    ) : file.type === 'photo' ? (
                      <ImageIcon size={14} className="text-white/30" />
                    ) : (
                      <FileText size={14} className="text-white/30" />
                    )}
                  </div>
                )}
                {file.type === 'video' && (
                  <div className="absolute bottom-0.5 right-0.5">
                    <Play size={6} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full"
            >
              <h3 className="text-white font-semibold text-lg mb-2">¿Eliminar archivo?</h3>
              <p className="text-white/50 text-sm mb-6">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
