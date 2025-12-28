import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  HardDrive, 
  Camera, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info,
  Clock,
  User,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const sourceIcons = {
  sd: HardDrive,
  backup: HardDrive,
  snapshot: Camera,
  session: Activity,
  copy: HardDrive,
  issues: AlertTriangle,
  attention: AlertTriangle,
  rename: Info,
  system: Activity,
  user: User,
  network: Wifi,
};

const kindColors = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'text-emerald-500',
    dot: 'bg-emerald-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    dot: 'bg-amber-500',
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: 'text-sky-500',
    dot: 'bg-sky-500',
  },
};

function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '-';
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function ActivityItem({ item, expanded, onToggle }) {
  const Icon = sourceIcons[item.source] || Activity;
  const colors = kindColors[item.kind] || kindColors.info;
  const hasDetails = item.details && Object.keys(item.details).length > 0;

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-xl p-3 transition-all hover:shadow-sm`}>
      <div className="flex items-start gap-3">
        {/* Timeline dot */}
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${colors.icon}`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>
            <span className="text-xs text-gray-500 whitespace-nowrap">{formatTime(item.createdAt)}</span>
          </div>
          
          {item.message && (
            <p className="text-sm text-gray-600 mt-0.5">{item.message}</p>
          )}

          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.icon}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
              {item.source}
            </span>
            
            {hasDetails && (
              <button
                onClick={() => onToggle(item.id)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? 'Hide' : 'Details'}
              </button>
            )}
          </div>

          {expanded && hasDetails && (
            <div className="mt-2 p-2 bg-white/60 rounded-lg border border-gray-200">
              <pre className="text-xs text-gray-600 overflow-auto max-h-32 whitespace-pre-wrap">
                {JSON.stringify(item.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LiveActivityFeed({ 
  items = [], 
  maxItems = 20,
  title = 'Live Activity',
  showRefresh = true,
  onRefresh,
  compact = false,
  className = '',
}) {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [filter, setFilter] = useState('all');

  const toggleExpanded = useCallback((id) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const filteredItems = items
    .filter(item => filter === 'all' || item.kind === filter)
    .slice(0, maxItems);

  const kindCounts = items.reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter pills */}
          <div className="hidden sm:flex items-center gap-1">
            {['all', 'success', 'warning', 'error', 'info'].map(kind => (
              <button
                key={kind}
                onClick={() => setFilter(kind)}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  filter === kind
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {kind === 'all' ? 'All' : kind.charAt(0).toUpperCase() + kind.slice(1)}
                {kind !== 'all' && kindCounts[kind] > 0 && (
                  <span className="ml-1 opacity-70">({kindCounts[kind]})</span>
                )}
              </button>
            ))}
          </div>
          
          {showRefresh && onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Activity list */}
      <div className={`p-4 space-y-3 overflow-y-auto ${compact ? 'max-h-64' : 'max-h-96'}`}>
        {filteredItems.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No activity yet</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <ActivityItem
              key={item.id}
              item={item}
              expanded={expandedItems.has(item.id)}
              onToggle={toggleExpanded}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {items.length > maxItems && (
        <div className="px-4 py-2 border-t border-gray-100 text-center">
          <span className="text-xs text-gray-500">
            Showing {maxItems} of {items.length} activities
          </span>
        </div>
      )}
    </div>
  );
}
