import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/api';
import {
  Activity,
  Camera,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader,
  Wifi,
  WifiOff,
  HardDrive,
  RefreshCw,
  Circle,
  XCircle,
} from 'lucide-react';

// Real-time session status card
function SessionCard({ session }) {
  const progress = session.files_total > 0 
    ? Math.round((session.files_copied / session.files_total) * 100) 
    : 0;
  
  const getStatusColor = () => {
    if (session.status === 'completed') return 'border-green-200 bg-green-50';
    if (session.status === 'early_removal') return 'border-red-200 bg-red-50';
    if (progress < 25) return 'border-red-200 bg-red-50';
    if (progress < 75) return 'border-yellow-200 bg-yellow-50';
    return 'border-blue-200 bg-blue-50';
  };

  const getStatusBadge = () => {
    if (session.status === 'completed') {
      return <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle className="w-3 h-3" /> Complete</span>;
    }
    if (session.status === 'early_removal') {
      return <span className="flex items-center gap-1 text-red-600 text-xs font-medium"><XCircle className="w-3 h-3" /> Early Removal!</span>;
    }
    if (session.status === 'active') {
      return <span className="flex items-center gap-1 text-blue-600 text-xs font-medium"><Loader className="w-3 h-3 animate-spin" /> Copying</span>;
    }
    return <span className="text-gray-500 text-xs">{session.status}</span>;
  };

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${getStatusColor()}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Camera className="w-5 h-5 text-gray-700" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              Camera {session.camera_number}{session.sd_label || ''}
            </h3>
            <p className="text-sm text-gray-500">{session.event_name || 'Unknown Event'}</p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
        <User className="w-4 h-4" />
        <span>{session.editor_name || 'Unknown'}</span>
        <span className="text-gray-300">•</span>
        <span>{session.group_code || ''}</span>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">{session.files_copied} / {session.files_total} files</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              progress === 100 ? 'bg-green-500' : 
              progress < 25 ? 'bg-red-500' : 
              progress < 75 ? 'bg-yellow-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Started {new Date(session.started_at).toLocaleTimeString()}
        </span>
        {session.files_pending > 0 && (
          <span className="text-orange-600 font-medium">
            {session.files_pending} pending
          </span>
        )}
      </div>
    </div>
  );
}

