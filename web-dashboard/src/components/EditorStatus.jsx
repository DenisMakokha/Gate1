import React, { useState, useEffect } from 'react';
import { userService, groupService } from '../services/api';
import { Users, Circle, Monitor, Clock, Filter, RefreshCw, Copy, FileEdit, HardDrive, X, Activity, AlertTriangle, Laptop } from 'lucide-react';

// Editor Metrics Modal
function EditorMetricsModal({ editorId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!editorId) return;
    
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const response = await userService.getEditorMetrics(editorId);
        setData(response);
      } catch (error) {
        console.error('Failed to load editor metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [editorId]);

  if (!editorId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-900">Editor Metrics</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-sky-500" />
            <p className="text-gray-500">Loading metrics...</p>
          </div>
        ) : data ? (
          <div className="p-4 space-y-6">
            {/* Editor Info */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 bg-sky-100 rounded-full flex items-center justify-center">
                  <span className="text-sky-700 font-bold text-lg">
                    {data.editor?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                  data.editor?.is_online ? 'bg-emerald-500' : 'bg-gray-400'
                }`} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{data.editor?.name}</h4>
                <p className="text-sm text-gray-500">{data.editor?.email}</p>
                {data.editor?.is_online && (
                  <p className="text-sm text-emerald-600 flex items-center gap-1 mt-1">
                    <Activity className="w-3 h-3" />
                    {data.editor?.current_activity || 'Online'}
                  </p>
                )}
              </div>
            </div>

            {/* Today's Metrics */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-3">Today's Activity</h5>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-sky-50 rounded-xl p-4 text-center">
                  <Copy className="w-6 h-6 text-sky-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-sky-700">{data.metrics?.clips_copied_today || 0}</p>
                  <p className="text-xs text-sky-600">Clips Copied</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <FileEdit className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-amber-700">{data.metrics?.clips_renamed_today || 0}</p>
                  <p className="text-xs text-amber-600">Clips Renamed</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <HardDrive className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-emerald-700">{data.metrics?.clips_backed_up_today || 0}</p>
                  <p className="text-xs text-emerald-600">Clips Backed Up</p>
                </div>
              </div>
            </div>

            {/* All-Time Metrics */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-3">All-Time Totals</h5>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-gray-700">{data.metrics?.clips_copied_total || 0}</p>
                  <p className="text-xs text-gray-500">Total Copied</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-gray-700">{data.metrics?.clips_renamed_total || 0}</p>
                  <p className="text-xs text-gray-500">Total Renamed</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-gray-700">{data.metrics?.clips_backed_up_total || 0}</p>
                  <p className="text-xs text-gray-500">Total Backed Up</p>
                </div>
              </div>
            </div>

            {/* Session Stats */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-3">Session Statistics</h5>
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-gray-700">{data.sessions?.total || 0}</p>
                  <p className="text-xs text-gray-500">Total Sessions</p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-gray-700">{data.sessions?.files_detected || 0}</p>
                  <p className="text-xs text-gray-500">Files Detected</p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-gray-700">{data.sessions?.files_copied || 0}</p>
                  <p className="text-xs text-gray-500">Files Processed</p>
                </div>
              </div>
            </div>

            {/* Issues Stats */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-3">Issues Reported</h5>
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-xl p-4 text-center">
                  <AlertTriangle className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-gray-700">{data.issues?.total_reported || 0}</p>
                  <p className="text-xs text-gray-500">Total Reported</p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-amber-600">{data.issues?.acknowledged || 0}</p>
                  <p className="text-xs text-gray-500">Acknowledged</p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-emerald-600">{data.issues?.resolved || 0}</p>
                  <p className="text-xs text-gray-500">Resolved</p>
                </div>
              </div>
            </div>

            {/* Agent Info */}
            {data.agent && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-3">Desktop Agent</h5>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Laptop className="w-5 h-5 text-gray-500" />
                    <span className="font-medium text-gray-700">{data.agent.device_name || data.agent.agent_id}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      data.agent.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {data.agent.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">OS:</span> <span className="text-gray-700">{data.agent.os || 'N/A'}</span></div>
                    <div><span className="text-gray-500">Version:</span> <span className="text-gray-700">{data.agent.agent_version || 'N/A'}</span></div>
                    <div><span className="text-gray-500">Latency:</span> <span className="text-gray-700">{data.agent.latency_ms ? `${data.agent.latency_ms}ms` : 'N/A'}</span></div>
                    <div><span className="text-gray-500">Last seen:</span> <span className="text-gray-700">{data.agent.last_seen_at ? new Date(data.agent.last_seen_at).toLocaleString() : 'N/A'}</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No metrics available</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditorStatus() {
  const [editors, setEditors] = useState([]);
  const [summary, setSummary] = useState({ total: 0, online: 0, offline: 0 });
  const [totalMetrics, setTotalMetrics] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ groupId: '', online: '' });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedEditorId, setSelectedEditorId] = useState(null);

  useEffect(() => {
    loadGroups();
    loadEditors();
    
    // Auto-refresh every 30 seconds
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadEditors, 30000);
    }
    return () => clearInterval(interval);
  }, [filter, autoRefresh]);

  const loadGroups = async () => {
    try {
      const response = await groupService.getAll();
      setGroups(response.data || response);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const loadEditors = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.groupId) params.group_id = filter.groupId;
      if (filter.online !== '') params.online = filter.online;
      
      const response = await userService.getEditorsStatus(params);
      setEditors(response.editors || []);
      setSummary(response.summary || { total: 0, online: 0, offline: 0 });
      setTotalMetrics(response.metrics || null);
    } catch (error) {
      console.error('Failed to load editors status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-50 rounded-lg">
              <Users className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Editor Status</h2>
              <p className="text-sm text-gray-500">Real-time online/offline tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Summary badges */}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                <Circle className="w-2 h-2 fill-emerald-500" />
                {summary.online} Online
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                <Circle className="w-2 h-2 fill-gray-400" />
                {summary.offline} Offline
              </span>
            </div>
            {/* Refresh button */}
            <button
              onClick={loadEditors}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
              title="Refresh"
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
              value={filter.groupId}
              onChange={(e) => setFilter({ ...filter, groupId: e.target.value })}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Groups</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.group_code} - {group.name}
                </option>
              ))}
            </select>
          </div>
          <select
            value={filter.online}
            onChange={(e) => setFilter({ ...filter, online: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Status</option>
            <option value="true">Online Only</option>
            <option value="false">Offline Only</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            Auto-refresh (30s)
          </label>
        </div>
      </div>

      {/* Editor List */}
      <div className="divide-y divide-gray-50">
        {loading && editors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-sky-500" />
            Loading editors...
          </div>
        ) : editors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No editors found
          </div>
        ) : (
          editors.map((editor) => (
            <div
              key={editor.id}
              onClick={() => setSelectedEditorId(editor.id)}
              className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {/* Avatar with status indicator */}
                <div className="relative">
                  <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
                    <span className="text-sky-700 font-semibold text-sm">
                      {editor.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      editor.is_online ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                  />
                </div>

                {/* Editor info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{editor.name}</span>
                    {editor.is_online && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
                        <Circle className="w-1.5 h-1.5 fill-emerald-500" />
                        Online
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{editor.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Metrics */}
                {editor.metrics && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs" title="Clips copied today">
                      <Copy className="w-3.5 h-3.5 text-sky-500" />
                      <span className="text-gray-700 font-medium">{editor.metrics.clips_copied_today}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs" title="Clips renamed today">
                      <FileEdit className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-gray-700 font-medium">{editor.metrics.clips_renamed_today}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs" title="Clips backed up today">
                      <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-gray-700 font-medium">{editor.metrics.clips_backed_up_today}</span>
                    </div>
                  </div>
                )}

                {/* Groups */}
                {editor.groups?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {editor.groups.slice(0, 2).map((group) => (
                      <span
                        key={group.id}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                      >
                        {group.group_code}
                      </span>
                    ))}
                    {editor.groups.length > 2 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        +{editor.groups.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Activity / Last seen */}
                <div className="text-right min-w-[140px]">
                  {editor.is_online ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Monitor className="w-4 h-4" />
                      <span className="text-sm">{editor.current_activity || 'Active'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{formatLastSeen(editor.last_seen_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Total Metrics Summary */}
      {totalMetrics && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Team Totals (Today)</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm">
                <Copy className="w-4 h-4 text-sky-500" />
                <span className="font-semibold text-gray-700">{totalMetrics.clips_copied_today}</span>
                <span className="text-gray-500">copied</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <FileEdit className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-gray-700">{totalMetrics.clips_renamed_today}</span>
                <span className="text-gray-500">renamed</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <HardDrive className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold text-gray-700">{totalMetrics.clips_backed_up_today}</span>
                <span className="text-gray-500">backed up</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Metrics Modal */}
      {selectedEditorId && (
        <EditorMetricsModal 
          editorId={selectedEditorId} 
          onClose={() => setSelectedEditorId(null)} 
        />
      )}
    </div>
  );
}
