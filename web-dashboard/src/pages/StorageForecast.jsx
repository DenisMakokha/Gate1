import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { storageService, backupService } from '../services/api';
import {
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Database,
  Users,
  Layers,
  BarChart3,
} from 'lucide-react';

function ProgressBar({ percentage, showLabel = true }) {
  const getColor = () => {
    if (percentage >= 95) return 'bg-red-500';
    if (percentage >= 90) return 'bg-amber-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="w-full">
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`h-3 rounded-full ${getColor()} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-500">Used</span>
          <span className={`font-medium ${percentage >= 90 ? 'text-red-600' : 'text-gray-700'}`}>
            {percentage}%
          </span>
        </div>
      )}
    </div>
  );
}

function DiskCard({ disk }) {
  const healthColors = {
    healthy: 'border-emerald-200 bg-emerald-50',
    caution: 'border-yellow-200 bg-yellow-50',
    warning: 'border-amber-200 bg-amber-50',
    critical: 'border-red-200 bg-red-50',
  };

  const healthIcons = {
    healthy: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    caution: <Clock className="w-5 h-5 text-yellow-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    critical: <AlertTriangle className="w-5 h-5 text-red-500" />,
  };

  return (
    <div className={`rounded-xl border-2 p-4 ${healthColors[disk.health]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <HardDrive className="w-6 h-6 text-gray-700" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{disk.disk_label}</h3>
            <p className="text-xs text-gray-500">{disk.serial_number}</p>
          </div>
        </div>
        {healthIcons[disk.health]}
      </div>

      <ProgressBar percentage={disk.used_percent} />

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <p className="text-xs text-gray-500">Used</p>
          <p className="font-medium text-gray-900">{disk.used_space}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Free</p>
          <p className="font-medium text-emerald-600">{disk.free_space}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total</p>
          <p className="font-medium text-gray-900">{disk.total_capacity}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Status</p>
          <p className={`font-medium capitalize ${
            disk.status === 'active' ? 'text-emerald-600' : 'text-gray-500'
          }`}>
            {disk.status}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StorageForecast() {
  const { activeEvent } = useAuth();
  const [data, setData] = useState(null);
  const [backupData, setBackupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, [activeEvent?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const eventId = activeEvent?.id;
      const [storageRes, backupRes] = await Promise.all([
        storageService.getUsage(),
        backupService.getAnalytics(eventId),
      ]);
      setData(storageRes);
      setBackupData(backupRes);
    } catch (error) {
      console.error('Failed to load storage data:', error);
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

  const totals = data?.totals || {};
  const forecast = data?.forecast || {};
  const overall = backupData?.overall || {};

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'disks', label: 'Disks', icon: HardDrive },
    { id: 'groups', label: 'By Group', icon: Layers },
    { id: 'editors', label: 'By Editor', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Storage & Backup</h1>
          <p className="text-gray-500 text-sm">
            {activeEvent ? (
              <>Event: <span className="font-medium text-sky-600">{activeEvent.name}</span></>
            ) : (
              'Monitor storage, backup coverage, and capacity forecast'
            )}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm whitespace-nowrap ${
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

      {/* Alerts */}
      {data?.alerts?.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-4 rounded-lg ${
                alert.level === 'critical' ? 'bg-red-50 border border-red-200' :
                alert.level === 'warning' ? 'bg-amber-50 border border-amber-200' :
                'bg-blue-50 border border-blue-200'
              }`}
            >
              <AlertTriangle className={`w-5 h-5 ${
                alert.level === 'critical' ? 'text-red-500' :
                alert.level === 'warning' ? 'text-amber-500' :
                'text-blue-500'
              }`} />
              <span className="text-sm font-medium text-gray-900">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-sky-100 rounded-lg">
                  <Database className="w-5 h-5 text-sky-600" />
                </div>
                <span className="text-sm text-gray-500">Total Capacity</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totals.total_capacity}</p>
              <p className="text-sm text-gray-500">{totals.disk_count} disks</p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <HardDrive className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm text-gray-500">Free Space</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{totals.total_free}</p>
              <p className="text-sm text-gray-500">{100 - (totals.overall_used_percent || 0)}% available</p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm text-gray-500">Data Rate</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data?.data_rate?.avg_per_hour || '0 B'}</p>
              <p className="text-sm text-gray-500">per hour average</p>
            </div>

            <div className={`rounded-xl p-5 shadow-sm border ${
              forecast.status === 'critical' ? 'bg-red-50 border-red-200' :
              forecast.status === 'warning' ? 'bg-amber-50 border-amber-200' :
              forecast.status === 'caution' ? 'bg-yellow-50 border-yellow-200' :
              'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${
                  forecast.status === 'critical' ? 'bg-red-100' :
                  forecast.status === 'warning' ? 'bg-amber-100' :
                  forecast.status === 'caution' ? 'bg-yellow-100' :
                  'bg-emerald-100'
                }`}>
                  <Clock className={`w-5 h-5 ${
                    forecast.status === 'critical' ? 'text-red-600' :
                    forecast.status === 'warning' ? 'text-amber-600' :
                    forecast.status === 'caution' ? 'text-yellow-600' :
                    'text-emerald-600'
                  }`} />
                </div>
                <span className="text-sm text-gray-500">Time Remaining</span>
              </div>
              <p className={`text-2xl font-bold ${
                forecast.status === 'critical' ? 'text-red-700' :
                forecast.status === 'warning' ? 'text-amber-700' :
                'text-gray-900'
              }`}>
                {forecast.days_remaining ? `${forecast.days_remaining} days` : 'N/A'}
              </p>
              <p className="text-sm text-gray-600">{forecast.message}</p>
            </div>
          </div>

          {/* Overall Progress */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Overall Storage Usage</h3>
            <div className="mb-4">
              <ProgressBar percentage={totals.overall_used_percent || 0} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-500">Used</p>
                <p className="font-semibold text-gray-900">{totals.total_used}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Free</p>
                <p className="font-semibold text-emerald-600">{totals.total_free}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="font-semibold text-gray-900">{totals.total_capacity}</p>
              </div>
            </div>
          </div>

          {/* Forecast Details */}
          {forecast.estimated_full_at && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Storage Forecast</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Estimated Full At</p>
                  <p className="font-semibold text-gray-900">{forecast.estimated_full_formatted}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Hours Remaining</p>
                  <p className="font-semibold text-gray-900">{forecast.hours_remaining} hours</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Projected Daily Usage</p>
                  <p className="font-semibold text-gray-900">{data?.data_rate?.projected_daily}</p>
                </div>
              </div>
            </div>
          )}

          {/* Backup Coverage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Total Clips</p>
              <p className="text-2xl font-bold text-gray-900">{overall.total_clips?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500">{overall.total_size_formatted}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Backed Up</p>
              <p className="text-2xl font-bold text-emerald-600">{overall.backed_up_clips?.toLocaleString() || 0}</p>
              <div className="mt-2">
                <ProgressBar percentage={overall.backup_percentage || 0} showLabel={false} />
                <p className="text-xs text-gray-500 mt-1">{overall.backup_percentage || 0}% complete</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Verified</p>
              <p className="text-2xl font-bold text-emerald-600">{overall.verified_clips?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500">{overall.verification_percentage || 0}% verified</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Pending</p>
              <p className={`text-2xl font-bold ${overall.pending_clips > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {overall.pending_clips?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-gray-500">{overall.pending_size_formatted}</p>
            </div>
          </div>
        </>
      )}

      {/* Disks Tab */}
      {activeTab === 'disks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.disks?.map((disk) => (
            <DiskCard key={disk.id} disk={disk} />
          ))}
          {(!data?.disks || data.disks.length === 0) && (
            <div className="col-span-full text-center py-8 bg-gray-50 rounded-xl">
              <HardDrive className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No backup disks registered</p>
            </div>
          )}
        </div>
      )}

      {/* Groups Tab */}
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
                {backupData?.by_group?.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{group.group_code}</div>
                      <div className="text-sm text-gray-500">{group.name}</div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">{group.member_count}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">{group.total_clips?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{group.total_size_formatted}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-medium">{group.backed_up_clips?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      {group.pending_clips > 0 ? (
                        <span className="text-amber-600 font-medium">{group.pending_clips?.toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-600">✓</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <ProgressBar percentage={group.backup_percentage || 0} showLabel={false} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12">{group.backup_percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!backupData?.by_group || backupData.by_group.length === 0) && (
              <div className="text-center py-8 text-gray-500">No group data available</div>
            )}
          </div>
        </div>
      )}

      {/* Editors Tab */}
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
                {backupData?.by_editor?.map((editor) => (
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
                    <td className="px-6 py-4 text-right font-medium text-gray-900">{editor.total_clips?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{editor.total_size_formatted}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-medium">{editor.backed_up_clips?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      {editor.pending_clips > 0 ? (
                        <span className="text-amber-600 font-medium">{editor.pending_clips?.toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-600">✓</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <ProgressBar percentage={editor.backup_percentage || 0} showLabel={false} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12">{editor.backup_percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!backupData?.by_editor || backupData.by_editor.length === 0) && (
              <div className="text-center py-8 text-gray-500">No editor data available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
