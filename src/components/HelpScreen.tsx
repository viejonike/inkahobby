'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  HelpCircle,
  Download,
  Layers,
  Smartphone,
  Share2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface HelpScreenProps {
  onBack: () => void;
}

const helpItems = [
  {
    question: '¿Qué es InkaHobby?',
    answer: 'InkaHobby es tu red social creativa. Comparte y descubre hobbies con la comunidad.',
  },
  {
    question: '¿Cómo creo una cuenta?',
    answer: 'Toca "Regístrate" en la pantalla de inicio. Elige un nombre de usuario y un PIN de 4 dígitos para tu espacio privado.',
  },
  {
    question: '¿Cómo guardo mis fotos y videos?',
    answer: 'En tu galería privada, toca el botón + para importar fotos, videos o archivos desde tu dispositivo o cámara.',
  },
  {
    question: '¿Mis datos están seguros?',
    answer: 'Sí, todos tus datos se almacenan de forma segura. Tu PIN está encriptado y tus archivos son privados.',
  },
  {
    question: '¿Olvidé mi PIN, qué hago?',
    answer: 'Si olvidas tu PIN, necesitarás crear una nueva cuenta o restaurar desde un respaldo previo.',
  },
  {
    question: '¿Cómo instalo la app?',
    answer: 'Puedes instalar InkaHobby en tu dispositivo como una app usando la opción "Instalar App" en la pantalla de inicio.',
  },
];

export default function HelpScreen({ onBack }: HelpScreenProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<unknown>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      const prompt = deferredPrompt as { prompt: () => void };
      prompt.prompt();
      setDeferredPrompt(null);
      setCanInstall(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#16213e] via-[#1a1a2e] to-[#0f3460] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 pt-8 pb-4 px-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-white/50 hover:text-white/70 transition-colors mb-6"
        >
          <ArrowLeft size={20} />
          <span>Volver</span>
        </button>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center mb-4 shadow-lg shadow-[#e94560]/30">
            <HelpCircle size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Centro de Ayuda</h1>
          <p className="text-white/50 text-sm">Preguntas frecuentes sobre InkaHobby</p>
        </motion.div>
      </div>

      {/* Install Section */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="px-4 mb-4"
      >
        <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#e94560]/20 flex items-center justify-center">
              <Smartphone size={20} className="text-[#e94560]" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Instalar App</p>
              <p className="text-white/30 text-xs">Accede más rápido desde tu pantalla de inicio</p>
            </div>
          </div>
          {canInstall ? (
            <button
              onClick={handleInstall}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#e94560] to-[#c23152] text-white font-medium text-sm flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Instalar InkaHobby
            </button>
          ) : (
            <div className="text-center">
              <p className="text-white/30 text-xs mb-2">
                Para instalar, usa el botón de compartir de tu navegador y selecciona &quot;Agregar a pantalla de inicio&quot;
              </p>
              <div className="flex items-center justify-center gap-2 text-white/20">
                <Share2 size={14} />
                <span className="text-xs">Comprar → Agregar a inicio</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* FAQ */}
      <div className="flex-1 px-4 pt-2 pb-8 space-y-2">
        {helpItems.map((item, i) => (
          <motion.div
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 * i + 0.2 }}
          >
            <div className="bg-[#1a1a2e] border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                className="w-full px-4 py-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium text-left flex-1">
                    {item.question}
                  </span>
                  {expandedIndex === i ? (
                    <ChevronUp size={16} className="text-white/30 shrink-0 ml-2" />
                  ) : (
                    <ChevronDown size={16} className="text-white/30 shrink-0 ml-2" />
                  )}
                </div>
              </button>
              {expandedIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="px-4 pb-3.5"
                >
                  <p className="text-white/50 text-sm leading-relaxed">{item.answer}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
