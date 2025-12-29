import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { issueService } from '../services/api';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  Filter,
  Settings,
} from 'lucide-react';

export default function Notifications() {
  const { activeEvent } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    issues: true,
    backups: true,
    storage: true,
    users: true,
    qa: true,
  });

  useEffect(() => {
    loadNotifications();
  }, [activeEvent?.id]);

  const formatTimeAgo = (dateValue) => {
    if (!dateValue) return '—';
    const date = new Date(dateValue);
    const now = new Date();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      if (!activeEvent?.id) {
        setNotifications([]);
        return;
      }

      const res = await issueService.getAll({
        event_id: activeEvent.id,
        status: 'open',
        per_page: 10,
      });

      const issues = res?.data || [];

      const mapped = issues.map((issue) => {
        const severity = (issue.severity || 'info').toLowerCase();
        const type = severity === 'critical' ? 'alert' : severity === 'high' ? 'warning' : 'info';
        const title = severity === 'critical' ? 'Critical Issue Reported' : 'Issue Reported';
        const camera = issue?.media?.camera_number || issue?.camera_number;

        return {
          id: issue.issue_id || issue.id,
          type,
          title,
          message: `${issue.type?.replaceAll('_', ' ') || 'Issue'}${camera ? ` • Camera ${camera}` : ''}`,
          time: formatTimeAgo(issue.created_at),
          read: false,
          link: '/issues',
        };
      });

      setNotifications(mapped);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getBgColor = (type, read) => {
    if (read) return 'bg-white';
    switch (type) {
      case 'alert': return 'bg-red-50';
      case 'warning': return 'bg-yellow-50';
      case 'success': return 'bg-green-50';
      case 'info': return 'bg-blue-50';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            Preferences
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-medium mb-3">Notification Preferences</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(preferences).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={() => setPreferences(prev => ({ ...prev, [key]: !prev[key] }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm capitalize">{key}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border-0 bg-transparent text-sm font-medium focus:ring-0"
            >
              <option value="all">All Notifications</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No notifications</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 ${getBgColor(notification.type, notification.read)} hover:bg-gray-50 transition-colors`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400">{notification.time}</span>
                      {notification.link && (
                        <a
                          href={notification.link}
                          className="text-xs text-blue-600 hover:underline ml-2"
                        >
                          View details →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