// Early removal warning card
function EarlyRemovalCard({ removal }) {
  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-red-100 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-red-900">Early SD Removal</h4>
          <p className="text-sm text-red-700">
            Camera {removal.camera_number}{removal.sd_label} - {removal.files_pending} files not copied
          </p>
          <p className="text-xs text-red-600 mt-1">
            {removal.editor_name} • {new Date(removal.removed_at).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// Camera health indicator
function CameraHealthCard({ camera }) {
  const getHealthColor = () => {
    if (camera.health_score >= 80) return { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-500' };
    if (camera.health_score >= 50) return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-500' };
    return { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500' };
  };

  const colors = getHealthColor();

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <Circle className={`w-3 h-3 fill-current ${colors.icon}`} />
        <span className="font-medium text-gray-900">Camera {camera.camera_number}</span>
      </div>
      <div className="text-right">
        <span className="text-sm font-medium">{camera.health_score}%</span>
        {camera.open_issues > 0 && (
          <span className="ml-2 text-xs text-red-600">{camera.open_issues} issues</span>
        )}
      </div>
    </div>
  );
}

export default function LiveOperations() {
  const { activeEvent, isAdmin, isTeamLead, isGroupLeader } = useAuth();
  const [isLive, setIsLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    activeSessions: [],
    earlyRemovals: [],
    cameraHealth: [],
    stats: {
      totalActiveSessions: 0,
      editorsOnline: 0,
      camerasHealthy: 0,
      camerasAttention: 0,
      earlyRemovalsToday: 0,
    }
  });

  const fetchData = useCallback(async () => {
    try {
      if (!activeEvent?.id) {
        setData({
          activeSessions: [],
          earlyRemovals: [],
          cameraHealth: [],
          stats: {
            totalActiveSessions: 0,
            editorsOnline: 0,
            camerasHealthy: 0,
            camerasAttention: 0,
            earlyRemovalsToday: 0,
          }
        });
        setLoading(false);
        return;
      }

      const response = await dashboardService.getLiveOperations(activeEvent.id);
      setData({
        activeSessions: response.activeSessions || [],
        earlyRemovals: response.earlyRemovals || [],
        cameraHealth: response.cameraHealth || [],
        stats: response.stats || {
          totalActiveSessions: 0,
          editorsOnline: 0,
          camerasHealthy: 0,
          camerasAttention: 0,
          earlyRemovalsToday: 0,
        }
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch live operations:', error);
    } finally {
      setLoading(false);
    }
  }, [activeEvent?.id]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time polling
  useEffect(() => {
    let interval;
    if (isLive) {
      interval = setInterval(fetchData, 3000); // Update every 3 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="w-7 h-7 text-blue-600" />
            Live Operations
            {isLive && (
              <span className="flex items-center gap-1.5 text-sm font-normal text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </h1>
          <p className="text-gray-500">
            Real-time SD sessions and camera activity • Updated: {lastUpdated.toLocaleTimeString()}
          </p>
          {activeEvent?.name ? (
            <p className="text-sm text-gray-500 mt-1">
              Active event: <span className="font-medium text-blue-600">{activeEvent.name}</span>
            </p>
          ) : null}
        </div>
        <button
          onClick={() => setIsLive(!isLive)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            isLive 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {isLive ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isLive ? 'Live Updates On' : 'Live Updates Off'}
        </button>
      </div>

      {!activeEvent?.id && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          You must activate an event before viewing live operations.
        </div>
      )}

      {/* Quick Stats - Signals, not metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-blue-700">{data.stats.totalActiveSessions}</div>
          <div className="text-sm text-blue-600">Active Sessions</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{data.stats.editorsOnline}</div>
          <div className="text-sm text-green-600">Editors Online</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{data.stats.camerasHealthy}</div>
          <div className="text-sm text-green-600">Cameras Healthy</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-yellow-700">{data.stats.camerasAttention}</div>
          <div className="text-sm text-yellow-600">Need Attention</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${
          data.stats.earlyRemovalsToday > 0 
            ? 'bg-red-50 border border-red-200' 
            : 'bg-gray-50 border border-gray-200'
        }`}>
          <div className={`text-3xl font-bold ${data.stats.earlyRemovalsToday > 0 ? 'text-red-700' : 'text-gray-400'}`}>
            {data.stats.earlyRemovalsToday}
          </div>
          <div className={`text-sm ${data.stats.earlyRemovalsToday > 0 ? 'text-red-600' : 'text-gray-500'}`}>
            Early Removals Today
          </div>
        </div>
      </div>

      {/* Early Removal Warnings - Most Critical */}
      {data.earlyRemovals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-red-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Early Removal Warnings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.earlyRemovals.map(removal => (
              <EarlyRemovalCard key={removal.id} removal={removal} />
            ))}
          </div>
        </div>
      )}

      {/* Active Sessions Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-blue-600" />
          Active SD Sessions
          <span className="text-sm font-normal text-gray-500">
            ({data.activeSessions.filter(s => s.status === 'active').length} active)
          </span>
        </h2>
        
        {data.activeSessions.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <HardDrive className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No active SD sessions</p>
            <p className="text-sm text-gray-400">Sessions will appear here when editors insert SD cards</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.activeSessions.map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>

      {/* Camera Health Overview */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Camera className="w-5 h-5 text-gray-600" />
          Camera Health
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {data.cameraHealth.map(camera => (
            <CameraHealthCard key={camera.camera_number} camera={camera} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Health based on issue frequency, severity, and resolution time
        </p>
      </div>

      {/* Observation Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-700">
          <strong>📋 Observation Only</strong> — This view is for monitoring. 
          Problems should be addressed by contacting editors directly or through the Issues module.
        </p>
      </div>
    </div>
  );
}
