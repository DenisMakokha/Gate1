import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const savedUser = await AsyncStorage.getItem('user');
      
      if (token && savedUser) {
        setUser(JSON.parse(savedUser));
        const response = await authService.me();
        setUser(response.user);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
      }
    } catch (error) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authService.login({ email, password });
    await AsyncStorage.setItem('token', response.authorization.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
    return response;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (e) {}
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  const hasRole = (role) => user?.roles?.includes(role);
  const isAdmin = () => hasRole('admin');
  const isGroupLeader = () => hasRole('group-leader');
  const isQA = () => hasRole('qa');
  const isBackup = () => hasRole('backup');

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      hasRole,
      isAdmin,
      isGroupLeader,
      isQA,
      isBackup,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
