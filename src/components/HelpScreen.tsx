'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, HelpCircle, WifiOff } from 'lucide-react';

interface HelpScreenProps {
  onBack: () => void;
}

export default function HelpScreen({ onBack }: HelpScreenProps) {
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
          <p className="text-white/50 text-sm">InkaHobby - Tu red social creativa</p>
        </motion.div>
      </div>

      {/* Service Unavailable Message */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-8 text-center max-w-sm w-full"
        >
          <div className="w-14 h-14 rounded-xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <WifiOff size={28} className="text-red-400" />
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">Servicio no disponible</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Por el momento el servicio no está funcionando. Vuelva más tarde.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-white/20 text-xs mt-6 text-center"
        >
          Si el problema persiste, intenta más tarde.
        </motion.p>
      </div>
    </div>
  );
}
