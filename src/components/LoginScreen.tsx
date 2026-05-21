'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layers, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { getPressDuration } from '@/lib/storage';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => void;
  onHelp: () => void;
  onSecretAccess: () => void;
  error: string;
}

export default function LoginScreen({ onLogin, onHelp, onSecretAccess, error }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Long press refs
  const pressStartRef = useRef<number | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPressingRef = useRef(false);
  const progressRef = useRef<SVGCircleElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    onLogin(email, password);
    // Reset submitting after a delay (in case onLogin doesn't navigate)
    setTimeout(() => setIsSubmitting(false), 2000);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    // Always show fake connection error for register too
    onLogin('', ''); // This will trigger the "Error de conexión" in the parent
  };

  // Invisible progress ring animation
  const startProgressAnimation = useCallback(() => {
    const duration = getPressDuration() * 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progressRef.current) {
        const circumference = 2 * Math.PI * 20;
        const offset = circumference * (1 - progress);
        progressRef.current.style.strokeDashoffset = offset.toString();
      }

      if (progress < 1 && isPressingRef.current) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else if (progress >= 1) {
        // Completed - trigger secret access
        onSecretAccess();
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [onSecretAccess]);

  const handleHelpPressStart = useCallback(() => {
    isPressingRef.current = true;
    pressStartRef.current = Date.now();

    // Reset the progress ring
    if (progressRef.current) {
      const circumference = 2 * Math.PI * 20;
      progressRef.current.style.strokeDashoffset = circumference.toString();
    }

    // Start the invisible progress animation
    startProgressAnimation();
  }, [startProgressAnimation]);

  const handleHelpPressEnd = useCallback(() => {
    isPressingRef.current = false;
    pressStartRef.current = null;

    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Reset the progress ring
    if (progressRef.current) {
      const circumference = 2 * Math.PI * 20;
      progressRef.current.style.strokeDashoffset = circumference.toString();
    }
  }, []);

  const handleHelpClick = useCallback(() => {
    // Quick tap -> show fake help screen
    // Only trigger if it was a quick tap (not a long press that completed)
    if (!isPressingRef.current && pressStartRef.current === null) {
      onHelp();
    }
  }, [onHelp]);

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
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-[#e94560] to-[#c23152] text-white font-semibold py-3.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
        >
          Iniciar Sesión
        </button>

        <button
          type="button"
          onClick={handleRegister}
          className="w-full text-[#e94560] text-sm font-medium hover:text-[#e94560]/80 transition-colors py-1"
        >
          ¿No tienes cuenta? Regístrate
        </button>
      </motion.form>

      {/* Bottom Help Button with invisible progress ring */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-10 relative"
      >
        {/* Invisible SVG progress ring */}
        <svg
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          width="60"
          height="60"
          style={{ opacity: 0 }}
        >
          <circle
            cx="30"
            cy="30"
            r="20"
            fill="none"
            stroke="#e94560"
            strokeWidth="3"
            strokeLinecap="round"
            ref={progressRef}
            style={{
              strokeDasharray: 2 * Math.PI * 20,
              strokeDashoffset: 2 * Math.PI * 20,
              transform: 'rotate(-90deg)',
              transformOrigin: '30px 30px',
            }}
          />
        </svg>

        <button
          onTouchStart={(e) => {
            e.preventDefault();
            handleHelpPressStart();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            const wasQuickTap = pressStartRef.current && (Date.now() - pressStartRef.current) < 500;
            handleHelpPressEnd();
            if (wasQuickTap) {
              onHelp();
            }
          }}
          onTouchCancel={handleHelpPressEnd}
          onMouseDown={handleHelpPressStart}
          onMouseUp={() => {
            const wasQuickTap = pressStartRef.current && (Date.now() - pressStartRef.current) < 500;
            handleHelpPressEnd();
            if (wasQuickTap) {
              onHelp();
            }
          }}
          onMouseLeave={handleHelpPressEnd}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/50 text-sm transition-colors"
        >
          <HelpCircle size={16} />
          <span>Ayuda</span>
        </button>
      </motion.div>
    </div>
  );
}
