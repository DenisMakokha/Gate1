import React, { useState, useEffect } from 'react';
import { auditLogService } from '../services/api';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  User,
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Clock,
  Database,
} from 'lucide-react';

function LogDetailModal({ log, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Audit Log Details</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase">Action</label>
              <p className="font-medium">{log.action}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">Timestamp</label>
              <p className="font-medium">{new Date(log.created_at).toLocaleString()}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">User</label>
              <p className="font-medium">{log.user?.name || 'System'}</p>
              <p className="text-sm text-gray-500">{log.user?.email}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">IP Address</label>
              <p className="font-medium">{log.ip_address || 'N/A'}</p>
            </div>
          </div>

          {log.entity_type && (
            <div>
              <label className="text-xs text-gray-500 uppercase">Entity</label>
              <p className="font-medium">{log.entity_type} #{log.entity_id}</p>
            </div>
          )}

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <label className="text-xs text-gray-500 uppercase mb-2 block">Metadata</label>
              <pre className="bg-gray-50 p-3 rounded-lg text-sm overflow-auto max-h-48">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value?.toLocaleString() || 0}</p>
          <p className="text-sm text-gray-500">{title}</p>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [actions, setActions] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    entity_type: '',
    date_from: '',
    date_to: '',
  });
  
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters, pagination.current_page]);

  const loadInitialData = async () => {
    try {
      const [statsRes, actionsRes, typesRes] = await Promise.all([
        auditLogService.getStats(),
        auditLogService.getActions(),
        auditLogService.getEntityTypes(),
      ]);
      setStats(statsRes);
      setActions(actionsRes || []);
      setEntityTypes(typesRes || []);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await auditLogService.getAll({
        ...filters,
        page: pagination.current_page,
        per_page: pagination.per_page,
      });
      setLogs(response.data || []);
      setPagination(prev => ({
        ...prev,
        current_page: response.current_page,
        last_page: response.last_page,
        total: response.total,
      }));
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      action: '',
      entity_type: '',
      date_from: '',
      date_to: '',
    });
  };

  const goToPage = (page) => {
    setPagination(prev => ({ ...prev, current_page: page }));
  };

  const actionColors = {
    'user.create': 'bg-green-100 text-green-700',
    'user.update': 'bg-blue-100 text-blue-700',
    'user.delete': 'bg-red-100 text-red-700',
    'auth.login': 'bg-purple-100 text-purple-700',
    'auth.logout': 'bg-gray-100 text-gray-700',
    'media.sync': 'bg-cyan-100 text-cyan-700',
    'issue.report': 'bg-orange-100 text-orange-700',
    'issue.resolve': 'bg-green-100 text-green-700',
  };

  const getActionColor = (action) => {
    return actionColors[action] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-500">Track all system activities and changes</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard title="Total Logs" value={stats.total} icon={Database} color="blue" />
          <StatsCard title="Today" value={stats.today} icon={Clock} color="green" />
          <StatsCard title="This Week" value={stats.this_week} icon={Calendar} color="yellow" />
          <StatsCard title="This Month" value={stats.this_month} icon={Activity} color="purple" />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>

            <select
              value={filters.entity_type}
              onChange={(e) => handleFilterChange('entity_type', e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Entities</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="From"
            />

            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="To"
            />

            {(filters.search || filters.action || filters.entity_type || filters.date_from || filters.date_to) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{log.user?.name || 'System'}</p>
                            <p className="text-xs text-gray-500">{log.user?.email || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {log.entity_type ? `${log.entity_type} #${log.entity_id}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {logs.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No audit logs found</p>
                </div>
              )}
            </div>

            {pagination.last_page > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {((pagination.current_page - 1) * pagination.per_page) + 1} to{' '}
                  {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of{' '}
                  {pagination.total} results
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(pagination.current_page - 1)}
                    disabled={pagination.current_page === 1}
                    className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {pagination.current_page} of {pagination.last_page}
                  </span>
                  <button
                    onClick={() => goToPage(pagination.current_page + 1)}
                    disabled={pagination.current_page === pagination.last_page}
                    className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
