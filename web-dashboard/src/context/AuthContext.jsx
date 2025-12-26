import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, eventService } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      
      // Load user and active event in parallel
      Promise.all([
        authService.me(),
        eventService.getActive().catch(() => ({ event: null }))
      ]).then(([userRes, eventRes]) => {
        setUser(userRes.user);
        localStorage.setItem('user', JSON.stringify(userRes.user));
        setActiveEvent(eventRes.event || eventRes.data || null);
      }).catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const refreshActiveEvent = async () => {
    try {
      const response = await eventService.getActive();
      setActiveEvent(response.event || response.data || null);
      return response.event || response.data || null;
    } catch (e) {
      setActiveEvent(null);
      return null;
    }
  };

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
  const isTeamLead = () => hasRole('team-lead');
  const isGroupLeader = () => hasRole('group-leader');
  const isQALead = () => hasRole('qa-lead');
  const isQA = () => hasRole('qa');
  const isBackupLead = () => hasRole('backup-lead');
  const isBackup = () => hasRole('backup');
  const isEditor = () => hasRole('editor');
  
  // Helper: Has operational admin rights (admin or team-lead)
  const hasOperationalAccess = () => isAdmin() || isTeamLead();
  
  // Helper: Can manage users (any lead role)
  const canManageUsers = () => isAdmin() || isTeamLead() || isGroupLeader() || isQALead() || isBackupLead();

  return (
    <AuthContext.Provider value={{
      user,
      activeEvent,
      loading,
      login,
      logout,
      refreshActiveEvent,
      hasRole,
      hasAnyRole,
      isAdmin,
      isTeamLead,
      isGroupLeader,
      isQALead,
      isQA,
      isBackupLead,
      isBackup,
      isEditor,
      hasOperationalAccess,
      canManageUsers,
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
