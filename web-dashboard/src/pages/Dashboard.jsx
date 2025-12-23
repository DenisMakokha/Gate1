import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/api';
import EditorStatus from '../components/EditorStatus';
import WorkflowProgress from '../components/WorkflowProgress';
import {
  Video,
  AlertTriangle,
  HardDrive,
  Users,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
} from 'lucide-react';

function StatCard({ title, value, icon: Icon, color, subtitle }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function IssuesList({ issues }) {
  const severityColors = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Recent Issues</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {issues?.length === 0 && (
          <div className="p-4 text-center text-gray-500">No open issues</div>
        )}
        {issues?.map((issue) => (
          <div key={issue.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{issue.type.replace('_', ' ')}</p>
                <p className="text-sm text-gray-500">Reported by {issue.reporter}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${severityColors[issue.severity]}`}>
                {issue.severity}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupsHealth({ groups }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Groups Health</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {groups?.map((group) => (
          <div key={group.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{group.code}</p>
              <p className="text-sm text-gray-500">{group.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {group.open_issues > 0 ? (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                  {group.open_issues} issues
                </span>
              ) : (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                  Healthy
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAdmin, isGroupLeader, isQA, isBackup } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      let response;
      if (isAdmin()) {
        response = await dashboardService.getAdmin();
      } else if (isGroupLeader()) {
        response = await dashboardService.getGroupLeader();
      } else if (isQA()) {
        response = await dashboardService.getQA();
      } else if (isBackup()) {
        response = await dashboardService.getBackup();
      } else {
        response = await dashboardService.getEditor();
      }
      setData(response);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Admin Dashboard
  if (isAdmin() && data?.overview) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of Gate 1 System operations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Media"
            value={data.overview.total_media?.toLocaleString() || 0}
            icon={Video}
            color="blue"
            subtitle={`${data.overview.media_today || 0} today`}
          />
          <StatCard
            title="Open Issues"
            value={data.overview.open_issues || 0}
            icon={AlertTriangle}
            color="red"
            subtitle={`${data.overview.critical_issues || 0} critical`}
          />
          <StatCard
            title="Pending Backups"
            value={data.overview.pending_backups || 0}
            icon={HardDrive}
            color="yellow"
          />
          <StatCard
            title="Online Agents"
            value={data.overview.online_agents || 0}
            icon={Users}
            color="green"
            subtitle={`${data.overview.active_sessions || 0} active sessions`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IssuesList issues={data.recent_issues} />
          <GroupsHealth groups={data.groups_health} />
        </div>

        {/* Workflow Progress */}
        <WorkflowProgress />

        {/* Editor Online Status */}
        <EditorStatus />
      </div>
    );
  }

  // Group Leader Dashboard
  if (isGroupLeader() && data?.groups) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Group Leader Dashboard</h1>
          <p className="text-gray-500">Monitor your team's progress</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Team Members"
            value={data.team_stats?.total_members || 0}
            icon={Users}
            color="blue"
            subtitle={`${data.team_stats?.online_members || 0} online`}
          />
          <StatCard
            title="Media Today"
            value={data.team_stats?.media_today || 0}
            icon={Video}
            color="green"
          />
          <StatCard
            title="Open Issues"
            value={data.groups?.reduce((sum, g) => sum + g.open_issues, 0) || 0}
            icon={AlertTriangle}
            color="red"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">My Groups</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {data.groups?.map((group) => (
                <div key={group.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{group.code} - {group.name}</span>
                    <span className="text-sm text-gray-500">{group.member_count} members</span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-red-600">{group.open_issues} open issues</span>
                    <span className="text-green-600">{group.resolved_today} resolved today</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <IssuesList issues={data.recent_issues} />
        </div>

        {/* Workflow Progress for Group Leaders */}
        <WorkflowProgress />

        {/* Editor Online Status for Group Leaders */}
        <EditorStatus />
      </div>
    );
  }

  // QA Dashboard
  if (isQA() && data?.issue_summary) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">QA Dashboard</h1>
          <p className="text-gray-500">Issue review and quality control</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Open" value={data.issue_summary.open || 0} icon={Clock} color="blue" />
          <StatCard title="Acknowledged" value={data.issue_summary.acknowledged || 0} icon={Activity} color="yellow" />
          <StatCard title="In Progress" value={data.issue_summary.in_progress || 0} icon={TrendingUp} color="purple" />
          <StatCard title="Resolved Today" value={data.issue_summary.resolved_today || 0} icon={CheckCircle} color="green" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Critical Issues</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {data.critical_issues?.map((issue) => (
              <div key={issue.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{issue.type?.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-500">
                      {issue.group?.group_code} • Reported by {issue.reporter?.name}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                    Critical
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Backup Dashboard
  if (isBackup() && data?.coverage) {
    const coverage = data.coverage;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backup Dashboard</h1>
          <p className="text-gray-500">Backup coverage and verification</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Total Media" value={coverage.total_media || 0} icon={Video} color="blue" />
          <StatCard title="Backed Up" value={coverage.backed_up || 0} icon={HardDrive} color="green" />
          <StatCard title="Verified" value={coverage.verified || 0} icon={CheckCircle} color="green" />
          <StatCard title="Pending" value={coverage.pending || 0} icon={Clock} color="yellow" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Coverage Progress</h3>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <span className="text-sm font-medium text-blue-700">
                {coverage.coverage_percentage}% Complete
              </span>
            </div>
            <div className="overflow-hidden h-4 text-xs flex rounded-full bg-gray-200">
              <div
                style={{ width: `${coverage.coverage_percentage}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 transition-all duration-500"
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default/Editor Dashboard
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-gray-500">Your activity overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Files Indexed Today"
          value={data?.today?.files_indexed || 0}
          icon={Video}
          color="blue"
        />
        <StatCard
          title="Issues Reported"
          value={data?.today?.issues_reported || 0}
          icon={AlertTriangle}
          color="yellow"
        />
        <StatCard
          title="Backups Verified"
          value={data?.today?.backups_verified || 0}
          icon={CheckCircle}
          color="green"
        />
      </div>
    </div>
  );
}
