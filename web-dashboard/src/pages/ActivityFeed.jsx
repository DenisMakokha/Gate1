import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { activityFeedService } from '../services/api';
import {
  Activity,
  Video,
  AlertTriangle,
  HardDrive,
  User,
  CheckCircle,
  Clock,
  Filter,
  RefreshCw,
  Camera,
  Upload,
  Download,
  Edit,
  Trash2,
  UserPlus,
  LogIn,
  LogOut,
  Settings,
  FileText,
} from 'lucide-react';

const activityTypes = {
  media_upload: { icon: Upload, color: 'text-blue-500', bg: 'bg-blue-100' },
  media_edit: { icon: Edit, color: 'text-purple-500', bg: 'bg-purple-100' },
  issue_created: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100' },
  issue_resolved: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100' },
  backup_complete: { icon: HardDrive, color: 'text-green-500', bg: 'bg-green-100' },
  backup_started: { icon: HardDrive, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  user_login: { icon: LogIn, color: 'text-blue-500', bg: 'bg-blue-100' },
  user_logout: { icon: LogOut, color: 'text-gray-500', bg: 'bg-gray-100' },
  user_joined: { icon: UserPlus, color: 'text-green-500', bg: 'bg-green-100' },
  camera_bind: { icon: Camera, color: 'text-purple-500', bg: 'bg-purple-100' },
  qa_approved: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100' },
  settings_changed: { icon: Settings, color: 'text-gray-500', bg: 'bg-gray-100' },
  event_started: { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-100' },
};

export default function ActivityFeed() {
  const { user, activeEvent } = useAuth();
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState('all');
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ today: {}, hourly_activity: [] });

  const filteredActivities = activities.filter(a => {
    if (filter === 'all') return true;
    return a.type.includes(filter);
  });

  const mapActivity = (a) => {
    const userName = a.user?.name || 'System';
    const groupCode = a.group?.code;
    const message = a.description || a.title || '';

    const target = (() => {
      const meta = a.metadata || {};
      return meta.issue_id || meta.media_id || meta.camera_number || meta.disk_label || meta.event_code || null;
    })();

    return {
      id: a.id,
      type: a.type,
      user: userName,
      target,
      message,
      time: a.time_ago || (a.created_at ? new Date(a.created_at).toLocaleString() : ''),
      group: groupCode,
      raw: a,
    };
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [feedRes, statsRes] = await Promise.all([
        activityFeedService.get({ event_id: activeEvent?.id, limit: 100 }),
        activityFeedService.stats({ event_id: activeEvent?.id }),
      ]);

      setActivities((feedRes?.activities || []).map(mapActivity));
      setStats(statsRes || { today: {}, hourly_activity: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [activeEvent?.id]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [isLive, filter, activeEvent?.id]);

  const getActivityIcon = (type) => {
    const config = activityTypes[type] || { icon: Activity, color: 'text-gray-500', bg: 'bg-gray-100' };
    const Icon = config.icon;
    return (
      <div className={`p-2 rounded-full ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
    );
  };

  // Stats
  const todayCount = activities.length;
  const issueCount = stats?.today?.issues_reported ?? activities.filter(a => a.type.includes('issue')).length;
  const mediaCount = (stats?.today?.copies_started ?? 0) + (stats?.today?.copies_completed ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Feed</h1>
          <p className="text-gray-500">Real-time system activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              isLive ? 'bg-green-50 border-green-200 text-green-700' : 'border-gray-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {isLive ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{todayCount}</p>
              <p className="text-sm text-gray-500">Activities Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Video className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{mediaCount}</p>
              <p className="text-sm text-gray-500">Media Activities</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{issueCount}</p>
              <p className="text-sm text-gray-500">Issue Activities</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border-0 bg-transparent text-sm font-medium focus:ring-0"
            >
              <option value="all">All Activities</option>
              <option value="media">Media</option>
              <option value="issue">Issues</option>
              <option value="backup">Backups</option>
              <option value="user">Users</option>
            </select>
          </div>
          <span className="text-sm text-gray-500">
            {filteredActivities.length} activities
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No activities found</p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  {getActivityIcon(activity.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user}</span>
                      {' '}{activity.message}
                      {activity.target && (
                        <span className="font-medium text-blue-600"> {activity.target}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400">{activity.time}</span>
                      {activity.group && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-xs text-gray-500">Group {activity.group}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load More */}
        <div className="p-4 border-t border-gray-100 text-center">
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Load more activities
          </button>
        </div>
      </div>
    </div>
  );
}
