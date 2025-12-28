import React, { createContext, useContext, useReducer, useCallback } from 'react';

const ToastContext = createContext(null);

const toastReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TOAST':
      return [action.toast, ...state].slice(0, 5);
    case 'REMOVE_TOAST':
      return state.filter(t => t.id !== action.id);
    case 'CLEAR_ALL':
      return [];
    default:
      return state;
  }
};

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const addToast = useCallback((toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newToast = { ...toast, id, createdAt: Date.now() };
    dispatch({ type: 'ADD_TOAST', toast: newToast });
    
    // Auto-dismiss after duration (default 4.5s)
    const duration = toast.duration || 4500;
    if (duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', id });
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: 'REMOVE_TOAST', id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  // Convenience methods
  const success = useCallback((title, message, options = {}) => {
    return addToast({ kind: 'success', title, message, ...options });
  }, [addToast]);

  const error = useCallback((title, message, options = {}) => {
    return addToast({ kind: 'error', title, message, ...options });
  }, [addToast]);

  const warning = useCallback((title, message, options = {}) => {
    return addToast({ kind: 'warning', title, message, ...options });
  }, [addToast]);

  const info = useCallback((title, message, options = {}) => {
    return addToast({ kind: 'info', title, message, ...options });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll, success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
