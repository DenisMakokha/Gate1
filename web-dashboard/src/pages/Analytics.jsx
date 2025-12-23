import React, { useState, useEffect } from 'react';
import { analyticsService } from '../services/api';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Video,
  AlertTriangle,
  HardDrive,
  Calendar,
  Activity,
  BarChart3,
  PieChart,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from 'lucide-react';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [overview, setOverview] = useState(null);
  const [mediaTrends, setMediaTrends] = useState(null);
  const [issuesTrends, setIssuesTrends] = useState(null);
  const [userActivity, setUserActivity] = useState(null);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, mediaRes, issuesRes, activityRes] = await Promise.all([
        analyticsService.getOverview(),
        analyticsService.getMediaTrends(timeRange),
        analyticsService.getIssuesTrends(timeRange),
        analyticsService.getUserActivity(7),
      ]);
      setOverview(overviewRes.data);
      setMediaTrends(mediaRes.data);
      setIssuesTrends(issuesRes.data);
      setUserActivity(activityRes.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, change, icon: Icon, color, subtitle }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value?.toLocaleString() || 0}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {change !== undefined && (
        <div className="mt-4 flex items-center gap-2">
          {change >= 0 ? (
            <span className="flex items-center text-green-600 text-sm font-medium">
              <ArrowUpRight className="w-4 h-4" />
              {change}%
            </span>
          ) : (
            <span className="flex items-center text-red-600 text-sm font-medium">
              <ArrowDownRight className="w-4 h-4" />
              {Math.abs(change)}%
            </span>
          )}
          <span className="text-gray-500 text-sm">vs last month</span>
        </div>
      )}
    </div>
  );

  const MiniChart = ({ data, color = 'blue' }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data.map(d => d.count || d.created || 0));
    const colors = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      amber: 'bg-amber-500',
    };

    return (
      <div className="flex items-end gap-1 h-16">
        {data.slice(-14).map((item, i) => {
          const value = item.count || item.created || 0;
          const height = max > 0 ? (value / max) * 100 : 0;
          return (
            <div
              key={i}
              className={`flex-1 ${colors[color]} rounded-t opacity-70 hover:opacity-100 transition-opacity`}
              style={{ height: `${Math.max(height, 4)}%` }}
              title={`${item.date}: ${value}`}
            />
          );
        })}
      </div>
    );
  };

  const ProgressBar = ({ label, value, total, color = 'blue' }) => {
    const percent = total > 0 ? (value / total) * 100 : 0;
    const colors = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      red: 'bg-red-500',
      amber: 'bg-amber-500',
      purple: 'bg-purple-500',
    };

    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{label}</span>
          <span className="font-medium text-gray-900">{value}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors[color]} rounded-full transition-all duration-500`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500">Insights and trends across your system</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Media"
          value={overview?.media?.total}
          change={overview?.media?.growth}
          icon={Video}
          color="bg-gradient-to-br from-blue-500 to-indigo-600"
          subtitle={`${overview?.media?.today || 0} today`}
        />
        <StatCard
          title="Open Issues"
          value={overview?.issues?.open}
          icon={AlertTriangle}
          color="bg-gradient-to-br from-amber-500 to-orange-600"
          subtitle={`${overview?.issues?.resolved_today || 0} resolved today`}
        />
        <StatCard
          title="Active Users"
          value={overview?.users?.active}
          icon={Users}
          color="bg-gradient-to-br from-emerald-500 to-green-600"
          subtitle={`${overview?.users?.online_agents || 0} online now`}
        />
        <StatCard
          title="Backup Coverage"
          value={`${overview?.backups?.coverage_percent || 0}%`}
          icon={HardDrive}
          color="bg-gradient-to-br from-purple-500 to-violet-600"
          subtitle={`${overview?.backups?.backed_up || 0} verified`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Media Trends */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Media Indexed</h3>
              <p className="text-sm text-gray-500">Daily media files processed</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{mediaTrends?.total?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500">last {timeRange} days</p>
            </div>
          </div>
          <MiniChart data={mediaTrends?.daily} color="blue" />
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Top Editors</h4>
            <div className="space-y-3">
              {mediaTrends?.by_editor?.slice(0, 5).map((item, i) => (
                <ProgressBar
                  key={i}
                  label={item.editor?.name || 'Unknown'}
                  value={item.count}
                  total={mediaTrends?.total || 1}
                  color="blue"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Issues Trends */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Issues Overview</h3>
              <p className="text-sm text-gray-500">Created vs Resolved</p>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                Created: {issuesTrends?.total_created || 0}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Resolved: {issuesTrends?.total_resolved || 0}
              </span>
            </div>
          </div>
          <MiniChart data={issuesTrends?.daily} color="amber" />
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-3">By Severity</h4>
            <div className="grid grid-cols-4 gap-2">
              {['critical', 'high', 'medium', 'low'].map((severity) => {
                const item = issuesTrends?.by_severity?.find(s => s.severity === severity);
                const colors = {
                  critical: 'bg-red-100 text-red-700 border-red-200',
                  high: 'bg-orange-100 text-orange-700 border-orange-200',
                  medium: 'bg-amber-100 text-amber-700 border-amber-200',
                  low: 'bg-green-100 text-green-700 border-green-200',
                };
                return (
                  <div key={severity} className={`p-3 rounded-xl border ${colors[severity]} text-center`}>
                    <p className="text-2xl font-bold">{item?.count || 0}</p>
                    <p className="text-xs capitalize">{severity}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Activity */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">User Activity</h3>
          </div>
          <div className="space-y-4">
            {userActivity?.top_users?.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {item.user?.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.user?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{item.action_count} actions</p>
                </div>
                <div className="text-sm font-semibold text-purple-600">#{i + 1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Issues by Type */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">Issues by Type</h3>
          </div>
          <div className="space-y-3">
            {issuesTrends?.by_type?.map((item, i) => {
              const colors = ['blue', 'green', 'amber', 'purple', 'red'];
              return (
                <ProgressBar
                  key={i}
                  label={item.type?.replace(/_/g, ' ') || 'Unknown'}
                  value={item.count}
                  total={issuesTrends?.total_created || 1}
                  color={colors[i % colors.length]}
                />
              );
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <span className="text-sm text-blue-700">Active Events</span>
              <span className="text-lg font-bold text-blue-900">{overview?.events?.active || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <span className="text-sm text-green-700">Total Groups</span>
              <span className="text-lg font-bold text-green-900">{overview?.groups?.total || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
              <span className="text-sm text-amber-700">Pending Approvals</span>
              <span className="text-lg font-bold text-amber-900">{overview?.users?.pending_approval || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-purple-700">Avg Resolution Time</span>
              </div>
              <span className="text-lg font-bold text-purple-900">
                {Math.round(overview?.issues?.avg_resolution_time || 0)}h
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Issues by Group */}
      {issuesTrends?.by_group?.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Issues by Group</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {issuesTrends?.by_group?.map((item, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-xl text-center hover:bg-gray-100 transition-colors">
                <p className="text-2xl font-bold text-gray-900">{item.count}</p>
                <p className="text-sm text-gray-600 mt-1">{item.group?.group_code || 'Unknown'}</p>
                <p className="text-xs text-gray-400 truncate">{item.group?.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
