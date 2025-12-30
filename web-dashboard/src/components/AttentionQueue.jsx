import React, { useState, useEffect } from 'react';
import { dashboardService } from '../services/api';
import { 
  AlertTriangle, XCircle, Info, RefreshCw, CheckCircle, 
  Clock, User, Bell, Filter, ChevronDown
} from 'lucide-react';

export default function AttentionQueue({ eventId }) {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, critical: 0, warning: 0, info: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadAlerts();
    
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadAlerts, 15000); // 15 seconds
    }
    return () => clearInterval(interval);
  }, [eventId, autoRefresh]);

  const loadAlerts = async () => {
    try {
      const response = await dashboardService.getAlerts(eventId);
      setAlerts(response.alerts || []);
      setSummary(response.summary || { total: 0, critical: 0, warning: 0, info: 0 });
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50 hover:bg-red-100';
      case 'warning':
        return 'border-amber-200 bg-amber-50 hover:bg-amber-100';
      default:
        return 'border-blue-200 bg-blue-50 hover:bg-blue-100';
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      'stalled_session': 'Stalled Session',
      'offline_editor': 'Editor Offline',
      'critical_issue': 'Critical Issue',
      'low_disk_space': 'Low Disk Space',
      'backup_failed': 'Backup Failed',
    };
    return labels[type] || type;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              summary.critical > 0 ? 'bg-red-50' : 
              summary.warning > 0 ? 'bg-amber-50' : 'bg-emerald-50'
            }`}>
              <Bell className={`w-5 h-5 ${
                summary.critical > 0 ? 'text-red-600' : 
                summary.warning > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Attention Queue</h2>
              <p className="text-sm text-gray-500">Items requiring supervisor attention</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Summary badges */}
            <div className="flex items-center gap-2">
              {summary.critical > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  {summary.critical} critical
                </span>
              )}
              {summary.warning > 0 && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                  {summary.warning} warning
                </span>
              )}
              {summary.info > 0 && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  {summary.info} info
                </span>
              )}
            </div>
            <button
              onClick={loadAlerts}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="all">All Alerts ({summary.total})</option>
              <option value="critical">Critical ({summary.critical})</option>
              <option value="warning">Warning ({summary.warning})</option>
              <option value="info">Info ({summary.info})</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-sky-600"
            />
            Auto-refresh (15s)
          </label>
        </div>
      </div>

      {/* Alert List */}
      <div className="divide-y divide-gray-100">
        {loading && alerts.length === 0 ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-sky-500" />
            <p className="text-gray-500">Loading alerts...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
            <p className="font-medium text-emerald-700">All Clear!</p>
            <p className="text-sm text-gray-500 mt-1">No alerts requiring attention</p>
          </div>
        ) : (
          filteredAlerts.map((alert, idx) => (
            <div 
              key={idx}
              className={`p-4 border-l-4 transition-colors ${getSeverityStyles(alert.severity)}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  {getSeverityIcon(alert.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{alert.title}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      alert.severity === 'critical' ? 'bg-red-200 text-red-800' :
                      alert.severity === 'warning' ? 'bg-amber-200 text-amber-800' :
                      'bg-blue-200 text-blue-800'
                    }`}>
                      {getTypeLabel(alert.type)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{alert.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {alert.user && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {alert.user}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {alert.time_ago}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    View
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
          <p className="text-sm text-gray-500">
            Showing {filteredAlerts.length} of {alerts.length} alerts
          </p>
        </div>
      )}
    </div>
  );
}
