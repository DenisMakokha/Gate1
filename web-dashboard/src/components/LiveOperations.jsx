import React, { useState, useEffect, useCallback } from 'react';
import { dashboardService, userService } from '../services/api';
import { 
  Activity, Radio, HardDrive, AlertTriangle, Clock, Users, 
  RefreshCw, Circle, Camera, Copy, FileEdit, CheckCircle,
  XCircle, Wifi, WifiOff, Zap, TrendingUp, ChevronRight
} from 'lucide-react';

// Live Session Card
function SessionCard({ session }) {
  const progress = session.files_total > 0 
    ? Math.round((session.files_copied / session.files_total) * 100) 
    : 0;
  
  const getProgressColor = () => {
    if (progress >= 100) return 'bg-emerald-500';
    if (progress >= 50) return 'bg-sky-500';
    return 'bg-amber-500';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center">
            <Camera className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <span className="font-semibold text-gray-900">Camera {session.camera_number}</span>
            {session.sd_label && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {session.sd_label}
              </span>
            )}
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <Radio className="w-3 h-3 animate-pulse" />
          Live
        </span>
      </div>
      
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <Users className="w-4 h-4" />
        <span>{session.editor_name}</span>
        {session.group_code && (
          <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
            {session.group_code}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium">{session.files_copied} / {session.files_total} files</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getProgressColor()} transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{progress}% complete</span>
          <span>{session.files_pending} pending</span>
        </div>
      </div>
    </div>
  );
}

// Alert Item
function AlertItem({ alert }) {
  const severityStyles = {
    critical: 'border-red-200 bg-red-50',
    warning: 'border-amber-200 bg-amber-50',
    info: 'border-blue-200 bg-blue-50',
  };
  
  const severityIcons = {
    critical: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Circle className="w-5 h-5 text-blue-500" />,
  };

  return (
    <div className={`p-3 rounded-lg border ${severityStyles[alert.severity] || severityStyles.info}`}>
      <div className="flex items-start gap-3">
        {severityIcons[alert.severity]}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm">{alert.title}</p>
          <p className="text-sm text-gray-600 truncate">{alert.message}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            {alert.user && <span>{alert.user}</span>}
            <span>•</span>
            <span>{alert.time_ago}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Editor Status Mini Card
function EditorMiniCard({ editor, onClick }) {
  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-sky-300 cursor-pointer transition-colors"
    >
      <div className="relative">
        <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
          <span className="text-sky-700 font-semibold text-sm">
            {editor.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </span>
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
          editor.is_online ? 'bg-emerald-500' : 'bg-gray-400'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{editor.name}</p>
        <p className="text-xs text-gray-500 truncate">
          {editor.is_online ? editor.current_activity || 'Online' : 'Offline'}
        </p>
      </div>
      {editor.metrics && (
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-sky-600">
            <Copy className="w-3 h-3" />
            {editor.metrics.clips_copied_today}
          </span>
          <span className="flex items-center gap-1 text-emerald-600">
            <HardDrive className="w-3 h-3" />
            {editor.metrics.clips_backed_up_today}
          </span>
        </div>
      )}
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </div>
  );
}

export default function LiveOperations({ eventId }) {
  const [liveData, setLiveData] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [editors, setEditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10); // seconds

  const fetchData = useCallback(async () => {
    try {
      const [liveRes, alertsRes, editorsRes] = await Promise.all([
        dashboardService.getLiveOperations(eventId).catch(() => null),
        dashboardService.getAlerts(eventId).catch(() => null),
        userService.getEditorsStatus({}).catch(() => ({ editors: [] })),
      ]);
      
      if (liveRes) setLiveData(liveRes);
      if (alertsRes) setAlerts(alertsRes);
      if (editorsRes?.editors) setEditors(editorsRes.editors);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch live data:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
    
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchData, refreshInterval * 1000);
    }
    
    return () => clearInterval(interval);
  }, [fetchData, autoRefresh, refreshInterval]);

  const onlineEditors = editors.filter(e => e.is_online);
  const offlineEditors = editors.filter(e => !e.is_online);

  if (loading && !liveData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-sky-500" />
          <p className="text-gray-500">Loading live operations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <Activity className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Live Operations</h2>
            <p className="text-sm text-gray-500">Real-time monitoring dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdate && (
            <span className="text-xs text-gray-500">
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1"
          >
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <Radio className="w-5 h-5" />
            <span className="text-sm font-medium">Active Sessions</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{liveData?.stats?.totalActiveSessions || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sky-600 mb-2">
            <Wifi className="w-5 h-5" />
            <span className="text-sm font-medium">Editors Online</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{onlineEditors.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Camera className="w-5 h-5" />
            <span className="text-sm font-medium">Cameras Healthy</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{liveData?.stats?.camerasHealthy || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Need Attention</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{liveData?.stats?.camerasAttention || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <XCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Early Removals</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{liveData?.stats?.earlyRemovalsToday || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Sessions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-500" />
              Active Copy Sessions
            </h3>
            <span className="text-sm text-gray-500">
              {liveData?.activeSessions?.length || 0} sessions
            </span>
          </div>
          
          {liveData?.activeSessions?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveData.activeSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <Camera className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No active copy sessions</p>
              <p className="text-sm text-gray-400 mt-1">Sessions will appear when editors insert SD cards</p>
            </div>
          )}

          {/* Early Removals */}
          {liveData?.earlyRemovals?.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Early Removals Today
              </h3>
              <div className="space-y-2">
                {liveData.earlyRemovals.map((removal) => (
                  <div key={removal.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5 text-amber-600" />
                      <div>
                        <span className="font-medium text-gray-900">Camera {removal.camera_number}</span>
                        <span className="text-sm text-gray-500 ml-2">by {removal.editor_name}</span>
                      </div>
                    </div>
                    <span className="text-sm text-amber-700">{removal.files_pending} files lost</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Alerts */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Alerts
              </h3>
              {alerts?.summary && (
                <div className="flex items-center gap-2">
                  {alerts.summary.critical > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                      {alerts.summary.critical} critical
                    </span>
                  )}
                  {alerts.summary.warning > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                      {alerts.summary.warning} warning
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {alerts?.alerts?.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {alerts.alerts.slice(0, 5).map((alert, idx) => (
                  <AlertItem key={idx} alert={alert} />
                ))}
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm text-emerald-700">All systems operational</p>
              </div>
            )}
          </div>

          {/* Online Editors */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-500" />
                Online Editors
              </h3>
              <span className="text-sm text-gray-500">{onlineEditors.length} online</span>
            </div>
            
            {onlineEditors.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {onlineEditors.slice(0, 6).map((editor) => (
                  <EditorMiniCard key={editor.id} editor={editor} />
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <WifiOff className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">No editors online</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
