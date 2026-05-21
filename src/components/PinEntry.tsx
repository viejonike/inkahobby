'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, ArrowLeft } from 'lucide-react';

interface PinEntryProps {
  onPinCorrect: () => void;
  onBack: () => void;
  correctPinHash: string;
  error: string;
}

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 30; // seconds

export default function PinEntry({ onPinCorrect, onBack, correctPinHash, error }: PinEntryProps) {
  const [pin, setPin] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lockout timer
  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemaining(remaining);

      if (remaining <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        setPin('');
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4 || lockoutUntil) return;

    // Hash the entered PIN and compare
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + '_inkahobby_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const enteredHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (enteredHash === correctPinHash) {
      onPinCorrect();
    } else {
      const newFailed = failedAttempts + 1;
      setFailedAttempts(newFailed);
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 500);

      if (newFailed >= MAX_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION * 1000);
      }
    }
  }, [pin, lockoutUntil, correctPinHash, onPinCorrect, failedAttempts]);

  const handlePinChange = (value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 4);
    setPin(sanitized);
  };

  // Auto-submit when PIN is 4 digits
  useEffect(() => {
    if (pin.length === 4 && !lockoutUntil) {
      handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    }
  }, [pin, lockoutUntil, handleSubmit]);

  const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;

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
          <h1 className="text-2xl font-bold text-white mb-1">InkaHobby</h1>
          <p className="text-white/50 text-sm">Ingresa tu PIN</p>
        </motion.div>
      </div>

      {/* PIN Entry */}
      <div className="flex-1 flex flex-col justify-start px-6 pt-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1, x: shake ? [0, -10, 10, -10, 10, 0] : 0 }}
          transition={{ delay: 0.2, x: { duration: 0.4 } }}
          className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6"
        >
          {/* PIN Dots */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: i < pin.length ? 1.2 : 1,
                  backgroundColor: i < pin.length ? '#e94560' : 'rgba(255,255,255,0.2)',
                }}
                transition={{ duration: 0.15 }}
                className="w-4 h-4 rounded-full"
              />
            ))}
          </div>

          {/* Hidden input for mobile keyboard */}
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => handlePinChange(e.target.value)}
            className="sr-only"
            autoFocus
            disabled={isLocked}
          />

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => !isLocked && handlePinChange(pin + num.toString())}
                disabled={isLocked || pin.length >= 4}
                className="w-full aspect-square rounded-xl bg-white/10 text-white text-2xl font-medium hover:bg-white/20 active:scale-95 transition-all disabled:opacity-30"
              >
                {num}
              </button>
            ))}
            <div /> {/* Empty space */}
            <button
              type="button"
              onClick={() => !isLocked && handlePinChange(pin + '0')}
              disabled={isLocked || pin.length >= 4}
              className="w-full aspect-square rounded-xl bg-white/10 text-white text-2xl font-medium hover:bg-white/20 active:scale-95 transition-all disabled:opacity-30"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handlePinChange(pin.slice(0, -1))}
              disabled={isLocked}
              className="w-full aspect-square rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center"
            >
              ←
            </button>
          </div>

          {/* Lockout message */}
          <AnimatePresence>
            {isLocked && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 text-center"
              >
                <p className="text-red-400 text-sm font-medium">
                  Demasiados intentos. Intenta en {lockoutRemaining}s
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error message */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-sm text-center mt-4"
            >
              {error}
            </motion.p>
          )}

          {/* Failed attempts indicator */}
          {failedAttempts > 0 && !isLocked && (
            <p className="text-white/30 text-xs text-center mt-4">
              {MAX_ATTEMPTS - failedAttempts} intento{MAX_ATTEMPTS - failedAttempts !== 1 ? 's' : ''} restante{MAX_ATTEMPTS - failedAttempts !== 1 ? 's' : ''}
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
