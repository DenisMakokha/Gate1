import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { qualityControlService } from '../services/api';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  TrendingDown,
  RefreshCw,
  GraduationCap,
  BarChart3,
} from 'lucide-react';

function ProgressBar({ percentage, color = 'emerald' }) {
  const colors = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${colors[color]} transition-all duration-500`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    sky: 'bg-sky-50 text-sky-600',
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function QualityControl() {
  const { activeEvent } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, [activeEvent?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!activeEvent?.id) {
        setData(null);
        return;
      }
      const response = await qualityControlService.getOverview(activeEvent?.id);
      setData(response);
    } catch (error) {
      console.error('Failed to load quality control data:', error);
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

  const overview = data?.overview || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quality Control</h1>
          <p className="text-gray-500 text-sm">
            {activeEvent ? (
              <>Event: <span className="font-medium text-sky-600">{activeEvent.name}</span></>
            ) : (
              'Monitor filename errors and editor performance'
            )}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading || !activeEvent?.id}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!activeEvent?.id && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          You must activate an event before viewing Quality Control.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Media"
          value={overview.total_media?.toLocaleString() || 0}
          subtitle={`${overview.valid_percentage || 100}% valid`}
          icon={BarChart3}
          color="sky"
        />
        <StatCard
          title="Valid Files"
          value={overview.valid_count?.toLocaleString() || 0}
          subtitle="Properly named"
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Warnings"
          value={overview.warning_count?.toLocaleString() || 0}
          subtitle="Minor issues"
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Errors"
          value={overview.error_count?.toLocaleString() || 0}
          subtitle={`${overview.error_rate || 0}% error rate`}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'By Editor', icon: Users },
            { id: 'groups', label: 'By Group', icon: Users },
            { id: 'issues', label: 'Common Issues', icon: AlertTriangle },
            { id: 'training', label: 'Needs Training', icon: GraduationCap },
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

      {/* Editor Stats */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Quality by Editor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Editor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Warnings</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Errors</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Error Rate</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quality Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.by_editor?.map((editor) => (
                  <tr key={editor.editor_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{editor.editor_name}</span>
                        {editor.needs_training && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                            Needs Training
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{editor.total_files.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{editor.valid.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{editor.warnings.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-600">{editor.errors.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16">
                          <ProgressBar
                            percentage={editor.error_rate}
                            color={editor.error_rate > 10 ? 'red' : editor.error_rate > 5 ? 'amber' : 'emerald'}
                          />
                        </div>
                        <span className={`text-xs font-medium ${
                          editor.error_rate > 10 ? 'text-red-600' : editor.error_rate > 5 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {editor.error_rate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        editor.quality_score >= 95 ? 'bg-emerald-100 text-emerald-700' :
                        editor.quality_score >= 90 ? 'bg-sky-100 text-sky-700' :
                        editor.quality_score >= 80 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {editor.quality_score.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.by_editor || data.by_editor.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No editor data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Group Stats */}
      {activeTab === 'groups' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Quality by Group</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Members</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Errors</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quality Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.by_group?.map((group) => (
                  <tr key={group.group_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{group.group_code}</div>
                      <div className="text-xs text-gray-500">{group.group_name}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{group.member_count}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{group.total_files.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{group.valid.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-600">{(group.warnings + group.errors).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        group.quality_score >= 95 ? 'bg-emerald-100 text-emerald-700' :
                        group.quality_score >= 90 ? 'bg-sky-100 text-sky-700' :
                        group.quality_score >= 80 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {group.quality_score.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Common Issues */}
      {activeTab === 'issues' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Common Filename Issues</h3>
          </div>
          <div className="p-4">
            {data?.common_issues?.length > 0 ? (
              <div className="space-y-4">
                {data.common_issues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{issue.label}</h4>
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded-full font-medium">
                          {issue.count} occurrences
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{issue.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                <p className="text-gray-500">No common issues detected</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Needs Training */}
      {activeTab === 'training' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Editors Needing Training</h3>
            <p className="text-sm text-gray-500">Editors with error rate above 10%</p>
          </div>
          <div className="p-4">
            {data?.by_editor?.filter(e => e.needs_training).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.by_editor.filter(e => e.needs_training).map((editor) => (
                  <div key={editor.editor_id} className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{editor.editor_name}</h4>
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                        {editor.error_rate}% errors
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>{editor.total_files} files • {editor.errors} errors</p>
                    </div>
                    <div className="mt-2">
                      <ProgressBar percentage={100 - editor.error_rate} color="amber" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <GraduationCap className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                <p className="text-gray-500">All editors are performing well!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Trend Chart */}
      {data?.daily_trend && data.daily_trend.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Quality Trend (Last 7 Days)</h3>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-2 h-32">
              {data.daily_trend.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col gap-0.5" style={{ height: '100px' }}>
                    <div
                      className="bg-emerald-400 rounded-t"
                      style={{ height: `${(day.valid / day.total) * 100}%` }}
                    />
                    <div
                      className="bg-amber-400"
                      style={{ height: `${(day.warning / day.total) * 100}%` }}
                    />
                    <div
                      className="bg-red-400 rounded-b"
                      style={{ height: `${(day.error / day.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-2">
                    {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-400 rounded" />
                <span className="text-xs text-gray-600">Valid</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-400 rounded" />
                <span className="text-xs text-gray-600">Warnings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded" />
                <span className="text-xs text-gray-600">Errors</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
