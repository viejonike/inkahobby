'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, ArrowLeft, Check, X } from 'lucide-react';

interface UserRegistrationProps {
  onRegister: (username: string, pin: string) => void;
  onBack: () => void;
  error: string;
}

export default function UserRegistration({ onRegister, onBack, error }: UserRegistrationProps) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const pinValid = pin.length === 4 && /^\d{4}$/.test(pin);
  const pinsMatch = pin === confirmPin && pin.length > 0;
  const usernameValid = username.length >= 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameValid && pinValid && pinsMatch) {
      onRegister(username, pin);
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
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center mb-4 shadow-lg shadow-[#e94560]/30">
            <Layers className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Crear Cuenta</h1>
          <p className="text-white/50 text-sm">Únete a InkaHobby</p>
        </motion.div>
      </div>

      {/* Registration Form */}
      <div className="flex-1 flex flex-col justify-start px-6 pt-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6"
        >
          <h2 className="text-white font-semibold text-lg mb-1">Crear usuario y PIN</h2>
          <p className="text-white/50 text-sm mb-6">Elige un nombre de usuario y PIN para tu espacio privado</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <label className="text-sm text-white/70 font-medium">Nombre de usuario</label>
              <input
                type="text"
                placeholder="Elige un nombre único"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:border-[#e94560] focus:ring-1 focus:ring-[#e94560] transition-all"
              />
              {username.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  {usernameValid ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <X size={14} className="text-red-400" />
                  )}
                  <span className={usernameValid ? 'text-green-400' : 'text-red-400'}>
                    Mínimo 3 caracteres
                  </span>
                </div>
              )}
            </div>

            {/* PIN */}
            <div className="space-y-2">
              <label className="text-sm text-white/70 font-medium">Ingresa 4 dígitos</label>
              <input
                type="password"
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(val);
                }}
                maxLength={4}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:border-[#e94560] focus:ring-1 focus:ring-[#e94560] transition-all text-center text-xl tracking-[0.5em]"
              />
              <div className="flex items-center justify-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-all ${
                      i < pin.length ? 'bg-[#e94560] scale-110' : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Confirm PIN */}
            <div className="space-y-2">
              <label className="text-sm text-white/70 font-medium">Confirmar PIN</label>
              <input
                type="password"
                placeholder="Repite tu PIN"
                value={confirmPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setConfirmPin(val);
                }}
                maxLength={4}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:border-[#e94560] focus:ring-1 focus:ring-[#e94560] transition-all text-center text-xl tracking-[0.5em]"
              />
              {confirmPin.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  {pinsMatch ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <X size={14} className="text-red-400" />
                  )}
                  <span className={pinsMatch ? 'text-green-400' : 'text-red-400'}>
                    {pinsMatch ? 'PIN coincide' : 'PIN no coincide'}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-sm text-center"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={!usernameValid || !pinValid || !pinsMatch}
              className="w-full bg-gradient-to-r from-[#e94560] to-[#c23152] text-white font-semibold py-3.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar
            </button>
          </form>
        </motion.div>

        <button
          onClick={onBack}
          className="w-full text-[#e94560] text-sm font-medium hover:text-[#e94560]/80 transition-colors py-4 text-center"
        >
          ¿Ya tienes cuenta? Inicia sesión
        </button>
      </div>
    </div>
  );
}
