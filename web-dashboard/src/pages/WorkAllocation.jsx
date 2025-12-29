import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { workAllocationService } from '../services/api';
import {
  Users,
  UserCheck,
  Clock,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Circle,
  Mail,
  MapPin,
} from 'lucide-react';



function WorkloadBar({ assigned, completed, showNumbers = true }) {
  const percentage = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
  const pending = assigned - completed;
  
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showNumbers && (
          <span className="text-xs text-gray-500 min-w-[60px] text-right">
            {completed}/{assigned}
          </span>
        )}
      </div>
      {pending > 0 && (
        <p className="text-xs text-orange-600 mt-0.5">{pending} pending</p>
      )}
    </div>
  );
}

function EditorCard({ editor }) {
  const getWorkloadStatus = () => {
    const pending = editor.mediaAssigned - editor.mediaCompleted;
    if (pending === 0) return { label: 'Available', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle, priority: 1 };
    if (pending <= 5) return { label: 'Light Load', color: 'text-blue-600', bg: 'bg-blue-100', icon: TrendingDown, priority: 2 };
    if (pending <= 15) return { label: 'Normal', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Minus, priority: 3 };
    return { label: 'Heavy Load', color: 'text-red-600', bg: 'bg-red-100', icon: TrendingUp, priority: 4 };
  };

  const status = getWorkloadStatus();
  const StatusIcon = status.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium">{editor.name.charAt(0)}</span>
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
              editor.isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>
          <div>
            <p className="font-medium text-gray-900">{editor.name}</p>
            <p className="text-xs text-gray-500">{editor.group}</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${status.bg} ${status.color}`}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Status</span>
          <span className={editor.isOnline ? 'text-green-600' : 'text-gray-500'}>
            {editor.isOnline ? editor.currentActivity || 'Online' : `Offline • ${getTimeAgo(editor.lastSeen)}`}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Workload</span>
          <span className="font-medium">{editor.mediaAssigned - editor.mediaCompleted} pending</span>
        </div>

        <WorkloadBar assigned={editor.mediaAssigned} completed={editor.mediaCompleted} />

        <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
          <span>Avg: {editor.avgProcessingTime} min/file</span>
          <span>{editor.mediaCompleted} completed</span>
        </div>
      </div>
    </div>
  );
}

function GroupSummaryCard({ group }) {
  const completionPercent = group.totalMedia > 0 
    ? Math.round((group.completedMedia / group.totalMedia) * 100)
    : 0;
  const pending = group.totalMedia - group.completedMedia;
  const avgPerEditor = group.editorCount > 0 ? Math.round(pending / group.editorCount) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">{group.name}</p>
          <p className="text-xs text-gray-500">{group.code} • {group.editorCount} editors</p>
        </div>
        <div className={`text-2xl font-bold ${
          completionPercent >= 80 ? 'text-green-600' : completionPercent >= 50 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {completionPercent}%
        </div>
      </div>
      
      <WorkloadBar assigned={group.totalMedia} completed={group.completedMedia} />
      
      <div className="flex items-center justify-between mt-3 text-sm">
        <span className="text-gray-500">{pending} pending</span>
        <span className="text-gray-500">~{avgPerEditor} per editor</span>
      </div>
    </div>
  );
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function WorkAllocation() {
  const { activeEvent, isAdmin, isTeamLead, isGroupLeader } = useAuth();
  const [editors, setEditors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('workload'); // 'workload', 'name', 'group'
  const [isLive, setIsLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = useCallback(async () => {
    if (!activeEvent?.id) {
      setEditors([]);
      setGroups([]);
      setLoading(false);
      return;
    }

    try {
      const response = await workAllocationService.getOverview(activeEvent.id);
      // Map backend response to component state shape
      const mappedEditors = (response.editors || []).map(e => ({
        id: e.id,
        name: e.name,
        email: e.email,
        group: e.groups?.[0]?.name || 'Unassigned',
        groupId: e.groups?.[0]?.id || null,
        isOnline: e.is_online,
        lastSeen: e.last_seen_at,
        currentActivity: e.current_activity,
        mediaAssigned: e.media_assigned || 0,
        mediaCompleted: e.media_completed || 0,
        avgProcessingTime: e.avg_processing_time || 0,
      }));
      const mappedGroups = (response.groups || []).map(g => ({
        id: g.id,
        name: g.name,
        code: g.code,
        totalMedia: g.total_media || 0,
        completedMedia: g.completed_media || 0,
        editorCount: g.editor_count || 0,
      }));
      setEditors(mappedEditors);
      setGroups(mappedGroups);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch work allocation:', error);
    } finally {
      setLoading(false);
    }
  }, [activeEvent?.id]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time polling - fetch data every 5 seconds
  useEffect(() => {
    let interval;
    if (isLive && activeEvent?.id) {
      interval = setInterval(fetchData, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive, activeEvent?.id, fetchData]);

  const canView = !!activeEvent?.id;

  // Filter and sort editors
  const filteredEditors = editors
    .filter(e => {
      if (filterGroup !== 'all' && e.groupId !== parseInt(filterGroup)) return false;
      if (filterStatus === 'online' && !e.isOnline) return false;
      if (filterStatus === 'offline' && e.isOnline) return false;
      if (filterStatus === 'available' && (e.mediaAssigned - e.mediaCompleted) > 0) return false;
      if (filterStatus === 'light' && (e.mediaAssigned - e.mediaCompleted) > 5) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'workload') {
        return (a.mediaAssigned - a.mediaCompleted) - (b.mediaAssigned - b.mediaCompleted);
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'group') return a.group.localeCompare(b.group);
      return 0;
    });

  const stats = {
    totalEditors: editors.length,
    onlineEditors: editors.filter(e => e.isOnline).length,
    availableEditors: editors.filter(e => e.isOnline && (e.mediaAssigned - e.mediaCompleted) === 0).length,
    lightLoadEditors: editors.filter(e => e.isOnline && (e.mediaAssigned - e.mediaCompleted) > 0 && (e.mediaAssigned - e.mediaCompleted) <= 5).length,
  };

  const refresh = async () => {
    setLoading(true);
    await fetchData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Work Allocation</h1>
        <p className="text-gray-500">
          Assign and balance editor workloads
          {activeEvent?.name ? ` • Active event: ${activeEvent.name}` : ''}
        </p>
      </div>

      {!canView && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          You must activate an event before managing work allocation.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            Team Status
            {isLive && (
              <span className="flex items-center gap-1.5 text-sm font-normal text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </h1>
          <p className="text-gray-500">
            Real-time editor availability • Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              isLive 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Circle className={`w-3 h-3 ${isLive ? 'fill-green-500 text-green-500' : 'text-gray-400'}`} />
            {isLive ? 'Live Updates On' : 'Live Updates Off'}
          </button>
        </div>
      </div>

      {/* Quick Stats - Who to assign work to */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalEditors}</p>
              <p className="text-sm text-gray-500">Total Editors</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.onlineEditors}</p>
              <p className="text-sm text-gray-500">Online Now</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{stats.availableEditors}</p>
              <p className="text-sm text-green-600 font-medium">Available for Work</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{stats.lightLoadEditors}</p>
              <p className="text-sm text-blue-600 font-medium">Light Workload</p>
            </div>
          </div>
        </div>
      </div>

      {/* Group Summary */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Group Workload</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {groups.map(group => (
            <GroupSummaryCard key={group.id} group={group} />
          ))}
        </div>
      </div>

      {/* Editor List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Editor Status
            <span className="ml-2 text-sm font-normal text-gray-500">
              (sorted by availability - assign work to those at the top)
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Groups</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="online">Online Only</option>
              <option value="available">Available</option>
              <option value="light">Light Load</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="workload">Sort by Workload</option>
              <option value="name">Sort by Name</option>
              <option value="group">Sort by Group</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEditors.map(editor => (
            <EditorCard key={editor.id} editor={editor} />
          ))}
        </div>

        {filteredEditors.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No editors match the filter</p>
          </div>
        )}
      </div>

      {/* Assignment Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-medium text-blue-900 mb-2">Assignment Tips</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Green (Available)</strong> - No pending work, ready for new assignments</li>
          <li>• <strong>Blue (Light Load)</strong> - 1-5 pending items, can take more work</li>
          <li>• <strong>Yellow (Normal)</strong> - 6-15 pending items, moderate workload</li>
          <li>• <strong>Red (Heavy Load)</strong> - 15+ pending items, avoid assigning more</li>
        </ul>
      </div>
    </div>
  );
}
