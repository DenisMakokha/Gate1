import React from 'react';
import { AlertTriangle, X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

const reasonTitles = {
  SD_REMOVAL_PENDING: 'SD Card Removed Early',
  WRONG_DESTINATION: 'Wrong Destination Detected',
  DUPLICATE_FILE: 'Potential Duplicate Detected',
  FILENAME_MAJOR: 'Filename Needs Attention',
  SD_SESSION_OVERLAP: 'SD Session Overlap',
  BACKUP_FAILED: 'Backup Failed',
  QUALITY_ISSUE: 'Quality Issue Detected',
  STORAGE_CRITICAL: 'Storage Critical',
  AGENT_OFFLINE: 'Agent Went Offline',
};

const severityConfig = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: XCircle,
    iconColor: 'text-red-500',
    headerBg: 'bg-red-100',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    headerBg: 'bg-amber-100',
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: Info,
    iconColor: 'text-sky-500',
    headerBg: 'bg-sky-100',
  },
};

export default function AttentionModal({ 
  open, 
  onClose, 
  reason, 
  severity = 'warning',
  title,
  message,
  details,
  actions = [],
  onAction,
}) {
  if (!open) return null;

  const config = severityConfig[severity] || severityConfig.warning;
  const Icon = config.icon;
  const displayTitle = title || reasonTitles[reason] || 'Attention Required';

  const handleAction = async (action) => {
    if (onAction) {
      await onAction(action);
    }
    if (action.closeOnClick !== false) {
      onClose();
    }
  };

  const defaultActions = actions.length > 0 ? actions : [
    { id: 'acknowledge', label: 'Acknowledge', variant: 'primary' },
    { id: 'dismiss', label: 'Dismiss', variant: 'secondary' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-lg ${config.bg} ${config.border} border rounded-2xl shadow-2xl overflow-hidden animate-scale-in`}>
        {/* Header */}
        <div className={`${config.headerBg} px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full bg-white/80`}>
              <Icon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{displayTitle}</h3>
              {reason && reason !== displayTitle && (
                <p className="text-sm text-gray-600">{reason}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {message && (
            <p className="text-gray-700 mb-4">{message}</p>
          )}

          {details && (
            <div className="bg-white/60 border border-gray-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Details</p>
              {typeof details === 'object' ? (
                <pre className="text-sm text-gray-700 overflow-auto max-h-40 whitespace-pre-wrap">
                  {JSON.stringify(details, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-gray-700">{details}</p>
              )}
            </div>
          )}

          {severity === 'critical' && (
            <div className="flex items-center gap-2 p-3 bg-red-100 border border-red-200 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">
                This requires immediate attention.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/50 border-t border-gray-200 flex flex-wrap gap-3 justify-end">
          {defaultActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={action.disabled}
              className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                action.variant === 'primary'
                  ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg'
                  : action.variant === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
