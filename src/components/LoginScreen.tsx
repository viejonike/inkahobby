'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Eye, EyeOff, HelpCircle, Download, Smartphone, ChevronDown, ChevronUp, Share, Plus } from 'lucide-react';
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
  const [isPressing, setIsPressing] = useState(false);
  const [showDownloadSection, setShowDownloadSection] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Long press refs - using refs to avoid stale closures
  const pressStartRef = useRef<number | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPressingRef = useRef(false);
  const completedRef = useRef(false); // Track if long press completed
  const progressRef = useRef<SVGCircleElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Detect platform and listen for PWA install prompt
  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    const android = /Android/.test(ua);
    setIsIOS(ios);
    setIsAndroid(android);

    // Listen for beforeinstallprompt (Chrome/Android PWA install)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      isPressingRef.current = false;
      completedRef.current = false;
    };
  }, []);

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

  // Handle Android PWA install prompt
  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        setShowDownloadSection(false);
      }
    }
  };

  // Handle APK download for Android
  const handleDownloadAPK = () => {
    const link = document.createElement('a');
    link.href = '/InkaHobby.apk';
    link.download = 'InkaHobby.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Invisible progress ring animation
  const startProgressAnimation = useCallback(() => {
    const duration = getPressDuration() * 1000;
    const startTime = Date.now();
    completedRef.current = false;

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
      } else if (progress >= 1 && isPressingRef.current) {
        // Completed - trigger secret access
        completedRef.current = true;
        isPressingRef.current = false;
        setIsPressing(false);
        // Reset progress ring after a brief moment
        setTimeout(() => {
          if (progressRef.current) {
            const circumference = 2 * Math.PI * 20;
            progressRef.current.style.strokeDashoffset = circumference.toString();
          }
        }, 300);
        onSecretAccess();
      } else {
        // Released before completion - reset progress ring
        if (progressRef.current) {
          const circumference = 2 * Math.PI * 20;
          progressRef.current.style.strokeDashoffset = circumference.toString();
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [onSecretAccess]);

  const handleHelpPressStart = useCallback(() => {
    // Reset state
    completedRef.current = false;
    isPressingRef.current = true;
    setIsPressing(true);
    pressStartRef.current = Date.now();

    // Cancel any existing animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    // Reset the progress ring
    if (progressRef.current) {
      const circumference = 2 * Math.PI * 20;
      progressRef.current.style.strokeDashoffset = circumference.toString();
    }

    // Start the invisible progress animation
    startProgressAnimation();
  }, [startProgressAnimation]);

  const handleHelpPressEnd = useCallback(() => {
    const wasQuickTap = pressStartRef.current !== null && (Date.now() - pressStartRef.current) < 500;

    isPressingRef.current = false;
    pressStartRef.current = null;
    setIsPressing(false);

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

    // Quick tap = fake help screen, but only if long press didn't complete
    if (wasQuickTap && !completedRef.current) {
      onHelp();
    }

    // Reset completed flag after processing
    completedRef.current = false;
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

      {/* Download / Install Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm mt-6"
      >
        <button
          type="button"
          onClick={() => setShowDownloadSection(!showDownloadSection)}
          className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/60 hover:text-white/80 hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-2">
            <Download size={18} />
            <span className="text-sm font-medium">Instalar InkaHobby</span>
          </div>
          {showDownloadSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <AnimatePresence>
          {showDownloadSection && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-3">
                {/* Android Section */}
                {isAndroid ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone size={16} className="text-green-400" />
                      <span className="text-sm font-medium text-white/80">Android</span>
                    </div>

                    {/* PWA Install (if available) */}
                    {deferredPrompt && (
                      <button
                        type="button"
                        onClick={handleInstallPWA}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl transition-colors active:scale-[0.98]"
                      >
                        <Plus size={18} />
                        <span className="text-sm">Instalar en dispositivo</span>
                      </button>
                    )}

                    {/* APK Download */}
                    <button
                      type="button"
                      onClick={handleDownloadAPK}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#e94560] to-[#c23152] text-white font-medium py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      <Download size={18} />
                      <span className="text-sm">Descargar APK</span>
                    </button>

                    <p className="text-white/30 text-xs text-center leading-relaxed">
                      Descarga e instala el archivo APK para usar InkaHobby directamente en tu dispositivo Android.
                    </p>
                  </div>
                ) : isIOS ? (
                  /* iOS Section */
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone size={16} className="text-blue-400" />
                      <span className="text-sm font-medium text-white/80">iPhone / iPad</span>
                    </div>

                    {!showIOSPrompt ? (
                      <button
                        type="button"
                        onClick={() => setShowIOSPrompt(true)}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors active:scale-[0.98]"
                      >
                        <Plus size={18} />
                        <span className="text-sm">Agregar a pantalla de inicio</span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {/* Step by step iOS instructions */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
                          <p className="text-blue-300 text-xs font-medium text-center mb-3">Sigue estos pasos:</p>

                          {/* Step 1 */}
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-blue-300 text-xs font-bold">1</span>
                            </div>
                            <div>
                              <p className="text-white/70 text-xs">Toca el botón <strong className="text-white">Compartir</strong></p>
                              <div className="flex items-center gap-1 mt-1">
                                <Share size={14} className="text-blue-400" />
                                <span className="text-white/40 text-xs">(icono de compartir en Safari)</span>
                              </div>
                            </div>
                          </div>

                          {/* Step 2 */}
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-blue-300 text-xs font-bold">2</span>
                            </div>
                            <div>
                              <p className="text-white/70 text-xs">Desplázate hacia abajo y selecciona <strong className="text-white">&quot;Agregar a pantalla de inicio&quot;</strong></p>
                              <div className="flex items-center gap-1 mt-1">
                                <Plus size={14} className="text-blue-400" />
                                <span className="text-white/40 text-xs">(icono + con borde)</span>
                              </div>
                            </div>
                          </div>

                          {/* Step 3 */}
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-blue-300 text-xs font-bold">3</span>
                            </div>
                            <p className="text-white/70 text-xs">Toca <strong className="text-white">&quot;Agregar&quot;</strong> en la esquina superior derecha</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowIOSPrompt(false)}
                          className="w-full text-white/40 text-xs hover:text-white/60 transition-colors py-1"
                        >
                          Cerrar instrucciones
                        </button>
                      </div>
                    )}

                    <p className="text-white/30 text-xs text-center leading-relaxed">
                      InkaHobby funciona como app nativa en tu iPhone. Agregarla a tu pantalla de inicio te da acceso rápido y experiencia completa.
                    </p>
                  </div>
                ) : (
                  /* Desktop/Other - Show both options */
                  <div className="space-y-2">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone size={16} className="text-green-400" />
                        <span className="text-sm font-medium text-white/80">Android</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadAPK}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#e94560] to-[#c23152] text-white font-medium py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
                      >
                        <Download size={18} />
                        <span className="text-sm">Descargar APK</span>
                      </button>
                      <p className="text-white/30 text-xs text-center leading-relaxed">
                        Descarga e instala en tu dispositivo Android.
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone size={16} className="text-blue-400" />
                        <span className="text-sm font-medium text-white/80">iPhone / iPad</span>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-2">
                        <p className="text-white/60 text-xs text-center">Abre esta página en Safari y:</p>
                        <div className="flex items-center justify-center gap-2 text-xs text-white/50">
                          <Share size={14} className="text-blue-400" />
                          <span>Toca Compartir</span>
                          <span className="text-white/20">→</span>
                          <Plus size={14} className="text-blue-400" />
                          <span>Agregar a inicio</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bottom Help Button with circular progress ring */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-10 relative"
      >
        {/* SVG progress ring - appears during long press */}
        <svg
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-300 ${isPressing ? 'opacity-100' : 'opacity-0'}`}
          width="60"
          height="60"
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
              transition: 'opacity 0.3s ease',
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
            handleHelpPressEnd();
          }}
          onTouchCancel={handleHelpPressEnd}
          onMouseDown={handleHelpPressStart}
          onMouseUp={handleHelpPressEnd}
          onMouseLeave={handleHelpPressEnd}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/50 text-sm transition-colors select-none touch-manipulation"
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        >
          <HelpCircle size={16} />
          <span>Ayuda</span>
        </button>
      </motion.div>
    </div>
  );
}
