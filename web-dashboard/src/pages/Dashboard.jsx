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
  Camera,
  Wifi,
  Circle,
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
  const { user, isAdmin, isTeamLead, isGroupLeader, isQALead, isQA, isBackupLead, isBackup } = useAuth();
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
      } else if (isTeamLead()) {
        // Team Lead gets admin-level operational data
        response = await dashboardService.getAdmin();
      } else if (isGroupLeader()) {
        response = await dashboardService.getGroupLeader();
      } else if (isQALead() || isQA()) {
        response = await dashboardService.getQA();
      } else if (isBackupLead() || isBackup()) {
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

  // Admin Dashboard - "GLOBAL COMMAND VIEW" per blueprint
  if (isAdmin() && data?.overview) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Global Command View</h1>
          <p className="text-gray-500">System-wide situational awareness — signals, not metrics</p>
        </div>

        {/* Primary KPIs - Signals per blueprint */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            title="Active SD Sessions"
            value={data.overview.active_sessions || 0}
            icon={Activity}
            color="blue"
            subtitle="Currently copying"
          />
          <StatCard
            title="Cameras Healthy"
            value={data.overview.cameras_healthy || 0}
            icon={Camera}
            color="green"
            subtitle={`${data.overview.cameras_attention || 0} need attention`}
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
            title="Early Removals"
            value={data.overview.early_removals_today || 0}
            icon={AlertTriangle}
            color={data.overview.early_removals_today > 0 ? 'red' : 'green'}
            subtitle="Today"
          />
        </div>

        {/* Secondary row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Editors Online</span>
              <Wifi className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {data.overview.online_agents || 0}
              <span className="text-sm font-normal text-gray-500 ml-2">
                / {data.overview.total_editors || 0}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Media Today</span>
              <Video className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {data.overview.media_today || 0}
              <span className="text-sm font-normal text-gray-500 ml-2">files indexed</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Backup Coverage</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {data.overview.backup_coverage || 0}%
            </div>
          </div>
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

  // Team Lead Dashboard - Same as Admin but labeled for Team Lead
  if (isTeamLead() && data?.overview) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Command</h1>
          <p className="text-gray-500">Event operations oversight — real-time situational awareness</p>
        </div>

        {/* Primary KPIs - Same as Admin */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            title="Active SD Sessions"
            value={data.overview.active_sessions || 0}
            icon={Activity}
            color="blue"
            subtitle="Currently copying"
          />
          <StatCard
            title="Cameras Healthy"
            value={data.overview.cameras_healthy || 0}
            icon={Camera}
            color="green"
            subtitle={`${data.overview.cameras_attention || 0} need attention`}
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
            title="Early Removals"
            value={data.overview.early_removals_today || 0}
            icon={AlertTriangle}
            color={data.overview.early_removals_today > 0 ? 'red' : 'green'}
            subtitle="Today"
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

  // Group Leader Dashboard - "TEAM CONTROL VIEW" per blueprint (scoped to their group)
  if (isGroupLeader() && data?.groups) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Control View</h1>
          <p className="text-gray-500">Your group's operations — no global data, only your team</p>
        </div>

        {/* Group-scoped KPIs per blueprint */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Editors Online"
            value={data.team_stats?.online_members || 0}
            icon={Wifi}
            color="green"
            subtitle={`of ${data.team_stats?.total_members || 0} total`}
          />
          <StatCard
            title="Active Sessions"
            value={data.team_stats?.active_sessions || 0}
            icon={Activity}
            color="blue"
            subtitle="In your group"
          />
          <StatCard
            title="Open Issues"
            value={data.groups?.reduce((sum, g) => sum + g.open_issues, 0) || 0}
            icon={AlertTriangle}
            color="red"
          />
          <StatCard
            title="Backup Completion"
            value={`${data.team_stats?.backup_percentage || 0}%`}
            icon={HardDrive}
            color={data.team_stats?.backup_percentage >= 80 ? 'green' : 'yellow'}
            subtitle="Group only"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editors in Group */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">My Team</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {data.groups?.map((group) => (
                <div key={group.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{group.code} - {group.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-sm">
                        <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                        {group.online_count || 0} online
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-600">{group.member_count} members</span>
                    <span className="text-red-600">{group.open_issues} issues</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <IssuesList issues={data.recent_issues} />
        </div>

        {/* Scoped workflow and status */}
        <WorkflowProgress />
        <EditorStatus />

        {/* Scope reminder */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
          <strong>📋 Scoped View</strong> — You only see data from your assigned groups. No global search or unrelated data.
        </div>
      </div>
    );
  }

  // QA Dashboard - "ISSUE WORKBENCH" per blueprint (only issues, never clean footage)
  if ((isQALead() || isQA()) && data?.issue_summary) {
    const severityData = data.severity_distribution || { critical: 0, high: 0, medium: 0, low: 0 };
    const totalIssues = Object.values(severityData).reduce((a, b) => a + b, 0);
    
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isQALead() ? 'QA Lead Workbench' : 'Issue Workbench'}
          </h1>
          <p className="text-gray-500">
            Issue review only — you never see clean footage, only problems to resolve
          </p>
        </div>

        {/* Issue Queue Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Open Queue" value={data.issue_summary.open || 0} icon={Clock} color="blue" />
          <StatCard title="Acknowledged" value={data.issue_summary.acknowledged || 0} icon={Activity} color="yellow" />
          <StatCard title="In Progress" value={data.issue_summary.in_progress || 0} icon={TrendingUp} color="purple" />
          <StatCard title="Resolved Today" value={data.issue_summary.resolved_today || 0} icon={CheckCircle} color="green" />
        </div>

        {/* Severity Distribution - per blueprint */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Severity Distribution</h3>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{severityData.critical || 0}</div>
              <div className="text-xs text-red-600">Critical</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-700">{severityData.high || 0}</div>
              <div className="text-xs text-orange-600">High</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700">{severityData.medium || 0}</div>
              <div className="text-xs text-yellow-600">Medium</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-700">{severityData.low || 0}</div>
              <div className="text-xs text-gray-600">Low</div>
            </div>
          </div>
          {totalIssues > 0 && (
            <div className="h-3 flex rounded-full overflow-hidden">
              <div className="bg-red-500" style={{ width: `${(severityData.critical / totalIssues) * 100}%` }} />
              <div className="bg-orange-500" style={{ width: `${(severityData.high / totalIssues) * 100}%` }} />
              <div className="bg-yellow-500" style={{ width: `${(severityData.medium / totalIssues) * 100}%` }} />
              <div className="bg-gray-400" style={{ width: `${(severityData.low / totalIssues) * 100}%` }} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Critical Issues Queue */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Critical Issues Queue</h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {data.critical_issues?.length === 0 && (
                <div className="p-4 text-center text-gray-500">No critical issues</div>
              )}
              {data.critical_issues?.map((issue) => (
                <div key={issue.id} className="p-4 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{issue.type?.replace('_', ' ')}</p>
                      <p className="text-sm text-gray-500">
                        Camera {issue.camera_number || '?'} • {issue.group?.group_code}
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

          {/* Cameras with Repeated Issues - per blueprint */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Cameras with Repeated Issues</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {(data.problem_cameras || []).length === 0 && (
                <div className="p-4 text-center text-gray-500">No cameras flagged</div>
              )}
              {(data.problem_cameras || []).map((cam) => (
                <div key={cam.camera_number} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Camera className="w-5 h-5 text-gray-400" />
                    <span className="font-medium">Camera {cam.camera_number}</span>
                  </div>
                  <span className="text-red-600 text-sm">{cam.issue_count} issues</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QA Scope Reminder */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-700">
          <strong>🔒 QA Access</strong> — You can only view and resolve issues. No access to names, regions, or clean footage.
        </div>
      </div>
    );
  }

  // Backup Dashboard - "ARCHIVE INTEGRITY VIEW" per blueprint
  if ((isBackupLead() || isBackup()) && data?.coverage) {
    const coverage = data.coverage;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isBackupLead() ? 'Archive Integrity Lead' : 'Archive Integrity View'}
          </h1>
          <p className="text-gray-500">
            Coverage and verification status — you see integrity, not content
          </p>
        </div>

        {/* Primary KPIs per blueprint */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            title="Pending Backups" 
            value={coverage.pending || 0} 
            icon={Clock} 
            color={coverage.pending > 10 ? 'red' : 'yellow'}
            subtitle="By editor"
          />
          <StatCard 
            title="Disks In Use" 
            value={coverage.disks_in_use || 0} 
            icon={HardDrive} 
            color="blue" 
          />
          <StatCard 
            title="Verification Failures" 
            value={coverage.verification_failures || 0} 
            icon={AlertTriangle} 
            color={coverage.verification_failures > 0 ? 'red' : 'green'}
          />
          <StatCard 
            title="Coverage" 
            value={`${coverage.coverage_percentage || 0}%`} 
            icon={CheckCircle} 
            color={coverage.coverage_percentage >= 90 ? 'green' : 'yellow'}
          />
        </div>

        {/* Coverage Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Backup Coverage</h3>
          <div className="grid grid-cols-3 gap-4 mb-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{coverage.total_media || 0}</div>
              <div className="text-sm text-gray-500">Total Files</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{coverage.backed_up || 0}</div>
              <div className="text-sm text-gray-500">Backed Up</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{coverage.verified || 0}</div>
              <div className="text-sm text-gray-500">Verified</div>
            </div>
          </div>
          <div className="overflow-hidden h-4 flex rounded-full bg-gray-200">
            <div
              style={{ width: `${coverage.coverage_percentage}%` }}
              className="bg-green-500 transition-all duration-500"
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>0%</span>
            <span>{coverage.coverage_percentage}% backed up</span>
            <span>100%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending by Editor */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Pending by Editor</h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
              {(data.pending_by_editor || []).length === 0 && (
                <div className="p-4 text-center text-gray-500">All caught up!</div>
              )}
              {(data.pending_by_editor || []).map((editor) => (
                <div key={editor.id} className="p-4 flex items-center justify-between">
                  <span className="font-medium">{editor.name}</span>
                  <span className={`text-sm ${editor.pending > 5 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {editor.pending} pending
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Disk Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Disk Rotation Status</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {(data.disk_status || []).length === 0 && (
                <div className="p-4 text-center text-gray-500">No disk data</div>
              )}
              {(data.disk_status || []).map((disk) => (
                <div key={disk.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5 text-gray-400" />
                    <span className="font-medium">{disk.label}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    disk.status === 'active' ? 'bg-green-100 text-green-700' :
                    disk.status === 'full' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {disk.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Backup Scope Reminder */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          <strong>💾 Archive View</strong> — You see coverage and verification, not file contents. Focus on integrity, not media.
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
