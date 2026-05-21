'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, ArrowLeft, Check, X } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 pt-8 pb-4 px-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={20} />
          <span>Volver</span>
        </button>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <UserPlus size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-1">Crear Cuenta</h1>
          <p className="text-gray-400 text-sm text-center">Únete a la comunidad InkaHobby</p>
        </motion.div>
      </div>

      {/* Registration Form */}
      <div className="flex-1 px-4 pt-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Username */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300 font-medium">Nombre de usuario</label>
                  <Input
                    type="text"
                    placeholder="Elige un nombre único"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-500 focus:border-amber-500 h-12"
                  />
                  <div className="flex items-center gap-1.5 text-xs">
                    {username.length > 0 && (
                      <>
                        {usernameValid ? (
                          <Check size={14} className="text-green-400" />
                        ) : (
                          <X size={14} className="text-red-400" />
                        )}
                        <span className={usernameValid ? 'text-green-400' : 'text-red-400'}>
                          Mínimo 3 caracteres
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* PIN */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300 font-medium">PIN de acceso</label>
                  <Input
                    type="password"
                    placeholder="4 dígitos"
                    value={pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPin(val);
                    }}
                    maxLength={4}
                    className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-500 focus:border-amber-500 h-12 text-center text-xl tracking-[0.5em]"
                  />
                  <div className="flex items-center justify-center gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full transition-all ${
                          i < pin.length ? 'bg-amber-400 scale-110' : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Confirm PIN */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300 font-medium">Confirmar PIN</label>
                  <Input
                    type="password"
                    placeholder="Repite tu PIN"
                    value={confirmPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setConfirmPin(val);
                    }}
                    maxLength={4}
                    className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-500 focus:border-amber-500 h-12"
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

                <Button
                  type="submit"
                  disabled={!usernameValid || !pinValid || !pinsMatch}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Crear Mi Cuenta
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 text-center">
        <span className="text-gray-600 text-xs">InkaHobby v1.0</span>
      </div>
    </div>
  );
}
