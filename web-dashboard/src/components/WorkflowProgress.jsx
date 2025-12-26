import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/api';
import {
  Copy,
  FileText,
  Users,
  Layers,
  RefreshCw,
  Clock,
  CheckCircle,
  Activity,
  Circle,
} from 'lucide-react';

function ProgressBar({ percentage, color = 'sky' }) {
  const colors = {
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
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

function StatCard({ title, value, subtitle, icon: Icon, color, percentage, secondaryPercentage, secondaryLabel }) {
  const colors = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {percentage !== undefined && (
            <div className="mt-3 space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Copied</span>
                  <span className="font-medium">{percentage}%</span>
                </div>
                <ProgressBar percentage={percentage} color={color} />
              </div>
              {secondaryPercentage !== undefined && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{secondaryLabel || 'Renamed'}</span>
                    <span className="font-medium">{secondaryPercentage}%</span>
                  </div>
                  <ProgressBar percentage={secondaryPercentage} color="emerald" />
                </div>
              )}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function WorkflowProgress() {
  const { activeEvent } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadProgress();
  }, [activeEvent?.id]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getWorkflowProgress(activeEvent?.id);
      setData(response);
    } catch (error) {
      console.error('Failed to load workflow progress:', error);
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
          <h2 className="text-xl font-bold text-gray-900">Workflow Progress</h2>
          <p className="text-gray-500 text-sm">
            {activeEvent ? (
              <>Event: <span className="font-medium text-sky-600">{activeEvent.name}</span></>
            ) : (
              'Copy & rename progress tracking'
            )}
          </p>
        </div>
        <button
          onClick={loadProgress}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Files Detected"
          value={overall.files_detected?.toLocaleString() || 0}
          subtitle={`${overall.files_pending?.toLocaleString() || 0} pending`}
          icon={FileText}
          color="sky"
          percentage={overall.copy_percentage}
          secondaryPercentage={overall.rename_percentage}
        />
        <StatCard
          title="Files Copied"
          value={overall.files_copied?.toLocaleString() || 0}
          subtitle={overall.total_size_formatted}
          icon={Copy}
          color="emerald"
        />
        <StatCard
          title="Media Renamed"
          value={overall.renamed_media?.toLocaleString() || 0}
          subtitle={`of ${overall.total_media?.toLocaleString() || 0} total`}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Active Sessions"
          value={overall.active_sessions || 0}
          subtitle="Currently processing"
          icon={Activity}
          color={overall.active_sessions > 0 ? 'amber' : 'sky'}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'By Group', icon: Layers },
            { id: 'editors', label: 'By Editor', icon: Users },
            { id: 'sessions', label: 'Active Sessions', icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 border-b-2 transition-colors text-sm ${
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Progress by Group</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Detected</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Copied</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Copy %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Renamed</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rename %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.by_group?.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{group.group_code}</div>
                      <div className="text-xs text-gray-500">{group.member_count} members</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{group.files_detected.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{group.files_copied.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {group.files_pending > 0 ? (
                        <span className="text-amber-600 font-medium">{group.files_pending.toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-600">✓</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <ProgressBar
                            percentage={group.copy_percentage}
                            color={group.copy_percentage >= 90 ? 'emerald' : group.copy_percentage >= 50 ? 'amber' : 'red'}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-10">{group.copy_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{group.renamed_media.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <ProgressBar
                            percentage={group.rename_percentage}
                            color={group.rename_percentage >= 90 ? 'emerald' : group.rename_percentage >= 50 ? 'amber' : 'red'}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-10">{group.rename_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 text-sm">{group.total_size_formatted}</td>
                  </tr>
                ))}
                {(!data?.by_group || data.by_group.length === 0) && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No group data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'editors' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Progress by Editor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Editor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Groups</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Detected</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Copied</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Copy %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Renamed</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rename %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.by_editor?.map((editor) => (
                  <tr key={editor.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Circle
                          className={`w-2.5 h-2.5 ${editor.is_online ? 'fill-emerald-500 text-emerald-500' : 'fill-gray-300 text-gray-300'}`}
                        />
                        <div>
                          <div className="font-medium text-gray-900">{editor.name}</div>
                          <div className="text-xs text-gray-500">{editor.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {editor.groups?.map((g) => (
                          <span key={g.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {g.group_code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{editor.files_detected.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{editor.files_copied.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <ProgressBar
                            percentage={editor.copy_percentage}
                            color={editor.copy_percentage >= 90 ? 'emerald' : editor.copy_percentage >= 50 ? 'amber' : 'red'}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-10">{editor.copy_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{editor.renamed_media.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <ProgressBar
                            percentage={editor.rename_percentage}
                            color={editor.rename_percentage >= 90 ? 'emerald' : editor.rename_percentage >= 50 ? 'amber' : 'red'}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-10">{editor.rename_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 text-sm">{editor.total_size_formatted}</td>
                  </tr>
                ))}
                {(!data?.by_editor || data.by_editor.length === 0) && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No editor data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Active Copy Sessions</h3>
          </div>
          {data?.active_sessions?.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {data.active_sessions.map((session) => (
                <div key={session.session_id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="font-medium text-gray-900">{session.editor}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-600">Camera {session.camera_number}</span>
                      {session.sd_label && (
                        <>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-600">{session.sd_label}</span>
                        </>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      Started {new Date(session.started_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <ProgressBar percentage={session.copy_progress} color="sky" />
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">{session.files_copied}</span>
                      <span className="text-gray-500"> / {session.files_detected}</span>
                      <span className="text-gray-400 ml-2">({session.copy_progress}%)</span>
                    </div>
                  </div>
                  {session.files_pending > 0 && (
                    <div className="mt-1 text-xs text-amber-600">
                      {session.files_pending} files pending
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No active copy sessions</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
