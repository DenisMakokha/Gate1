import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      authService.me().then(response => {
        setUser(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
      }).catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await authService.login({ email, password });
    localStorage.setItem('token', response.authorization.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
    return response;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      // Ignore logout errors
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasRole = (role) => {
    return user?.roles?.includes(role);
  };

  const hasAnyRole = (roles) => {
    return roles.some(role => user?.roles?.includes(role));
  };

  const isAdmin = () => hasRole('admin');
  const isGroupLeader = () => hasRole('group-leader');
  const isQA = () => hasRole('qa');
  const isBackup = () => hasRole('backup');
  const isEditor = () => hasRole('editor');

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      hasRole,
      hasAnyRole,
      isAdmin,
      isGroupLeader,
      isQA,
      isBackup,
      isEditor,
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
