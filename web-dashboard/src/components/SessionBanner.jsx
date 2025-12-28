import React from 'react';
import { 
  Activity, 
  Clock, 
  Camera, 
  HardDrive, 
  AlertTriangle, 
  CheckCircle,
  Loader2,
  Play,
  Pause,
  X,
} from 'lucide-react';

const stateConfig = {
  IDLE: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: Clock,
    iconColor: 'text-gray-500',
    title: 'Ready',
    subtitle: 'Waiting for activity',
  },
  SD_DETECTED: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: HardDrive,
    iconColor: 'text-sky-500',
    title: 'SD Card Detected',
    subtitle: 'Preparing session...',
  },
  SESSION_ACTIVE: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: Activity,
    iconColor: 'text-emerald-500',
    title: 'Session Active',
    subtitle: 'Workflow in progress',
  },
  COPYING_IN_PROGRESS: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: Loader2,
    iconColor: 'text-purple-500',
    title: 'Copying Files',
    subtitle: 'Verifying and copying...',
    animate: true,
  },
  BACKUP_IN_PROGRESS: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    icon: HardDrive,
    iconColor: 'text-indigo-500',
    title: 'Backup Running',
    subtitle: 'Backing up to disk...',
    animate: true,
  },
  ATTENTION_REQUIRED: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    title: 'Attention Required',
    subtitle: 'Action needed',
  },
  ISSUE_RECORDED: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: AlertTriangle,
    iconColor: 'text-orange-500',
    title: 'Issue Recorded',
    subtitle: 'Pending QA review',
  },
  SD_REMOVAL_CHECK: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: HardDrive,
    iconColor: 'text-amber-500',
    title: 'SD Removal Check',
    subtitle: 'Verifying safe removal...',
  },
  SESSION_CLOSED: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: CheckCircle,
    iconColor: 'text-emerald-500',
    title: 'Session Complete',
    subtitle: 'All tasks finished',
  },
  RETENTION_PENDING: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: Clock,
    iconColor: 'text-gray-500',
    title: 'Retention Pending',
    subtitle: 'Auto-delete scheduled',
  },
};

function ProgressBar({ percent, color = 'sky' }) {
  const colorMap = {
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full ${colorMap[color] || colorMap.sky} transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export default function SessionBanner({
  state = 'IDLE',
  sessionId,
  eventName,
  cameraNumber,
  progress,
  progressLabel,
  onAction,
  dismissible = false,
  onDismiss,
  className = '',
}) {
  const config = stateConfig[state] || stateConfig.IDLE;
  const Icon = config.icon;

  // Don't show banner for IDLE state unless there's specific content
  if (state === 'IDLE' && !sessionId && !eventName) {
    return null;
  }

  return (
    <div className={`${config.bg} ${config.border} border rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`p-2 rounded-full bg-white/80 ${config.animate ? 'animate-pulse' : ''}`}>
          <Icon className={`w-6 h-6 ${config.iconColor} ${config.animate ? 'animate-spin' : ''}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-gray-900">{config.title}</h4>
              <p className="text-sm text-gray-600">{config.subtitle}</p>
            </div>
            
            {dismissible && onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Session details */}
          {(sessionId || eventName || cameraNumber) && (
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {eventName && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded-lg text-xs font-medium text-gray-700">
                  <Activity className="w-3.5 h-3.5" />
                  {eventName}
                </span>
              )}
              {cameraNumber && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded-lg text-xs font-medium text-gray-700">
                  <Camera className="w-3.5 h-3.5" />
                  Camera {cameraNumber}
                </span>
              )}
              {sessionId && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded-lg text-xs font-medium text-gray-500">
                  ID: {sessionId}
                </span>
              )}
            </div>
          )}

          {/* Progress bar */}
          {progress !== undefined && progress !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">{progressLabel || 'Progress'}</span>
                <span className="text-xs font-medium text-gray-700">{Math.round(progress)}%</span>
              </div>
              <ProgressBar 
                percent={progress} 
                color={state === 'BACKUP_IN_PROGRESS' ? 'indigo' : state === 'COPYING_IN_PROGRESS' ? 'purple' : 'sky'} 
              />
            </div>
          )}

          {/* Actions */}
          {onAction && state === 'ATTENTION_REQUIRED' && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onAction('review')}
                className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
              >
                Review Now
              </button>
              <button
                onClick={() => onAction('dismiss')}
                className="px-3 py-1.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
