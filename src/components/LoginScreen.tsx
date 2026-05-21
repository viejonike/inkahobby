'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Users, Palette, Camera, BookOpen, HelpCircle, LogIn, UserPlus, Shield, Eye, EyeOff } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string, pin: string) => void;
  onRegister: () => void;
  onAdminLogin: (username: string, pin: string) => void;
  onHelp: () => void;
  error: string;
}

const hobbyIcons = [
  { icon: Camera, label: 'Fotografía', color: '#F59E0B' },
  { icon: Palette, label: 'Pintura', color: '#EA580C' },
  { icon: BookOpen, label: 'Lectura', color: '#16A34A' },
  { icon: Users, label: 'Comunidad', color: '#8B5CF6' },
];

export default function LoginScreen({ onLogin, onRegister, onAdminLogin, onHelp, error }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpPressRef = useRef(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, pin);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    onAdminLogin(adminUsername, adminPin);
  };

  const handleHelpPress = useCallback(() => {
    helpPressRef.current = true;
    helpTimerRef.current = setTimeout(() => {
      if (helpPressRef.current) {
        setShowAdmin(true);
      }
    }, 1500);
  }, []);

  const handleHelpRelease = useCallback(() => {
    helpPressRef.current = false;
    if (helpTimerRef.current) {
      clearTimeout(helpTimerRef.current);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header Section */}
      <div className="flex-shrink-0 pt-8 pb-4 px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-3xl font-bold text-white">IH</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">InkaHobby</h1>
          <p className="text-gray-400 text-sm">Tu red social de pasatiempos</p>
        </motion.div>

        {/* Hobby Icons */}
        <div className="flex justify-center gap-4 mt-4">
          {hobbyIcons.map((h, i) => (
            <motion.div
              key={h.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${h.color}20` }}
              >
                <h.icon size={22} style={{ color: h.color }} />
              </div>
              <span className="text-[10px] text-gray-500">{h.label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex flex-col justify-start px-4 pt-4">
        <AnimatePresence mode="wait">
          {!showAdmin ? (
            <motion.div
              key="user-login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <LogIn size={18} className="text-amber-400" />
                    Iniciar Sesión
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Nombre de usuario"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-500 focus:border-amber-500 h-12"
                      />
                    </div>
                    <div className="space-y-2 relative">
                      <Input
                        type={showPin ? 'text' : 'password'}
                        placeholder="PIN de acceso"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        maxLength={4}
                        className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-500 focus:border-amber-500 h-12 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
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

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
                    >
                      Entrar
                    </Button>

                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex-1 h-px bg-gray-700" />
                      <span className="text-gray-500 text-xs">o</span>
                      <div className="flex-1 h-px bg-gray-700" />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={onRegister}
                      className="w-full h-12 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                    >
                      <UserPlus size={18} className="mr-2" />
                      Crear Cuenta
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="admin-login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Shield size={18} className="text-amber-400" />
                    Acceso Administrativo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <Input
                      type="text"
                      placeholder="Usuario administrador"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-500 focus:border-amber-500 h-12"
                    />
                    <Input
                      type="password"
                      placeholder="PIN de administrador"
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      maxLength={4}
                      className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-500 focus:border-amber-500 h-12"
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

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
                    >
                      <Shield size={18} className="mr-2" />
                      Acceder
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAdmin(false)}
                      className="w-full text-gray-400 hover:text-white"
                    >
                      Volver
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer with Help button (long press for admin) */}
      <div className="flex-shrink-0 px-6 py-4 flex justify-between items-center">
        <button
          onTouchStart={handleHelpPress}
          onTouchEnd={handleHelpRelease}
          onMouseDown={handleHelpPress}
          onMouseUp={handleHelpRelease}
          onMouseLeave={handleHelpRelease}
          onClick={onHelp}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          <HelpCircle size={16} />
          <span>Ayuda</span>
        </button>
        <span className="text-gray-600 text-xs">InkaHobby v1.0</span>
      </div>
    </div>
  );
}
