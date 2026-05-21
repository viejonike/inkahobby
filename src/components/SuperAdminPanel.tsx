'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Shield,
  Users,
  Trash2,
  ArrowLeft,
  RefreshCw,
  LogOut,
  ChevronRight,
  Crown,
  UserCog,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import type { LocalUser } from '@/lib/storage';
import { fetchUsers, fetchFiles } from '@/lib/api';

interface SuperAdminPanelProps {
  user: LocalUser;
  onLogout: () => void;
}

interface ServerUser {
  id: string;
  username: string;
  pin: string;
  role: string;
  createdAt: string;
  _count?: { files: number };
}

export default function SuperAdminPanel({ user, onLogout }: SuperAdminPanelProps) {
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [promoteUser, setPromoteUser] = useState<string | null>(null);

  const loadDataRef = useRef(false);
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const usersData = await fetchUsers();
      setUsers(usersData);
    } catch (err) {
      console.error('Error loading data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loadDataRef.current) {
      loadDataRef.current = true;
      const timer = setTimeout(() => { loadData(); }, 0);
      return () => clearTimeout(timer);
    }
  }, [loadData]);

  const handleDeleteUser = async (userId: string) => {
    try {
      await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
      await loadData();
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const handlePromoteUser = async (userId: string, newRole: string) => {
    try {
      const u = users.find((u) => u.id === userId);
      if (!u) return;
      await fetch('/api/sync/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...u, role: newRole }),
      });
      await loadData();
      setPromoteUser(null);
    } catch (err) {
      console.error('Error promoting user:', err);
    }
  };

  const totalUsers = users.length;
  const adminUsers = users.filter((u) => u.role === 'admin').length;
  const regularUsers = users.filter((u) => u.role === 'user').length;
  const totalFiles = users.reduce((acc, u) => acc + (u._count?.files || 0), 0);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-red-900/30 to-orange-900/30 backdrop-blur-sm border-b border-red-800/30 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Crown size={20} className="text-amber-400" />
          <div>
            <h1 className="text-white font-bold">Super Admin</h1>
            <p className="text-amber-400/70 text-xs">Control Total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={loadData}
            className="text-gray-400 hover:text-white h-8 w-8 p-0"
          >
            <RefreshCw size={16} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onLogout}
            className="text-gray-400 hover:text-white h-8 w-8 p-0"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="text-amber-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* System Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardContent className="p-3 text-center">
                  <Users size={20} className="text-amber-400 mx-auto mb-1" />
                  <p className="text-white font-bold text-xl">{totalUsers}</p>
                  <p className="text-gray-500 text-[10px]">Total Usuarios</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardContent className="p-3 text-center">
                  <BarChart3 size={20} className="text-green-400 mx-auto mb-1" />
                  <p className="text-white font-bold text-xl">{totalFiles}</p>
                  <p className="text-gray-500 text-[10px]">Total Archivos</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardContent className="p-3 text-center">
                  <Shield size={20} className="text-blue-400 mx-auto mb-1" />
                  <p className="text-white font-bold text-xl">{adminUsers}</p>
                  <p className="text-gray-500 text-[10px]">Admins</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardContent className="p-3 text-center">
                  <UserCog size={20} className="text-purple-400 mx-auto mb-1" />
                  <p className="text-white font-bold text-xl">{regularUsers}</p>
                  <p className="text-gray-500 text-[10px]">Usuarios</p>
                </CardContent>
              </Card>
            </div>

            {/* User Management */}
            <Card className="bg-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Users size={16} className="text-amber-400" />
                  Gestión de Usuarios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-900/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {u.username.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium">{u.username}</p>
                            {u.role === 'superadmin' && (
                              <Crown size={12} className="text-amber-400" />
                            )}
                          </div>
                          <p className="text-gray-500 text-xs">
                            {u._count?.files || 0} archivos ·{' '}
                            {new Date(u.createdAt).toLocaleDateString('es')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            u.role === 'superadmin'
                              ? 'border-red-500 text-red-400'
                              : u.role === 'admin'
                              ? 'border-amber-500 text-amber-400'
                              : 'border-gray-600 text-gray-400'
                          }`}
                        >
                          {u.role}
                        </Badge>
                        {u.role !== 'superadmin' && (
                          <div className="flex gap-1 ml-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPromoteUser(u.id)}
                              className="h-7 w-7 p-0 text-amber-400 hover:text-amber-300"
                            >
                              <Shield size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDelete(u.id)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              Confirmar Eliminación
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-300 text-sm">
            ¿Estás seguro de que deseas eliminar este usuario y todos sus archivos? Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} className="text-gray-400">
              Cancelar
            </Button>
            <Button
              onClick={() => confirmDelete && handleDeleteUser(confirmDelete)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote User Dialog */}
      <Dialog open={!!promoteUser} onOpenChange={() => setPromoteUser(null)}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield size={18} className="text-amber-400" />
              Cambiar Rol de Usuario
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-300 text-sm mb-4">
            Selecciona el nuevo rol para este usuario.
          </p>
          <div className="space-y-2">
            <Button
              onClick={() => promoteUser && handlePromoteUser(promoteUser, 'admin')}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Shield size={16} className="mr-2" />
              Promover a Admin
            </Button>
            <Button
              onClick={() => promoteUser && handlePromoteUser(promoteUser, 'user')}
              variant="outline"
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <UserCog size={16} className="mr-2" />
              Degradar a Usuario
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
