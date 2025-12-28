import React from 'react';
import { useToast } from '../context/ToastContext';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'text-emerald-500',
    title: 'text-emerald-800',
    message: 'text-emerald-600',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
    message: 'text-red-600',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    title: 'text-amber-800',
    message: 'text-amber-600',
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: 'text-sky-500',
    title: 'text-sky-800',
    message: 'text-sky-600',
  },
};

export default function Toasts() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.kind] || Info;
        const colors = colorMap[toast.kind] || colorMap.info;

        return (
          <div
            key={toast.id}
            className={`${colors.bg} ${colors.border} border rounded-xl p-4 shadow-lg animate-slide-in-right flex items-start gap-3`}
            role="alert"
          >
            <Icon className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${colors.title}`}>{toast.title}</p>
              {toast.message && (
                <p className={`text-sm mt-0.5 ${colors.message}`}>{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
