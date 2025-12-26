import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { activityFeedService } from '../services/api';
import {
  Activity,
  Copy,
  CheckCircle,
  AlertTriangle,
  CloudUpload,
  Shield,
  Radio,
  HardDrive,
  RefreshCw,
  Clock,
} from 'lucide-react';

const iconMap = {
  copy: Copy,
  'checkmark-circle': CheckCircle,
  warning: AlertTriangle,
  'cloud-upload': CloudUpload,
  'shield-checkmark': Shield,
  'alert-circle': AlertTriangle,
  'checkmark-done': CheckCircle,
  'radio-button-on': Radio,
  'radio-button-off': Radio,
  'hardware-chip': HardDrive,
};

const colorMap = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-emerald-100 text-emerald-600',
  orange: 'bg-amber-100 text-amber-600',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-600',
  gray: 'bg-gray-100 text-gray-500',
};

function ActivityItem({ activity }) {
  const Icon = iconMap[activity.icon] || Activity;
  const colorClass = colorMap[activity.color] || colorMap.gray;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className={`p-2 rounded-lg ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
        {activity.description && (
          <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {activity.group && (
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
              {activity.group.code}
            </span>
          )}
          <span className="text-xs text-gray-400">{activity.time_ago}</span>
        </div>
      </div>
    </div>
  );
}

export default function ActivityFeed({ compact = false, limit = 20 }) {
  const { activeEvent } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [activeEvent?.id]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const response = await activityFeedService.getAll({
        event_id: activeEvent?.id,
        limit,
      });
      setActivities(response.activities || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-500" />
            Recent Activity
          </h3>
          <button
            onClick={loadActivities}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          {activities.length > 0 ? (
            activities.slice(0, 10).map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))
          ) : (
            <p className="text-center text-gray-500 py-4">No recent activity</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Activity Feed</h2>
          {activeEvent && (
            <p className="text-sm text-gray-500">
              Event: <span className="font-medium text-sky-600">{activeEvent.name}</span>
            </p>
          )}
        </div>
        <button
          onClick={loadActivities}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4">
          {loading && activities.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-0">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No activity recorded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
