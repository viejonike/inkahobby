'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layers, Eye, EyeOff, HelpCircle, Download } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => void;
  onRegister: () => void;
  onAdminLogin: (username: string, pin: string) => void;
  onHelp: () => void;
  onInstall?: () => void;
  error: string;
}

export default function LoginScreen({ onLogin, onRegister, onAdminLogin, onHelp, onInstall, error }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const helpPressStartRef = useRef<number | null>(null);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpPressRef = useRef(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    onAdminLogin(adminUsername, adminPin);
  };

  const handleHelpPress = useCallback(() => {
    helpPressRef.current = true;
    helpPressStartRef.current = Date.now();
    helpTimerRef.current = setTimeout(() => {
      if (helpPressRef.current) {
        setShowAdmin(true);
      }
    }, 5000); // 5 second default press duration
  }, []);

  const handleHelpRelease = useCallback(() => {
    helpPressRef.current = false;
    helpPressStartRef.current = null;
    if (helpTimerRef.current) {
      clearTimeout(helpTimerRef.current);
    }
  }, []);

  if (showAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#16213e] via-[#1a1a2e] to-[#0f3460] flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#e94560]/30">
            <Layers className="text-white" size={28} />
          </div>
          <h2 className="text-xl font-bold text-white text-center mb-1">Acceso Administrativo</h2>
          <p className="text-white/50 text-sm text-center mb-6">Ingresa tus credenciales de admin</p>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input
              type="text"
              placeholder="Usuario administrador"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:border-[#e94560] focus:ring-1 focus:ring-[#e94560] transition-all"
            />
            <input
              type="password"
              placeholder="PIN de administrador"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:border-[#e94560] focus:ring-1 focus:ring-[#e94560] transition-all text-center tracking-[0.5em]"
            />

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
              className="w-full bg-gradient-to-r from-[#e94560] to-[#c23152] text-white font-semibold py-3.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-150"
            >
              Acceder
            </button>

            <button
              type="button"
              onClick={() => setShowAdmin(false)}
              className="w-full text-white/50 text-sm hover:text-white/70 transition-colors py-2"
            >
              Volver
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#16213e] via-[#1a1a2e] to-[#0f3460] flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex flex-col items-center"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#e94560] to-[#c23152] flex items-center justify-center mb-4 shadow-lg shadow-[#e94560]/30">
          <Layers className="text-white" size={36} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">InkaHobby</h1>
        <p className="text-white/50 text-sm">Tu red social creativa</p>
      </motion.div>

      {/* Login Form */}
      <motion.form
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4"
      >
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:border-[#e94560] focus:ring-1 focus:ring-[#e94560] transition-all"
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:border-[#e94560] focus:ring-1 focus:ring-[#e94560] transition-all pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
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
          className="w-full bg-gradient-to-r from-[#e94560] to-[#c23152] text-white font-semibold py-3.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
        >
          Iniciar Sesión
        </button>

        <button
          type="button"
          onClick={onRegister}
          className="w-full text-[#e94560] text-sm font-medium hover:text-[#e94560]/80 transition-colors py-1"
        >
          ¿No tienes cuenta? Regístrate
        </button>
      </motion.form>

      {/* Bottom buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-10 flex items-center gap-4"
      >
        <button
          onTouchStart={handleHelpPress}
          onTouchEnd={handleHelpRelease}
          onMouseDown={handleHelpPress}
          onMouseUp={handleHelpRelease}
          onMouseLeave={handleHelpRelease}
          onClick={onHelp}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/50 text-sm transition-colors"
        >
          <HelpCircle size={16} />
          <span>Ayuda</span>
        </button>
        <div className="w-px h-4 bg-white/10" />
        <button
          onClick={onInstall}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/50 text-sm transition-colors"
        >
          <Download size={16} />
          <span>Instalar App</span>
        </button>
      </motion.div>
    </div>
  );
}
