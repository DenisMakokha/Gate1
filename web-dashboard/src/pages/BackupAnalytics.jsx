import React, { useState, useEffect } from 'react';
import { backupService, eventService } from '../services/api';
import {
  HardDrive,
  Database,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Layers,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';

function ProgressBar({ percentage, color = 'sky' }) {
  const colors = {
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full ${colors[color]} transition-all duration-500`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color, percentage }) {
  const colors = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {percentage !== undefined && (
            <div className="mt-3">
              <ProgressBar percentage={percentage} color={color} />
              <p className="text-xs text-gray-500 mt-1">{percentage}% complete</p>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

export default function BackupAnalytics() {
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [selectedEvent]);

  const loadEvents = async () => {
    try {
      const response = await eventService.getAll();
      setEvents(response.data || response);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await backupService.getAnalytics(selectedEvent || undefined);
      setData(response);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  const overall = data?.overall || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backup Analytics</h1>
          <p className="text-gray-500">Comprehensive backup coverage and planning insights</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Clips"
          value={overall.total_clips?.toLocaleString() || 0}
          subtitle={overall.total_size_formatted}
          icon={Database}
          color="sky"
        />
        <StatCard
          title="Backed Up"
          value={overall.backed_up_clips?.toLocaleString() || 0}
          subtitle={overall.backed_up_size_formatted}
          icon={HardDrive}
          color="emerald"
          percentage={overall.backup_percentage}
        />
        <StatCard
          title="Verified"
          value={overall.verified_clips?.toLocaleString() || 0}
          subtitle={overall.verified_size_formatted}
          icon={CheckCircle}
          color="emerald"
          percentage={overall.verification_percentage}
        />
        <StatCard
          title="Pending"
          value={overall.pending_clips?.toLocaleString() || 0}
          subtitle={overall.pending_size_formatted}
          icon={Clock}
          color={overall.pending_clips > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'groups', label: 'By Group', icon: Layers },
            { id: 'editors', label: 'By Editor', icon: Users },
            { id: 'disks', label: 'Disks', icon: HardDrive },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">7-Day Backup Trend</h3>
            <div className="space-y-4">
              {data?.daily_trend?.map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-12 text-sm text-gray-500">{day.day}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">
                        {day.clips_backed_up} / {day.clips_created} clips
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {day.clips_created > 0
                          ? Math.round((day.clips_backed_up / day.clips_created) * 100)
                          : 0}%
                      </span>
                    </div>
                    <ProgressBar
                      percentage={day.clips_created > 0 ? (day.clips_backed_up / day.clips_created) * 100 : 0}
                      color="sky"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Total Groups with Data</span>
                <span className="font-semibold text-gray-900">{data?.by_group?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Active Editors</span>
                <span className="font-semibold text-gray-900">{data?.by_editor?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Backup Disks</span>
                <span className="font-semibold text-gray-900">{data?.disks?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                <span className="text-emerald-700">Overall Backup Rate</span>
                <span className="font-bold text-emerald-700">{overall.backup_percentage || 0}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Backup Coverage by Group</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Members</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Clips</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Backed Up</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.by_group?.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{group.group_code}</div>
                      <div className="text-sm text-gray-500">{group.name}</div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">{group.member_count}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">{group.total_clips.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{group.total_size_formatted}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-medium">{group.backed_up_clips.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      {group.pending_clips > 0 ? (
                        <span className="text-amber-600 font-medium">{group.pending_clips.toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-600">✓</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <ProgressBar
                            percentage={group.backup_percentage}
                            color={group.backup_percentage >= 90 ? 'emerald' : group.backup_percentage >= 50 ? 'amber' : 'red'}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12">{group.backup_percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'editors' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Backup Coverage by Editor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Editor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Groups</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Clips</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Backed Up</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.by_editor?.map((editor) => (
                  <tr key={editor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{editor.name}</div>
                      <div className="text-sm text-gray-500">{editor.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {editor.groups?.map((g) => (
                          <span key={g.id} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {g.group_code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">{editor.total_clips.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{editor.total_size_formatted}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-medium">{editor.backed_up_clips.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      {editor.pending_clips > 0 ? (
                        <span className="text-amber-600 font-medium">{editor.pending_clips.toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-600">✓</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <ProgressBar
                            percentage={editor.backup_percentage}
                            color={editor.backup_percentage >= 90 ? 'emerald' : editor.backup_percentage >= 50 ? 'amber' : 'red'}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12">{editor.backup_percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'disks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.disks?.map((disk) => (
            <div key={disk.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-50 rounded-lg">
                    <HardDrive className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{disk.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      disk.purpose === 'primary' ? 'bg-sky-100 text-sky-700' :
                      disk.purpose === 'secondary' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {disk.purpose}
                    </span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  disk.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {disk.status}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Storage Used</span>
                    <span className="font-medium text-gray-900">{disk.usage_percentage}%</span>
                  </div>
                  <ProgressBar
                    percentage={disk.usage_percentage}
                    color={disk.usage_percentage >= 90 ? 'red' : disk.usage_percentage >= 70 ? 'amber' : 'sky'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">Used</p>
                    <p className="font-medium text-gray-900">{disk.used_formatted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Available</p>
                    <p className="font-medium text-gray-900">{disk.available_formatted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Backups</p>
                    <p className="font-medium text-gray-900">{disk.backups_count?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Verified</p>
                    <p className="font-medium text-emerald-600">{disk.verified_backups?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {(!data?.disks || data.disks.length === 0) && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <HardDrive className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No backup disks registered</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
