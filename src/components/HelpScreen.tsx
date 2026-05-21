'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  HelpCircle,
  MessageCircle,
  Lock,
  Star,
  Camera,
  Users,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react';

interface HelpScreenProps {
  onBack: () => void;
}

const faqItems = [
  {
    question: '¿Qué es InkaHobby?',
    answer: 'InkaHobby es una red social para entusiastas de pasatiempos. Comparte tus hobbies, descubre nuevas aficiones y conecta con personas que comparten tus intereses.',
    icon: Users,
    color: '#F59E0B',
  },
  {
    question: '¿Cómo creo una cuenta?',
    answer: 'Toca "Crear Cuenta" en la pantalla de inicio. Elige un nombre de usuario único y un PIN de 4 dígitos para acceder a tu perfil personal.',
    icon: HelpCircle,
    color: '#16A34A',
  },
  {
    question: '¿Cómo guardo mis favoritos?',
    answer: 'Navega a la sección "Favoritos" tocando la estrella en la barra inferior. Allí puedes agregar fotos y videos de tus hobbies favoritos tocando el botón +.',
    icon: Star,
    color: '#EA580C',
  },
  {
    question: '¿Mis datos están seguros?',
    answer: 'Sí, todos tus datos se almacenan de forma segura en tu dispositivo. InkaHobby utiliza encriptación local para proteger tu información personal y tus favoritos.',
    icon: Lock,
    color: '#8B5CF6',
  },
  {
    question: '¿Puedo usar la cámara?',
    answer: '¡Por supuesto! Puedes tomar fotos directamente desde la app para guardarlas en tus favoritos. Solo toca el botón de cámara al agregar un nuevo elemento.',
    icon: Camera,
    color: '#EC4899',
  },
  {
    question: '¿Olvidé mi PIN, qué hago?',
    answer: 'Si olvidas tu PIN, necesitarás crear una nueva cuenta. Te recomendamos usar un PIN que sea fácil de recordar pero difícil de adivinar para otros.',
    icon: Shield,
    color: '#EF4444',
  },
];

export default function HelpScreen({ onBack }: HelpScreenProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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
        >
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <HelpCircle size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-1">Centro de Ayuda</h1>
          <p className="text-gray-400 text-sm text-center">Preguntas frecuentes sobre InkaHobby</p>
        </motion.div>
      </div>

      {/* FAQ */}
      <div className="flex-1 px-4 pt-2 pb-8 space-y-2">
        {faqItems.map((item, i) => (
          <motion.div
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="bg-gray-800/50 border-gray-700/50 overflow-hidden">
              <button
                onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                className="w-full"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${item.color}20` }}
                    >
                      <item.icon size={16} style={{ color: item.color }} />
                    </div>
                    <span className="text-white text-sm font-medium text-left flex-1">
                      {item.question}
                    </span>
                    {expandedIndex === i ? (
                      <ChevronUp size={16} className="text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                    )}
                  </div>
                  {expandedIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 pl-11"
                    >
                      <p className="text-gray-400 text-sm leading-relaxed">{item.answer}</p>
                    </motion.div>
                  )}
                </CardContent>
              </button>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
