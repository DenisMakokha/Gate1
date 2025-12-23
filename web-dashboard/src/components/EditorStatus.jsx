import React, { useState, useEffect } from 'react';
import { userService, groupService } from '../services/api';
import { Users, Circle, Monitor, Clock, Filter, RefreshCw } from 'lucide-react';

export default function EditorStatus() {
  const [editors, setEditors] = useState([]);
  const [summary, setSummary] = useState({ total: 0, online: 0, offline: 0 });
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ groupId: '', online: '' });
  const [autoRefresh, setAutoRefresh] = useState(true);

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
              className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
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
    </div>
  );
}
